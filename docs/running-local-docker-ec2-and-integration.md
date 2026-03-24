# Running locally, with Docker, on EC2 — and RabbitMQ integration

This document explains:

1. **Default port `4000`** (was `3000`) — what changed and how to override it  
2. **Local development** vs **Docker Compose** vs **EC2** — they are different workflows  
3. **Step-by-step: run locally** (infra + npm + Prisma + Swagger)  
4. **Step-by-step: run everything with Docker Compose**  
5. **Integration demo:** `UserRegistered` RabbitMQ event  
6. **EC2:** what “EC2 running Docker + SSH” means and where those steps fit  

---

## 1) Port number: `4000` (default)

The User Service listens on **`PORT`** from the environment. The default is **`4000`** (see `src/config/index.ts` and `.env.example`).

### What was updated in the repo

| Location | Change |
|----------|--------|
| `src/config/index.ts` | Default `PORT` fallback: `'4000'` |
| `.env.example` | `PORT=4000` |
| `Dockerfile` | `EXPOSE 4000` |
| `docker-compose.yml` | `PORT: 4000` and `4000:4000` host mapping |
| `README.md`, `src/app.ts` comment | URLs use `localhost:4000` |
| `docs/ec2-*.md` | EC2 URLs use port `4000` |

Swagger’s “Try it out” uses `config.port`, so it matches automatically.

### If you want another port (e.g. `5000`)

1. Set in `.env`: `PORT=5000`  
2. For Docker: map host → container, e.g. `-p 5000:5000` and set `PORT=5000` in the container.  
3. Open: `http://localhost:5000/api-docs`

---

## 2) Three different ways to run — do not mix them up

| Workflow | What you use | When |
|----------|--------------|------|
| **A) Local Node (npm)** | Node on your PC + optional Docker only for Postgres/RabbitMQ/Redis | Daily development |
| **B) Full stack in Docker** | `docker compose up` (app + DB + RabbitMQ + Redis) | Test like production on one machine |
| **C) EC2 deployment** | Linux server in AWS + Docker + SSH | Production / staging on the cloud |

- **Sections 3–4 below** = **A and B** on your **Windows** machine (`localhost`).  
- **“EC2 running Docker and can SSH into it”** means: you already created an EC2 instance, installed Docker there, and you can open a terminal session with **SSH**. That is **not** the same as “npm run dev” on Windows.  
- For **EC2 step-by-step**, use: `docs/ec2-deploy-user-service.md` (and CI/CD docs if needed).

---

## 3) Running locally (beginner) — Windows + optional infra in Docker

**Goal:** Run the API on your PC at `http://localhost:4000` (Swagger: `/api-docs`).

### Prerequisites

- Node.js installed  
- This repo cloned  

### Step 1: Start infra (Postgres + RabbitMQ + Redis) — optional but recommended

If you use **Docker** only for databases (not the Node app):

From the **project root**:

```bash
docker compose up -d postgres rabbitmq redis
```

Wait until containers are healthy (`docker compose ps`).

**Why:** Your `.env` can point `DATABASE_URL`, `RABBITMQ_URL`, and `REDIS_URL` at `localhost` (see `.env.example`).

If you use **Supabase** for Postgres and **CloudAMQP** / **Redis Cloud** instead, you **do not** need `postgres` / `rabbitmq` / `redis` containers — just set those URLs in `.env`.

### Step 2: Install dependencies

```bash
npm install
```

### Step 3: Environment file

```bash
copy .env.example .env
```

Edit `.env`: set at least `DATABASE_URL`, `JWT_SECRET`, and if you use local Docker infra, the RabbitMQ/Redis URLs from `.env.example`.

### Step 4: Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
npx prisma db seed
```

- **First time** or after schema changes: `migrate dev` creates migration history.  
- **Seed** fills `user_roles` and `user_channels` (needed for `roleId` / `userChannelId` on register).

### Step 5: Run the service

```bash
npm run dev
```

### Step 6: Test API (Swagger)

Open in browser:

- **Swagger:** `http://localhost:4000/api-docs`  
- **Health:** `GET http://localhost:4000/api/v1/health`

