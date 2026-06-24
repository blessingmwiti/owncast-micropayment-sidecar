import type { NextFunction, Request, Response } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  maxRequests: number;
  windowMs: number;
}) {
  const buckets = new Map<string, RateLimitBucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const now = Date.now();
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + options.windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", String(options.maxRequests));
    res.setHeader(
      "RateLimit-Remaining",
      String(Math.max(0, options.maxRequests - bucket.count))
    );
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.maxRequests) {
      res.status(429).json({
        ok: false,
        error: "rate_limited"
      });
      return;
    }

    next();
  };
}
