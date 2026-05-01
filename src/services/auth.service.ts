import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { userRepository } from '../repositories';
import { config } from '../config';
import { LoginDto, LoginResponseDto } from '../types';
import { UnauthorizedError } from '../utils/errors';
import { allowlistToken, isRedisReady } from '../integrations/redis';

function getJwtSecret(): string {
  const secret = config.jwt.secret;
  if (!secret || secret === 'change-me-in-production') {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
}

/**
 * Generate JWT for authenticated user.
 */
export function generateJwtToken(
  userId: number,
  email: string,
  role: string,
  roleId: number
): { token: string; jti: string; expiresInSeconds: number } {
  const secret = getJwtSecret();
  const expirationHours = config.jwt.expirationHours;
  // Use seconds (number) — satisfies @types/jsonwebtoken SignOptions with strict TS
  const expiresInSeconds = expirationHours * 3600;
  const jti = uuidv4();

  const token = jwt.sign(
    {
      sub: String(userId),
      unique_name: email,
      role,
      roleId,
      jti,
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: expiresInSeconds,
    }
  );

  return { token, jti, expiresInSeconds };
}

/**
 * Login: validate credentials, update last login, return JWT and user info.
 */
export async function login(dto: LoginDto): Promise<LoginResponseDto | null> {
  const user = await userRepository.findByEmail(dto.email);
  if (!user) return null;
  const roleName = (user as { role?: { roleName: string } }).role?.roleName ?? 'CUSTOMER';
  const channelName = (user as { userChannel?: { channelName: string } }).userChannel?.channelName ?? 'RETAIL';

  if (!user.isActive) {
    throw new UnauthorizedError('User account is inactive. Please contact administrator.');
  }

  const valid = await bcrypt.compare(dto.password, user.passwordHash);
  if (!valid) return null;

  await userRepository.updateLastLogin(user.id);

  const expirationHours = config.jwt.expirationHours;
  const expiresAt = new Date(Date.now() + expirationHours * 60 * 60 * 1000);

  const { token, jti, expiresInSeconds } = generateJwtToken(
    user.id,
    user.email,
    roleName,
    user.roleId
  );
  if (isRedisReady()) {
    await allowlistToken(jti, expiresInSeconds);
  } else {
    console.warn('[Auth] Redis unavailable, skipping token allowlist');
  }

  return {
    userId: user.id,
    token,
    username: user.username ?? null,
    email: user.email,
    role: roleName,
    channel: channelName,
    expiresAt,
  };
}

export const authService = { login, generateJwtToken };
