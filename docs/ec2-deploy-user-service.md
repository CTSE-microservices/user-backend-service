# Deploy `user-backend-service` to AWS EC2 (Beginner Step-by-Step)

This guide deploys your **User Service** container on **EC2** using your existing `Dockerfile`.

### Using this doc with CI/CD (Approach B)

If you follow **[ec2-ci-cd-approach-b.md](./ec2-ci-cd-approach-b.md)** (GitHub Actions → ECR → EC2), **complete this guide first** through at least:

- **§1** Create EC2  
- **§2** SSH works (you can log in)  
- **§3** Docker installed and `docker ps` works  
- **§4** Code on EC2 (e.g. `git clone`)  
- **§5** `.env` on EC2 (secrets stay on the server, not in GitHub)

Then you can add ECR + GitHub Actions as in Approach B. The pipeline only replaces **how the image gets to EC2**; the EC2 + Docker + SSH baseline is the same.

It assumes:
- Your repo is on GitHub (or you can copy the files to EC2)
- You already have **DATABASE_URL** from **Supabase**
- For **RabbitMQ** and **Redis**: use **cloud URLs** in production, **or** run RabbitMQ + Redis on the same EC2 host (see **§5.1**). **`localhost` in `.env` on EC2 does not reach your Windows PC** — it only refers to the EC2 machine itself.

---

## 0) What you will end up with
- EC2 instance running your service in Docker
- Swagger available at: `http://<EC2_PUBLIC_IP>:4000/api-docs`
  - **"Try it out"** uses the **same host** as the page (relative `/api/v1` server). If you still see `localhost` in the generated curl, rebuild/redeploy the image so the latest `swagger.ts` is included.

---

## 1) Create EC2 instance (AWS Console)

### Step 1.1: Choose an instance
1. Go to AWS Console → **EC2**
2. Click **Launch instance**
3. Choose **Amazon Linux 2023** (or Ubuntu 22.04 LTS)
4. Instance type: `t3.micro` (for testing)

### Step 1.2: Create/choose key pair
1. Under **Key pair**, click **Create new key pair**
2. Name it: `user-service-key` (any name)
3. Choose format: **.pem**
4. Download it and keep it safe

### Step 1.3: Security group (important)
You need inbound access to SSH and your API port:
1. In **Security group**, click **Edit inbound rules**
2. Add rule:
   - Type: `SSH`
   - Port: `22`
   - Source: your IP (recommended) or `0.0.0.0/0` for testing
3. Add rule:
   - Type: `Custom TCP`
   - Port: `4000`
   - Source: your IP (recommended) or `0.0.0.0/0` for testing

Click **Launch instance**.

---

## 2) Connect to EC2 via SSH

SSH is how you open a terminal **on the Linux server**. You need this working before installing Docker, editing `.env`, or setting up CI/CD that deploys to EC2.

### Step 2.1: Find your EC2 public IP / DNS
1. EC2 Console → Instances → click your instance
2. Copy **Public IPv4 address** (example: `51.20.xx.xx`)

### Step 2.2: Which username? (depends on OS you picked when launching)
| AMI / OS              | SSH user (default) |
|-----------------------|--------------------|
| **Amazon Linux 2023** | `ec2-user`         |
| **Ubuntu**            | `ubuntu`           |

Replace `<USER>` below with the correct one.

### Step 2.3: SSH from Windows (PowerShell)
Put your `.pem` file in a folder you remember (example: `C:\Users\You\.ssh\user-service-key.pem`).

```powershell
ssh -i "C:\Users\shyni\.ssh\user-service-key.pem" ec2-user@13.53.39.88
```

Examples:
```powershell
ssh -i "C:\Users\shyni\.ssh\user-service-key.pem" ec2-user@13.53.39.88
ssh -i "C:\Users\You\.ssh\user-service-key.pem" ubuntu@51.20.xx.xx
```

**First time:** you may see `Are you sure you want to continue connecting (yes/no)?` — type **`yes`** and Enter.

**Wrong permissions on `.pem`:** On Windows 10/11, if OpenSSH complains about key permissions:
1. Right-click the `.pem` → Properties → Security → Advanced → disable inheritance → remove all users except **your** user with Read access.

Or use WSL/Git Bash:
```bash
chmod 400 /mnt/c/path/to/user-service-key.pem
ssh -i /mnt/c/path/to/user-service-key.pem ec2-user@<EC2_PUBLIC_IP>
```

### Step 2.4: Verify SSH works
After login you should see a shell prompt like `[ec2-user@ip-172-31-... ~]$`. Then continue to **§3 Install Docker**.

**SSH fails with "Connection timed out":** check EC2 **Security group** allows inbound **TCP 22** from your IP, and that the instance has a **public IP** (or use Session Manager / bastion).

**SSH fails "Permission denied (publickey)":** wrong `.pem` file, wrong `<USER>`, or wrong instance.

---

## 3) Install Docker on EC2

On the EC2 terminal, run:

```bash
sudo yum update -y || sudo apt-get update -y
sudo yum install -y docker || sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ec2-user || true
```

If you’re on Ubuntu, use:
```bash
sudo usermod -aG docker ubuntu || true
```

Then reboot or log out/in.

Verify:
```bash
docker --version
docker ps
```

---

## 4) Put your code on EC2

### Option A (recommended): clone from GitHub
1. On EC2, install git:
```bash
sudo yum install -y git || sudo apt-get install -y git
```
2. Clone:
```bash
git clone https://github.com/CTSE-microservices/user-backend-service.git
cd user-backend-service
```

### Option B: copy files (if you don’t want git)
- You can upload the project zip/SCP it, then `cd` into the folder.

