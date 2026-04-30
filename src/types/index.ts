import { User, UserRole, UserChannel, UserAddress } from '@prisma/client';

// Re-export Prisma types for convenience
export type { User, UserRole, UserChannel, UserAddress };

// Role and Channel enums (align with DB lookup values)
export enum RoleName {
  ADMIN = 'ADMIN',
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
}

export enum ChannelName {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
}

// DTOs / Request types
export interface CreateUserDto {
  username?: string;
  email: string;
  phoneNumber?: string;
  password: string;
  roleId: number;
  userChannelId: number;
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  phoneNumber?: string;
  password?: string;
  roleId?: number;
  userChannelId?: number;
  isActive?: boolean;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface LoginResponseDto {
  userId: number;
  token: string;
  username: string | null;
  email: string;
  role: string;
  channel: string;
  expiresAt: Date;
}

export interface CreateUserAddressDto {
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  district?: string;
  postalCode?: string;
  country?: string;
  isDefault?: boolean;
}

// User without password for responses
export type UserResponse = Omit<User, 'passwordHash'>;

// JWT payload (set by auth middleware after verify)
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  roleId: number;
  jti?: string;
  iat?: number;
  exp?: number;
}
