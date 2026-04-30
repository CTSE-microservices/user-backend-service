import { prisma } from '../config/database';
import { User, Prisma } from '@prisma/client';
import { CreateUserDto, UpdateUserDto } from '../types';

export const userRepository = {
  async create(data: CreateUserDto & { passwordHash: string }): Promise<User> {
    return prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        phoneNumber: data.phoneNumber,
        passwordHash: data.passwordHash,
        roleId: data.roleId,
        userChannelId: data.userChannelId,
      },
    });
  },

  async findById(id: number): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
      include: { role: true, userChannel: true, addresses: true },
    });
  },

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { role: true, userChannel: true },
    });
  },

  async update(
    id: number,
    data: Partial<UpdateUserDto> & { passwordHash?: string }
  ): Promise<User> {
    const { passwordHash, ...rest } = data;
    const payload: Prisma.UserUpdateInput = { ...rest };
    if (passwordHash !== undefined) payload.passwordHash = passwordHash;
    return prisma.user.update({
      where: { id },
      data: payload,
    });
  },

  async updateLastLogin(id: number): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  },
};
