import {
  createClient,
  createCluster,
  RedisClientType,
  RedisClusterType,
} from 'redis';
import { config } from '../config';

type RedisClient = RedisClientType | RedisClusterType;

let client: RedisClient | null = null;
let ready = false;

const TOKEN_KEY_PREFIX = 'auth:token:';

export function isRedisReady(): boolean {
  return ready;
}

function buildTlsSocketOptions(host?: string) {
  if (!config.redis.tls) return undefined;
  return {
    tls: true,
    rejectUnauthorized: false,
    ...(host ? { servername: host } : {}),
  };
}

export async function initRedis(): Promise<void> {
  const { cluster, host, port, password, url } = config.redis;

  if (cluster) {
    if (!host) throw new Error('REDIS_HOST is required for cluster mode');
    client = createCluster({
      rootNodes: [
        {
          socket: {
            host,
            port,
            ...buildTlsSocketOptions(host),
          },
        },
      ],
      defaults: {
        ...(password ? { password } : {}),
        socket: buildTlsSocketOptions(host),
      },
    });
  } else if (url) {
    client = createClient({
      url,
      ...(password ? { password } : {}),
    });
  } else if (host) {
    client = createClient({
      ...(password ? { password } : {}),
      socket: {
        host,
        port,
        ...buildTlsSocketOptions(host),
      },
    });
  } else {
    throw new Error('REDIS_URL or REDIS_HOST is not configured');
  }

  client.on('error', (err) => {
    console.error('[Redis] error:', err);
  });

  await client.connect();
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

function getClient(): RedisClient {
  if (!client || !ready) throw new Error('Redis client not initialized');
  return client;
}

export async function cacheSetJson<T>(
  key: string,
  value: T,
  ttlSeconds: number = config.redis.ttlSeconds
): Promise<void> {
  const c = getClient();
  await c.set(key, JSON.stringify(value), { EX: ttlSeconds });
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const c = getClient();
  const raw = await c.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

function tokenKey(jti: string): string {
  return `${TOKEN_KEY_PREFIX}${jti}`;
}

export async function allowlistToken(jti: string, ttlSeconds: number): Promise<void> {
  const c = getClient();
  await c.set(tokenKey(jti), '1', { EX: ttlSeconds });
}

export async function isTokenAllowlisted(jti: string): Promise<boolean> {
  const c = getClient();
  const exists = await c.exists(tokenKey(jti));
  return exists === 1;
}

