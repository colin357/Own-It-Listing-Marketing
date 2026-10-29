import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Redis } from "@upstash/redis";
import type { Listing, LoanOfficer } from "./types";
import type { Detection } from "./detect/types";

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
