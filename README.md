# User Backend Service

User microservice for an e-commerce system. Independently deployable, REST API, clean architecture.

## Tech Stack

- Node.js + Express
- TypeScript
- PostgreSQL
- Prisma ORM

## Folder Structure

```
user-backend-service/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── config/
│   │   ├── index.ts          # App config (env)
│   │   └── database.ts       # Prisma client singleton
│   ├── controllers/
│   │   ├── index.ts
│   │   └── user.controller.ts
│   ├── services/
│   │   ├── index.ts
│   │   └── user.service.ts
│   ├── repositories/
│   │   ├── index.ts
│   │   └── user.repository.ts
│   ├── routes/
│   │   ├── index.ts          # Mounts routes + health
│   │   └── user.routes.ts
│   ├── middlewares/
│   │   ├── index.ts
│   │   ├── errorHandler.ts
│   │   └── auth.ts           # JWT placeholder + requireRoles
│   ├── types/
│   │   └── index.ts          # DTOs, enums, JwtPayload
│   ├── utils/
│   │   └── errors.ts         # AppError, NotFound, Conflict, etc.
│   ├── app.ts
│   └── index.ts
├── tests/
│   ├── setup.ts
│   └── user.service.test.ts
├── .env.example
├── .gitignore
├── Dockerfile
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

1. Copy `.env.example` to `.env` and set `DATABASE_URL` (PostgreSQL with `user_service` schema).
2. Ensure DB and tables exist (or run your SQL to create `user_service.user_roles`, `user_service.user_channels`, `user_service.users`, `user_service.user_addresses`).
3. `npm install`
4. `npm run prisma:generate`
5. `npm run dev` (development) or `npm run build && npm start` (production).

## Swagger (API docs)

Run the server and open **http://localhost:3000/api-docs** to explore and test all endpoints (Try it out).

## API (prefix: `/api/v1`)

| Method | Path           | Description     |
|--------|----------------|-----------------|
| POST   | /users/register | Register user   |
| POST   | /users/login    | Login           |
| GET    | /users/:id      | Get user by ID  |
| PATCH  | /users/:id      | Update user     |
| GET    | /health         | Health check    |

## Docker

```bash
docker build -t user-backend-service .
docker run -p 3000:3000 -e DATABASE_URL="postgresql://..." user-backend-service
```

## Roles & Channels

- **Roles:** ADMIN, CUSTOMER, VENDOR (stored in `user_roles`; use `roleId` in JWT for `requireRoles()`).
- **Channels:** RETAIL, WHOLESALE (stored in `user_channels`).

JWT logic is stubbed in `src/middlewares/auth.ts`; implement `jwt.verify()` and set `req.user` when ready.
