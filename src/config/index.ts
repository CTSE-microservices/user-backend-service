import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    expirationHours: Number(process.env.JWT_EXPIRATION_HOURS) || 24,
    issuer: process.env.JWT_ISSUER ?? 'UserService',
    audience: process.env.JWT_AUDIENCE ?? 'UserServiceClient',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL,
    exchange: process.env.RABBITMQ_EXCHANGE || 'user.events',
    userRegisteredQueue: process.env.RABBITMQ_USER_REGISTERED_QUEUE || 'user-service.user-registered',
    userRegisteredRoutingKey:
      process.env.RABBITMQ_USER_REGISTERED_ROUTING_KEY || 'user.registered',
    enableUserRegisteredConsumer:
      process.env.ENABLE_USER_REGISTERED_CONSUMER === 'true',
    connectRetries: Number(process.env.RABBITMQ_CONNECT_RETRIES || 10),
    connectRetryDelayMs: Number(process.env.RABBITMQ_CONNECT_RETRY_DELAY_MS || 1000),
  },
  redis: {
    url: process.env.REDIS_URL,
    ttlSeconds: Number(process.env.REDIS_TTL_SECONDS || 60),
  },
} as const;
