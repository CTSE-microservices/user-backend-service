import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;
let ready = false;

export function isRedisReady(): boolean {
  return ready;
}

export async function initRedis(): Promise<void> {
  const url = config.redis.url;
  if (!url) throw new Error('REDIS_URL is not configured');

  client = new Redis(url, {
    // Keep reconnect attempts reasonable for beginners
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
  });

  // Ping to verify connectivity
  await client.ping();
  ready = true;
}

export async function shutdownRedis(): Promise<void> {
  ready = false;
  try {
    await client?.quit();
  } catch {
    // ignore
  }
  client = null;
}

function getClient(): Redis {
  if (!client || !ready) throw new Error('Redis client not initialized');
  return client;
}

export async function cacheSetJson<T>(
  key: string,
  value: T,
  ttlSeconds: number = config.redis.ttlSeconds
): Promise<void> {
  const c = getClient();
  await c.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const c = getClient();
  const raw = await c.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