Suggested flow:

1. `GET /api/v1/health` → should return OK.  
2. `POST /api/v1/users/register` → body includes `roleId`, `userChannelId` (from seed).  
3. `POST /api/v1/auth/login` → copy `token` from response.  
4. `GET /api/v1/auth/verify` → header `Authorization: Bearer <token>` (use the token from step 3).

---

## 4) Running with Docker Compose (full stack)

**Goal:** Run **user-service + Postgres + RabbitMQ + Redis** together in Docker on your machine.

### Step 1: Build and start all services

From project root:

```bash
docker compose up --build
```

The `user-service` container uses `PORT=4000` and maps **`4000:4000`**.

### Step 2: Verify the API

- Swagger: `http://localhost:4000/api-docs`  
- Health: `http://localhost:4000/api/v1/health`

### Step 3: Check logs (Redis + RabbitMQ)

In another terminal:

```bash
docker compose logs -f user-service
```

You should see lines like:

- `[Redis] Connected` (or a warning if Redis URL is wrong)  
- `[RabbitMQ] Connected` (or a warning)  

After **`POST /api/v1/users/register`**, if `ENABLE_USER_REGISTERED_CONSUMER=true` in the compose env, you may see:

- `[RabbitMQ] Received event: UserRegistered <userId>`

---

## 5) Integration demo — `UserRegistered` event (RabbitMQ)

When registration succeeds, the User Service publishes a message to RabbitMQ.

### What is published

- **Exchange:** `user.events` (configurable via `RABBITMQ_EXCHANGE`)  
- **Routing key:** `user.registered` (`RABBITMQ_USER_REGISTERED_ROUTING_KEY`)  
- **Example body:**

```json
{
  "type": "UserRegistered",
  "timestamp": "2026-03-18T12:00:00.000Z",
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    "roleId": 2,
    "userChannelId": 1
  }
}
```

### How another microservice (e.g. Order Service) consumes it

1. Use the **same** `RABBITMQ_URL` (or same broker, different vhost if you use that pattern).  
2. Declare the **same** exchange name (`user.events`) and type (**direct**).  
3. Create a **queue** for that service, e.g. `orders-service.user-registered`.  
4. **Bind** the queue to exchange `user.events` with routing key `user.registered`.  
5. **Consume** messages and parse JSON; handle `type === "UserRegistered"`.

Keep exchange name + routing key **in sync** with the User Service (or share them via env vars across repos).

---

## 6) EC2: “running Docker” + “SSH” — what it means

These are **prerequisites for deploying on AWS EC2**, not steps 3–4 above.

| Requirement | Meaning |
|-------------|--------|
| **EC2 instance** | A Linux VM in AWS (e.g. Ubuntu or Amazon Linux). |
| **Docker installed on EC2** | You can run `docker build` and `docker run` **on the server**. |
| **SSH access** | You can connect from your PC with `ssh -i key.pem user@<EC2_IP>` to run commands on EC2. |

**Typical EC2 deploy flow (high level):**

1. SSH into EC2.  
2. Clone your GitHub repo (or pull updates).  
3. Create `.env` on the server (Supabase + CloudAMQP + Redis URLs — **not** `localhost` for production).  
4. `docker build` → `docker run -p 4000:4000 ...`  
5. Open `http://<EC2_PUBLIC_IP>:4000/api-docs` (security group must allow inbound TCP **4000**).

Full detail: **`docs/ec2-deploy-user-service.md`**.

**CI/CD** (optional): **`docs/ec2-ci-cd-user-service.md`** (Approach A) and **`docs/ec2-ci-cd-approach-b.md`** (Approach B with ECR).

---

## 7) Quick reference — URLs (default port 4000)

| Environment | Swagger | Health |
|-------------|---------|--------|
| Local npm | `http://localhost:4000/api-docs` | `http://localhost:4000/api/v1/health` |
| Docker Compose | same | same |
| EC2 | `http://<EC2_IP>:4000/api-docs` | `http://<EC2_IP>:4000/api/v1/health` |

API prefix is always `API_PREFIX` (default `/api/v1`).
