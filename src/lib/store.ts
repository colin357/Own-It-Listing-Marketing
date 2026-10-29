import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Listing, LoanOfficer } from "./types";
import type { Detection, SourceListing } from "./detect/types";

/**
 * Persistence layer.
 *
 * - Production (Vercel): Upstash Redis, added from the Vercel Marketplace.
 *   The integration injects KV_REST_API_URL / KV_REST_API_TOKEN (or the
 *   UPSTASH_REDIS_REST_* equivalents) automatically.
 * - Local dev / demo: JSON files under ./data. Read-only once deployed.
 */

interface Collection<T extends { slug: string; createdAt: string }> {
  get(slug: string): Promise<T | null>;
  list(): Promise<T[]>;
  save(item: T): Promise<void>;
  remove(slug: string): Promise<void>;
}

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export const storageMode = redis ? "redis" : "files";

function redisCollection<T extends { slug: string; createdAt: string }>(prefix: string): Collection<T> {
  const r = redis!;
  const key = (slug: string) => `${prefix}:${slug}`;
  const index = `${prefix}:index`;
  return {
    async get(slug) {
      return (await r.get<T>(key(slug))) ?? null;
    },
    async list() {
      const slugs = await r.zrange<string[]>(index, 0, -1, { rev: true });
      if (!slugs.length) return [];
      const items = await r.mget<(T | null)[]>(...slugs.map(key));
      return items.filter((x): x is T => !!x);
    },
    async save(item) {
      await r
        .multi()
        .set(key(item.slug), item)
        .zadd(index, { score: Date.parse(item.createdAt) || Date.now(), member: item.slug })
        .exec();
    },
    async remove(slug) {
      await r.multi().del(key(slug)).zrem(index, slug).exec();
    },
  };
}

function fileCollection<T extends { slug: string; createdAt: string }>(dir: string): Collection<T> {
  const root = path.join(process.cwd(), "data", dir);
  const file = (slug: string) => path.join(root, `${slug.replace(/[^a-z0-9-]/g, "")}.json`);
  const assertWritable = () => {
    if (process.env.VERCEL)
      throw new Error(
        "No database configured. Add Upstash Redis to this project from the Vercel Marketplace (Storage tab), then redeploy.",
      );
  };
  return {
    async get(slug) {
      try {
        return JSON.parse(await fs.readFile(file(slug), "utf8")) as T;
      } catch {
        return null;
      }
    },
    async list() {
      let names: string[] = [];
      try {
        names = (await fs.readdir(root)).filter((n) => n.endsWith(".json"));
      } catch {
        return [];
      }
      const items = await Promise.all(
        names.map(async (n) => JSON.parse(await fs.readFile(path.join(root, n), "utf8")) as T),
      );
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async save(item) {
      assertWritable();
      await fs.mkdir(root, { recursive: true });
      await fs.writeFile(file(item.slug), JSON.stringify(item, null, 2) + "\n");
    },
    async remove(slug) {
      assertWritable();
      await fs.rm(file(slug), { force: true });
    },
  };
}

export const listings: Collection<Listing> = redis
  ? redisCollection<Listing>("listing")
  : fileCollection<Listing>("listings");

export const loanOfficers: Collection<LoanOfficer> = redis
  ? redisCollection<LoanOfficer>("lo")
  : fileCollection<LoanOfficer>("loan-officers");

export const detections: Collection<Detection> = redis
  ? redisCollection<Detection>("detection")
  : fileCollection<Detection>("detections");

/**
 * Single JSON documents (the agent roster, metros, last detection run).
 * Stored as one Redis key each, or data/<name>.json locally.
 */
export const documents = {
  async get<T>(name: string): Promise<T | null> {
    if (redis) return (await redis.get<T>(`doc:${name}`)) ?? null;
    try {
      return JSON.parse(await fs.readFile(path.join(process.cwd(), "data", `${name}.json`), "utf8")) as T;
    } catch {
      return null;
    }
  },
  async set<T>(name: string, value: T): Promise<void> {
    if (redis) {
      await redis.set(`doc:${name}`, value);
      return;
    }
    if (process.env.VERCEL)
      throw new Error("No database configured. Add Upstash Redis to this project, then redeploy.");
    await fs.mkdir(path.join(process.cwd(), "data"), { recursive: true });
    await fs.writeFile(path.join(process.cwd(), "data", `${name}.json`), JSON.stringify(value, null, 2) + "\n");
  },
};

/** Returns `base`, or `base-2`, `base-3`… if taken by a different record. */
export async function uniqueSlug<T extends { slug: string; createdAt: string }>(
  collection: Collection<T>,
  base: string,
): Promise<string> {
  let slug = base;
  for (let i = 2; await collection.get(slug); i++) slug = `${base}-${i}`;
  return slug;
}

/**
 * Every listing a detection run sees, keyed by MLS number, so a loan officer
 * can build a kit from an MLS # without another feed request. Entries expire
 * after MLS_INDEX_DAYS. Locally it's one JSON file.
 */
const MLS_INDEX_DAYS = 60;
const MLS_INDEX_FILE = path.join(process.cwd(), "data", "mls-index.json");

async function readMlsFile(): Promise<Record<string, SourceListing>> {
  try {
    return JSON.parse(await fs.readFile(MLS_INDEX_FILE, "utf8"));
  } catch {
    return {};
  }
}

export const mlsIndex = {
  async get(key: string): Promise<SourceListing | null> {
    if (redis) return (await redis.get<SourceListing>(`mls:${key}`)) ?? null;
    return (await readMlsFile())[key] ?? null;
  },
  async putMany(entries: [key: string, listing: SourceListing][]): Promise<void> {
    if (!entries.length) return;
    if (redis) {
      // Pipelined in chunks so one run of ~20k listings is a few dozen requests.
      for (let i = 0; i < entries.length; i += 500) {
        const p = redis.pipeline();
        for (const [key, l] of entries.slice(i, i + 500)) p.set(`mls:${key}`, l, { ex: MLS_INDEX_DAYS * 86_400 });
        await p.exec();
      }
      return;
    }
    if (process.env.VERCEL) return;
    const all = await readMlsFile();
    for (const [key, l] of entries) all[key] = l;
    await fs.mkdir(path.dirname(MLS_INDEX_FILE), { recursive: true });
    await fs.writeFile(MLS_INDEX_FILE, JSON.stringify(all));
  },
};

/** Adds one to today's (UTC) counter for `name` and returns the new count. */
export async function countToday(name: string): Promise<number> {
  const key = `count:${name}:${new Date().toISOString().slice(0, 10)}`;
  if (redis) {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, 2 * 86_400);
    return n;
  }
  return 1;
}
