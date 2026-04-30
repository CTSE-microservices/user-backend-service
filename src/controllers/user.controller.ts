import { Request, Response, NextFunction } from 'express';
import { userService } from '../services';
import { CreateUserDto, UpdateUserDto } from '../types';
import { BadRequestError } from '../utils/errors';

function parseUserId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BadRequestError('Invalid user id');
  }
  return id;
}

export const userController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.register(req.body as CreateUserDto);
      res.status(201).json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseUserId(req.params.id);
      const user = await userService.getById(userId);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = parseUserId(req.params.id);
      const user = await userService.update(userId, req.body as UpdateUserDto);
      res.json({ success: true, data: user });
    } catch (err) {
      next(err);
    }
  },
};
