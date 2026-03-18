import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';
import { JwtPayload } from '../types';
import { config } from '../config';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

interface DecodedPayload {
  sub: string;
  unique_name?: string;
  email?: string;
  role?: string;
  roleId?: number;
  jti?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify JWT and set req.user. Expects: Authorization: Bearer <token>
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or invalid Authorization header'));
    return;
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
    }) as DecodedPayload;
    req.user = {
      sub: decoded.sub,
      email: decoded.unique_name ?? decoded.email ?? '',
      role: decoded.role ?? 'CUSTOMER',
      roleId: decoded.roleId ?? 0,
      jti: decoded.jti,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

/**
 * Restrict access by roleId. Use after authenticate().
 * Example: requireRoles(1, 2) for ADMIN(1), CUSTOMER(2).
 */
export function requireRoles(...allowedRoleIds: number[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError('Authentication required'));
      return;
    }
    if (!allowedRoleIds.includes(req.user.roleId)) {
      next(new UnauthorizedError('Insufficient permissions'));
      return;
    }
    next();
  };
}
