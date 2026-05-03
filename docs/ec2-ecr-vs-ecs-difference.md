# EC2 instance vs ECR vs ECS (Approach B)

This document clarifies the difference between:

1. Creating an **EC2 instance**
2. Creating/using **ECR** (Elastic Container Registry)
3. Deploying containers with **ECS** (Elastic Container Service)

---

## 1) EC2 instance: "Where the app runs" (compute)

When you create an **EC2 instance**, you are provisioning a **virtual machine** that will run your application.

In **Approach B** for this project:
- EC2 is where Docker runs your **user-backend-service** container
- EC2 is where you start supporting containers like **Redis** and **RabbitMQ** (via `docker compose`)
- EC2 is where you keep server-side configuration like `.env` (secrets live on the server, not in GitHub)

Key point: EC2 is **runtime compute**. You directly manage it (Docker service, containers, ports, environment files).

---

## 2) ECR: "Where Docker images are stored" (container registry)

When you create an **ECR repository**, you are creating a **place to store Docker images**.

ECR does not run containers by itself. It is like a private Docker image warehouse.

In **Approach B**:
- **GitHub Actions** builds the Docker image
- GitHub Actions pushes the image to **ECR**
- **EC2** pulls the image from **ECR**
- EC2 then runs the container (for example with `docker pull` and `docker run`)

You typically add an IAM policy for EC2 so it can pull from ECR, for example:
- `AmazonEC2ContainerRegistryReadOnly`

Key point: ECR is **storage and distribution of images**, not the server that runs them.

---

## 3) Putting it together in Approach B: "EC2 pulls, EC2 runs"

High-level flow in Approach B:

1. You create an **EC2 instance** (compute) and ensure Docker + networking are ready.
2. You create an **ECR repository** (image storage).
3. GitHub Actions builds the image and pushes it to ECR.
4. GitHub Actions connects to EC2 via SSH.
5. On EC2, you run commands to:
   - bring up dependencies (`docker compose up -d rabbitmq redis`)
   - pull the new image (`docker pull ...`)
   - restart the container (`docker rm` + `docker run`)

Key point: You (or your SSH script) control the restart logic. Docker on EC2 is the orchestrator.

---

## 4) ECS deployment: "ECS orchestrates containers"

With **ECS**, you still use **ECR** as the image registry (the same idea), but the deployment control changes:

- ECS manages how containers are **scheduled** and **run**
- ECS can automatically restart tasks, replace failed containers, and manage desired counts
- You define a **Task Definition** (image + env + ports) and an **ECS Service** (how many tasks to run)
- Deployments are handled by ECS without you manually running `docker run`

So the main difference is:
- **Approach B**: EC2 (plus your SSH commands) is responsible for running the new container
- **ECS**: ECS is responsible for running and updating the container tasks

---

## 5) Your workflow (`.github/workflows/deploy-user-service.yml`) vs ECS

If you followed **[ec2-deploy-user-service.md](./ec2-deploy-user-service.md)** (EC2, Docker, SSH) and **[ec2-ci-cd-approach-b.md](./ec2-ci-cd-approach-b.md)** (Actions → ECR → EC2), your pipeline is **not the same as ECS**, but it **overlaps** in one important place.

### What is similar to a typical ECS setup

| Area | Your Approach B + Actions workflow | Typical ECS deployment |
|------|-----------------------------------|-------------------------|
| **Image registry** | Images live in **ECR** after `docker push` | Same: ECS task definitions reference **ECR** (or another registry) |
| **Build in CI** | GitHub Actions runs `docker build` and pushes a tagged image (e.g. git SHA) | Same pattern: CI builds and pushes; deploy step only references the new image digest/tag |
| **Immutable deploy artifact** | Each deploy uses a specific `account.dkr.ecr.region.amazonaws.com/repo:tag` | Same idea: new revision = new image reference |

So: **ECR + “build image in GitHub Actions on push to `main`”** is aligned with how many ECS projects work. The fork in the road is **what happens after the image is in ECR**.

### What is different from ECS

| Topic | Your workflow (ECR + EC2 + SSH) | ECS |
|-------|----------------------------------|-----|
| **Who runs the container** | **Docker on a VM you manage** (`docker compose`, `docker pull`, `docker run` on EC2) | **ECS scheduler** starts **tasks** (on **Fargate** serverless capacity or **ECS on EC2** capacity) |
| **How a new version rolls out** | SSH runs a **script**: login to ECR, pull image, `docker rm`, `docker run` | **`UpdateService`** / new task definition revision; ECS replaces tasks according to deployment configuration |
| **Orchestration** | You encode steps in **bash over SSH** (see `deploy-user-service.yml`) | You declare **task definition** + **service** (CPU, memory, env, secrets, desired count); ECS keeps reality matching that declaration |
| **Rolling updates & health checks** | Optional; default path is **replace one container** (possible brief gap unless you add blue/green or a second instance yourself) | Built-in **rolling deployments**, optional **ALB** health checks, **circuit breaker** |
| **Scaling** | One container on one EC2 unless you add more instances/containers manually | **Desired count**, auto scaling of tasks (and of EC2 if using that launch type) |
| **SSH as a deploy mechanism** | **Yes** — Actions uses `appleboy/ssh-action` to drive EC2 | **No** for Fargate; for ECS on EC2 you do not SSH to deploy — you call the **ECS API** (Console, CLI, CDK, etc.) |
| **Secrets / config** | **`.env` on the EC2 filesystem** (not in Git) | Often **Secrets Manager** / **SSM Parameter Store** injected into the task definition |

### One-line summary

- **Your setup:** “**CI builds and pushes to ECR; a single EC2 host pulls and restarts Docker via SSH.**”
- **ECS setup:** “**CI pushes to ECR; ECS pulls and runs tasks and handles deploy/rollback/scaling according to the service.**”

Same **warehouse** (ECR); different **delivery truck and traffic control** (manual Docker on EC2 vs ECS).

---

## 6) Summary table

| Component | What it is | Runs containers? | Typical role in Approach B |
|---|---|---:|---|
| EC2 | Virtual machine | Yes | Runs Docker and your service |
| ECR | Private Docker registry | No | Stores images pushed by GitHub Actions |
| ECS | Container orchestration | Yes (via tasks) | ECS runs/updates tasks automatically |

---

## 7) Practical takeaway for this project

If your goal is:
- "I want a simpler beginner setup": **Approach B (EC2 + Docker + ECR)** is fine.
- "I want managed deployments": use **ECS**, where ECS handles container lifecycle and rolling updates.

