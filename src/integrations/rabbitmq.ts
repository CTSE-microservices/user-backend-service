import amqplib, { Channel, ChannelModel, ConsumeMessage } from 'amqplib';
import { config } from '../config';

export type UserRegisteredEvent = {
  type: 'UserRegistered';
  timestamp: string;
  payload: {
    userId: number;
    email: string;
    roleId: number;
    userChannelId: number;
  };
};

const DEFAULT_CONTENT_TYPE = 'application/json';

/** Result of amqplib.connect() — has createChannel(); not the inner Connection socket type */
let connection: ChannelModel | null = null;
let channel: Channel | null = null;
let ready = false;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function connect(): Promise<void> {
  const url = config.rabbitmq.url;
  if (!url) throw new Error('RABBITMQ_URL is not configured');

  // Retry a little because in docker-compose, RabbitMQ may not be ready yet.
  const retries = config.rabbitmq.connectRetries;
  const retryDelayMs = config.rabbitmq.connectRetryDelayMs;

  let lastErr: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      connection = await amqplib.connect(url);
      channel = await connection.createChannel();

      // Setup exchange + queue for UserRegistered events
      await channel.assertExchange(config.rabbitmq.exchange, 'direct', {
        durable: true,
      });
      await channel.assertQueue(config.rabbitmq.userRegisteredQueue, {
        durable: true,
      });
      await channel.bindQueue(
        config.rabbitmq.userRegisteredQueue,
        config.rabbitmq.exchange,
        config.rabbitmq.userRegisteredRoutingKey
      );

      ready = true;
      return;
    } catch (err) {
      lastErr = err;
      await delay(retryDelayMs);
    }
  }

  throw lastErr ?? new Error('Failed to connect to RabbitMQ');
}

async function getChannel(): Promise<Channel> {
  if (ready && channel) return channel;
  await connect();
  if (!channel) throw new Error('RabbitMQ channel not initialized');
  return channel;
}

export function isRabbitMQReady(): boolean {
  return ready;
}

export async function publishUserRegistered(
  payload: UserRegisteredEvent['payload']
): Promise<void> {
  const ch = await getChannel();
  const event: UserRegisteredEvent = {
    type: 'UserRegistered',
    timestamp: new Date().toISOString(),
    payload,
  };

  const body = Buffer.from(JSON.stringify(event), 'utf-8');
  ch.publish(config.rabbitmq.exchange, config.rabbitmq.userRegisteredRoutingKey, body, {
    contentType: DEFAULT_CONTENT_TYPE,
    persistent: true,
  });
}

export async function startUserRegisteredConsumer(
  handler: (event: UserRegisteredEvent) => Promise<void>
): Promise<void> {
  const ch = await getChannel();

  await ch.consume(
    config.rabbitmq.userRegisteredQueue,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;
      try {
        const raw = msg.content.toString('utf-8');
        const parsed = JSON.parse(raw) as UserRegisteredEvent;
        await handler(parsed);
        ch.ack(msg);
      } catch (err) {
        // Do not requeue malformed messages; beginner-friendly "log and ack".
        // In production you would use a DLQ.
        console.error('RabbitMQ consumer error:', err);
        ch.ack(msg);
      }
    },
    { noAck: false }
  );
}

export async function initRabbitMQ(): Promise<void> {
  await connect();

  if (config.rabbitmq.enableUserRegisteredConsumer) {
    await startUserRegisteredConsumer(async (event) => {
      console.log('[RabbitMQ] Received event:', event.type, event.payload.userId);
    });
  }
}

export async function shutdownRabbitMQ(): Promise<void> {
  ready = false;
  try {
    await channel?.close();
  } catch {
    // ignore
  }
  try {
    await connection?.close();
  } catch {
    // ignore
  }
  channel = null;
  connection = null;
}

