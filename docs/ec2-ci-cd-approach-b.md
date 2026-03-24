# Approach B (Simpler): GitHub Actions builds & pushes to ECR, EC2 pulls & restarts

This guide shows a “more production” deployment flow:
1. **GitHub Actions** builds your Docker image and pushes it to **AWS ECR**
2. **EC2** pulls the new image from ECR and restarts the container

This is still beginner-friendly (we avoid ECS at first), but uses **ECR** so EC2 deployments are fast.

---

## 0) Assumptions

**First-time setup:** complete **[ec2-deploy-user-service.md](./ec2-deploy-user-service.md)** (EC2 launch, **SSH**, Docker, clone repo, `.env` on EC2). That doc is the **prerequisite** for “EC2 running Docker and can SSH into it.”

- You already have EC2 running Docker and can SSH into it (see deploy doc **§1–§4**).
- You already have `.env` created on EC2 (DO NOT commit secrets to GitHub).
- You will deploy only **user-service** / **user-backend-service**.
- Your AWS region is `eu-north-1` (or change in the steps).

**Redis / RabbitMQ on EC2:** `localhost` in `.env` on EC2 does **not** point to your PC. Use cloud URLs, or run `docker compose up -d rabbitmq redis` on EC2 and use the Compose network (see deploy doc **§5.1**).

---

## 1) Create an ECR repository

1. Go to AWS Console → **ECR**
2. Click **Create repository**
3. Repository name: `user-service`
4. Leave defaults → Create

After creating, copy:
- `accountId` (12 digits)
- `repositoryUri` (looks like `123456789012.dkr.ecr.eu-north-1.amazonaws.com/user-service`)

---

## 2) Give EC2 permission to pull from ECR

### Option (recommended): IAM Role for EC2
1. AWS Console → **EC2** → Instances → select your instance
2. Go to **Security** / **IAM role** (wording varies by UI)
3. Attach an IAM role that allows **ECR read/pull**
4. The role needs permissions like:
   - `ecr:GetAuthorizationToken`
   - `ecr:BatchGetImage`
   - `ecr:GetDownloadUrlForLayer`
   - `ecr:DescribeRepositories`

After that, EC2 can pull without you manually storing AWS keys.

---

## 3) EC2: install tools (if not already)

On EC2, run:

```bash
sudo yum update -y || sudo apt-get update -y
sudo apt-get install -y awscli || sudo yum install -y awscli
sudo docker --version
```

Make sure Docker is running:
```bash
sudo systemctl start docker || true
```

---

## 4) EC2: create `.env` file (IMPORTANT)

On EC2, in your repo folder, create:
```bash
cp .env.example .env
nano .env
```

Set at minimum:
- `DATABASE_URL` (Supabase)
- `RABBITMQ_URL` (CloudAMQP)
- `REDIS_URL` (Redis Cloud / Upstash)
- `JWT_SECRET`
- `PRISMA_SYNC_MODE=dbpush`
- `PRISMA_SEED=true`

Note:
- Secrets must stay on EC2. Your GitHub repo should only contain `.env.example`.

---

## 5) GitHub: add AWS credentials + EC2 SSH secrets

In GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION` (example: `eu-north-1`)
- `ECR_REPOSITORY` (example: `user-service`)

Also add EC2 SSH secrets:
- `EC2_HOST` (public IP or DNS)
- `EC2_USER` (commonly `ubuntu` or `ec2-user`)
- `EC2_SSH_PRIVATE_KEY` (the private key you use to SSH)

Optional:
- `EC2_APP_DIR` (if unset, workflow uses `/home/<EC2_USER>/user-backend-service`, e.g. `/home/ec2-user/user-backend-service`)

---

## 6) GitHub Actions workflow (build+push to ECR, deploy to EC2)

The repo includes:

**`.github/workflows/deploy-user-service.yml`**

It:

1. **On GitHub:** `docker build` → tag with short git SHA → **push to ECR** (same idea as local `docker build -t ...` but the image is stored in ECR).
2. **On EC2 (SSH):** matches your manual flow:
   - `docker compose up -d rabbitmq redis`
   - `docker pull` the new image from ECR (replaces using `user-backend-service:latest` built only on the server)
   - `docker rm -f user-backend-service` then `docker run ...` with `--network user-backend-service_default`, `--env-file .env`, and Redis/Rabbit overrides.

**Not run in CI (use on EC2 yourself if needed):** `docker logs -f user-backend-service` (interactive; after deploy run it over SSH if you want a live tail).

What to customize in the YAML:

- `branches: [main]` if you deploy from another branch.
- **`EC2_APP_DIR`** secret if the repo is not at `/home/<EC2_USER>/user-backend-service`.
- **`ECR_REPOSITORY`** must match the ECR repo name in AWS (e.g. `user-service`).
- If your Compose **project/network** name is not `user-backend-service_default` (e.g. different clone path), adjust `--network` in the workflow file to match `docker network ls` on EC2.

---

## 7) First test (manual)
Before relying on CI/CD, do this once:
1. Push a change to GitHub
2. Go to GitHub → Actions tab → watch workflow run
3. After it completes:
   - Open: `http://<EC2_PUBLIC_IP>:4000/api/v1/health`
   - Open: `http://<EC2_PUBLIC_IP>:4000/api-docs`

---

## 8) Common beginner troubleshooting

### A) EC2 cannot pull image from ECR
Usually means:
- EC2 IAM role permissions missing
- AWS region mismatch

Check:
```bash
docker logs user-service
```

### B) GitHub Actions build works but push fails
Usually means:
- ECR repo name wrong
- AWS credentials don’t have ECR permissions

### C) Container starts but Swagger fails
Check:
```bash
docker logs -f user-service
```
Most likely `.env` values on EC2 are incorrect.

---

## 9) Recommended secret hygiene
- Keep `.env` out of GitHub
- Only store secrets in GitHub “Secrets” or on EC2 as `.env`

