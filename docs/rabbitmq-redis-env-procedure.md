# RabbitMQ + Redis: env variables & how the flow works

This doc explains the `.env.example` variables used in the User Service microservice and the typical “procedure” for using RabbitMQ and Redis in a microservices system.

---

## 1) RabbitMQ variables (Messaging / Events)

RabbitMQ is used for **asynchronous events** between microservices.

In our User Service, when a user registers, we publish an event called `UserRegistered` to RabbitMQ.

Other services (example: Order Service) can consume the event from their own queue.

### Environment variables used

1. `RABBITMQ_URL`
   - Example: `amqp://guest:guest@localhost:5672`
   - Purpose: tells the Node app how to connect to RabbitMQ.
   - This is the most important variable.

2. `RABBITMQ_EXCHANGE`
   - Example: `user.events`
   - Purpose: an exchange is like a “router”.
   - User Service publishes to this exchange.
   - Other services bind their queues to the same exchange.

3. `RABBITMQ_USER_REGISTERED_QUEUE`
   - Example: `user-service.user-registered`
   - Purpose: the queue name where messages for `UserRegistered` will be delivered.
   - In our current code, the queue is used by the User Service only if you enable the consumer with `ENABLE_USER_REGISTERED_CONSUMER=true`.

4. `RABBITMQ_USER_REGISTERED_ROUTING_KEY`
   - Example: `user.registered`
   - Purpose: the routing key is a “label” attached to the published message.
   - With `direct` exchange, RabbitMQ delivers the message to queues bound with the same routing key.

5. `ENABLE_USER_REGISTERED_CONSUMER`
   - Example: `false` or `true`
   - Purpose: if `true`, the User Service will also **consume** (listen to) events from the queue (useful for local testing).
   - For a real system, usually:
     - User Service: mainly publishes
     - Other services (Order, Notifications, etc.): consume

---

## 2) Redis variables (Cache)

Redis is used for caching, so you can serve some data faster and reduce database calls.

In this project:
- `GET /users/:id` attempts to read `user:<id>` from Redis
- if found, it returns cached user data
- if not found, it reads from PostgreSQL and then stores the result in Redis

### Environment variables used

1. `REDIS_URL`
   - Example: `redis://localhost:6379`
   - Purpose: tells the app how to connect to Redis.

2. `REDIS_TTL_SECONDS`
   - Example: `60`
   - Purpose: “time to live” (how long cached data remains).
   - After TTL expires, Redis deletes the key and the service will fetch again from the database.

---

## 3) How to run the messaging flow (beginner procedure)

### Step A: Make sure infra is running
- RabbitMQ is running (reachable by `RABBITMQ_URL`)
- Redis is running (reachable by `REDIS_URL`)
- Postgres is running (for registering users)

### Step B: Seed required tables
Roles and channels must exist because registration requires:
- `roleId`
- `userChannelId`

Run:
- `npx prisma db seed`

### Step C: Register a user (publishes an event)
1. Call:
   - `POST /api/v1/users/register`
2. After successful creation, User Service publishes:
   - exchange: `RABBITMQ_EXCHANGE`
   - routingKey: `RABBITMQ_USER_REGISTERED_ROUTING_KEY`
   - message payload includes: `userId`, `email`, `roleId`, `userChannelId`

### Step D: Verify event delivery (how you “see” it)
Option 1 (quick test): keep `ENABLE_USER_REGISTERED_CONSUMER=true`
- Then User Service itself will log something like:
  - `[RabbitMQ] Received event: UserRegistered <userId>`

Option 2 (real microservices): Order Service consumes the event
- Order Service creates its own queue and binds it to:
  - exchange: `user.events`
  - routingKey: `user.registered`
- When the user registers, Order Service receives the event.

---

## 4) Do multiple services share the same RabbitMQ / Redis?

Yes.

### RabbitMQ
- Multiple microservices can connect to the same RabbitMQ instance.
- Each service can publish and/or create its own queues.

### Redis
- Multiple services can share one Redis instance.
- Avoid key collisions by using **namespaces** in keys.
  - Example keys:
    - `user:<id>`
    - `order:<id>`
    - `products:<category>`

---

## 5) What you generally need to coordinate between services

If you want Order Service to consume the `UserRegistered` event, these must match across services:
- `RABBITMQ_URL`
- `RABBITMQ_EXCHANGE`
- `RABBITMQ_USER_REGISTERED_ROUTING_KEY`
- message format (event name + payload fields)

