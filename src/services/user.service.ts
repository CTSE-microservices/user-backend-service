import bcrypt from 'bcrypt';
import { userRepository } from '../repositories';
import { CreateUserDto, UpdateUserDto, UserResponse } from '../types';
import { NotFoundError, ConflictError } from '../utils/errors';
import { publishUserRegistered } from '../integrations/rabbitmq';
import { cacheGetJson, cacheSetJson, isRedisReady } from '../integrations/redis';

const SALT_ROUNDS = 10;

function toUserResponse(user: { passwordHash: string; [k: string]: unknown }): UserResponse {
  const { passwordHash: _, ...rest } = user;
  return rest as UserResponse;
}

export const userService = {
  async register(dto: CreateUserDto): Promise<UserResponse> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await userRepository.create({
      ...dto,
      email: dto.email.toLowerCase(),
      passwordHash,
    });

    // Publish an integration event for other microservices.
    // Do not block user registration if RabbitMQ is temporarily unavailable.
    try {
      await publishUserRegistered({
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
        userChannelId: user.userChannelId,
      });
    } catch (err) {
      console.warn('[RabbitMQ] Failed to publish UserRegistered:', err instanceof Error ? err.message : err);
    }

    return toUserResponse(user);
  },

  async getById(id: number): Promise<UserResponse> {
    const cacheKey = `user:${id}`;
    if (isRedisReady()) {
      try {
        const cached = await cacheGetJson<UserResponse>(cacheKey);
        if (cached) return cached;
      } catch {
        // ignore cache errors
      }
    }

    const user = await userRepository.findById(id);
    if (!user) throw new NotFoundError('User', id);

    const response = toUserResponse(user);
    if (isRedisReady()) {
      try {
        await cacheSetJson(cacheKey, response);
      } catch {
        // ignore cache errors
      }
    }

    return response;
  },

  async update(id: number, dto: UpdateUserDto): Promise<UserResponse> {
    const existing = await userRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('User', id);
    }
    if (dto.email && dto.email !== existing.email) {
      const byEmail = await userRepository.findByEmail(dto.email);
      if (byEmail) throw new ConflictError('Email already in use');
    }
    let passwordHash: string | undefined;
    if (dto.password) {
      passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }
    const { password: _, ...rest } = dto;
    const user = await userRepository.update(id, { ...rest, passwordHash });
    return toUserResponse(user);
  },
};