---

## 5) Create the `.env` file on EC2

In your repo folder on EC2, create a file named `.env`:
```bash
cd /path/to/your/user-backend-service
cp .env.example .env
```

Then edit `.env` and set these at minimum:

### Required environment variables
```env
NODE_ENV=production
PORT=4000
API_PREFIX=/api/v1

# Supabase Postgres (already hosted) — no quotes around URL (Docker/P1012)
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=user_service

# JWT
JWT_SECRET="<PUT_A_STRONG_SECRET>"
JWT_EXPIRES_IN=7d
JWT_EXPIRATION_HOURS=24
JWT_ISSUER=UserService
JWT_AUDIENCE=UserServiceClient

# RabbitMQ (CloudAMQP or similar)
RABBITMQ_URL="<YOUR_CLOUDAMQP_URL>"
RABBITMQ_EXCHANGE=user.events
RABBITMQ_USER_REGISTERED_QUEUE=user-service.user-registered
RABBITMQ_USER_REGISTERED_ROUTING_KEY=user.registered
ENABLE_USER_REGISTERED_CONSUMER=false

# Redis (Redis Cloud / Upstash)
REDIS_URL="<YOUR_REDIS_URL>"
REDIS_TTL_SECONDS=60

# Prisma first-time container behavior (matches your Dockerfile)
PRISMA_SYNC_MODE=dbpush
PRISMA_SEED=true
```

### Very important
- In production, you must NOT use `localhost` for RabbitMQ/Redis unless RabbitMQ/Redis are running on the **same EC2 instance**.
- Use the provider URLs you got from CloudAMQP and Redis Cloud.

### §5.1 Temporary: “localhost” Redis/RabbitMQ while you build CI/CD

Your **Windows** `.env` may use `redis://localhost:6379` and `amqp://guest:guest@localhost:5672` because Docker Desktop publishes those ports on your PC.

On **EC2**, `localhost` is only the EC2 server — **not** your laptop. So the same `.env` will **not** work unless you also run Redis and RabbitMQ **on that EC2**.

**Practical options:**

1. **Recommended for production:** set `REDIS_URL` and `RABBITMQ_URL` to **CloudAMQP** / **Redis Cloud** (or AWS-managed equivalents) in the **EC2** `.env`.

2. **Same pattern as your Windows test:** on EC2, in the repo folder, run only infra:
   ```bash
   docker compose up -d rabbitmq redis
   ```
   Then run the User Service container on the **Compose network** and point Redis/RabbitMQ at service names `redis` and `rabbitmq` (see §6.2 example with `-e REDIS_URL=...` and `--network`).

3. **CI/CD only:** GitHub Actions can build and push the image without a working Redis/Rabbit on EC2, but **the running container on EC2 still needs valid URLs** or the app will log warnings / miss cache & messaging.

---

## 6) Build and run the Docker container

### Step 6.1: Build image
```bash
docker build -t user-backend-service:latest .
```
(Use any tag you like; match the name in `docker run`.)

### Step 6.2: Run container
```bash
docker run -d \
  --name user-backend-service \
  --restart unless-stopped \
  -p 4000:4000 \
  --env-file .env \
  user-backend-service:latest
```

If RabbitMQ and Redis run in **Docker Compose on the same EC2** (see §5.1), add network and overrides, e.g.:
```bash
docker run -d --name user-backend-service --restart unless-stopped -p 4000:4000 \
  --network <your_compose_default_network> \
  --env-file .env \
  -e REDIS_URL=redis://redis:6379 \
  -e RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672 \
  user-backend-service:latest
```

---

## 7) Verify everything works

### Step 7.1: Check container logs
```bash
docker logs -f user-backend-service
```
You should see:
- server start message
- optional warnings about RabbitMQ/Redis (if your provider is temporarily unavailable)

### Step 7.2: Test health + Swagger
Open in your browser:
- Health: `http://<EC2_PUBLIC_IP>:4000/api/v1/health`
- Swagger UI: `http://13.53.39.88:4000/api-docs`

---

## 8) Test the API quickly (Swagger flow)
1. `POST /api/v1/users/register` (requires `roleId` and `userChannelId`)
2. `POST /api/v1/auth/login` (copy `token` from response)
3. `GET /api/v1/auth/verify` with header:
   - `Authorization: Bearer <token>`

---

## 9) Common beginner troubleshooting

### A) Container immediately stops
Run:
```bash
docker logs user-backend-service
```
Typical causes:
- missing env var (especially `DATABASE_URL`, `RABBITMQ_URL`, `REDIS_URL`)
- Prisma error connecting to DB

### B) Prisma / Postgres connection errors
Make sure:
- `DATABASE_URL` is correct
- your Supabase connection allows connections from your EC2 (network rules, IP allowlist if used)

### C) RabbitMQ connection refused
Make sure:
- `RABBITMQ_URL` is from CloudAMQP and includes the correct hostname
- security group allows **outbound** traffic (AWS usually allows outbound by default)

### D) Redis connection errors
Make sure:
- `REDIS_URL` is from your Redis provider
- if it’s TLS, use the correct URL format (often `rediss://...` not `redis://...`)

### E) Swagger loads but API fails with 500
- Check logs:
```bash
docker logs user-backend-service
```
- Use the error message returned by your API / errorHandler

---

## 10) Optional: Put it behind Nginx (port 80)
If you want users to access with `http://<EC2_PUBLIC_IP>/api-docs` (no `:4000`), you can add Nginx reverse proxy.

If you want this, tell me your OS (Amazon Linux vs Ubuntu) and I will give you the exact Nginx steps.

