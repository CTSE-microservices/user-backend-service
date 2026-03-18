import dotenv from 'dotenv';

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
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
} as const;
