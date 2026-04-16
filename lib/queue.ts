import { Queue } from "bullmq";
import IORedis from "ioredis";

export const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

/** BullMQ-compatible connection hints (URL + ioredis defaults). */
export const redisConnectionOptions = {
  url: redisUrl,
  maxRetriesPerRequest: null as number | null,
};

let redisConnection: IORedis | null = null;
let scrapeQueue: Queue | null = null;
let notificationsQueue: Queue | null = null;
let alertMatchQueue: Queue | null = null;

const defaultJobRetries = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 30_000,
  },
};

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });
  }
  return redisConnection;
}

export function getScrapeQueue(): Queue {
  if (!scrapeQueue) {
    scrapeQueue = new Queue("scrape", {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobRetries,
    });
  }
  return scrapeQueue;
}

export function getNotificationsQueue(): Queue {
  if (!notificationsQueue) {
    notificationsQueue = new Queue("notifications", {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobRetries,
    });
  }
  return notificationsQueue;
}
export function getAlertMatchQueue(): Queue {
  if (!alertMatchQueue) {
    alertMatchQueue = new Queue("alertMatch", {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobRetries,
    });
  }
  return alertMatchQueue;
}

export function getReparseQueue(): Queue {
  if (!scrapeQueue) {
    scrapeQueue = new Queue("reparse", {
      connection: getRedisConnection(),
      defaultJobOptions: defaultJobRetries,
    });
  }
  return scrapeQueue;
}
