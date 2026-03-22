import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { userRepository } from '../repositories';
import { config } from '../config';
import { LoginDto, LoginResponseDto } from '../types';
import { UnauthorizedError } from '../utils/errors';

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
  userId: string,
  email: string,
  role: string,
  roleId: number
): string {
  const secret = getJwtSecret();
  const expirationHours = config.jwt.expirationHours;
  // Use seconds (number) — satisfies @types/jsonwebtoken SignOptions with strict TS
  const expiresInSeconds = expirationHours * 3600;

  return jwt.sign(
    {
      sub: userId,
      unique_name: email,
      role,
      roleId,
      jti: uuidv4(),
      iat: Math.floor(Date.now() / 1000),
    },
    secret,
    {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      expiresIn: expiresInSeconds,
    }
  );
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

  const token = generateJwtToken(user.id, user.email, roleName, user.roleId);

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
