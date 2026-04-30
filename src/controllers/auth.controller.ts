import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { userRepository } from '../repositories';
import { UnauthorizedError } from '../utils/errors';

function parseJwtUserId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new UnauthorizedError('Invalid token: User ID is invalid.');
  }
  return id;
}

/**
 * GET /api/v1/auth/verify
 * Verify JWT and return current user profile. Requires Authorization: Bearer <token>.
 */
export async function verifyToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      next(new UnauthorizedError('Invalid token: User ID is missing.'));
      return;
    }

    const parsedUserId = parseJwtUserId(userId);
    const user = await userRepository.findById(parsedUserId);
    if (!user) {
      res.status(404).json({ success: false, error: { message: 'User not found.' } });
      return;
    }

    if (!user.isActive) {
      next(new UnauthorizedError('User account is inactive.'));
      return;
    }

    const roleName = (user as { role?: { roleName: string } }).role?.roleName ?? 'CUSTOMER';
    const channelName = (user as { userChannel?: { channelName: string } }).userChannel?.channelName ?? 'RETAIL';

    const profile = {
      id: user.id,
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: roleName,
      channel: channelName,
      isActive: user.isActive,
    };
    res.status(200).json({ success: true, data: profile });
  } catch (ex) {
    next(ex);
  }
}

/**
 * POST /api/v1/auth/login
 * Login with email and password; returns JWT and user info.
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: { message: 'Email and password are required.' },
      });
      return;
    }

    const response = await authService.login({ email, password });
    if (!response) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid email or password.' },
      });
      return;
    }
    res.status(200).json({ success: true, data: response });
  } catch (ex) {
    if (ex instanceof UnauthorizedError) {
      next(ex);
      return;
    }
    next(ex);
  }
}
