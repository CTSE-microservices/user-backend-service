import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import { userRepository } from '../repositories';
import { CreateUserDto, UpdateUserDto, UserResponse } from '../types';
import { NotFoundError, ConflictError, UnauthorizedError } from '../utils/errors';

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
    const id = uuidv4();
    const user = await userRepository.create({
      ...dto,
      id,
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    return toUserResponse(user);
  },

  async getById(id: string): Promise<UserResponse> {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new NotFoundError('User', id);
    }
    return toUserResponse(user);
  },

  async update(id: string, dto: UpdateUserDto): Promise<UserResponse> {
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
