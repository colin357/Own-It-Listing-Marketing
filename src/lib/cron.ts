import "server-only";
import { isAuthorizedApiRequest } from "./auth";

/** Vercel Cron sends "Authorization: Bearer $CRON_SECRET"; the API key works for manual calls. */
export function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return isAuthorizedApiRequest(req);
}

export const fromVercelCron = (req: Request) => !!req.headers.get("user-agent")?.startsWith("vercel-cron");

/** Current hour (0-23) in New York. Vercel Cron runs in UTC, so routes fire at two UTC hours and check this. */
export function newYorkHour(): number {
  const hour = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }).format(new Date());
  return Number(hour);
}
