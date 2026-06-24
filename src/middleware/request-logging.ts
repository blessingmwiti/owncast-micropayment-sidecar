import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

type LogLevel = "info" | "error";

function log(level: LogLevel, message: string, fields: Record<string, unknown>) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields
  };

  const serialized = JSON.stringify(entry);
  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId = req.header("x-request-id") ?? randomUUID();
    const startedAt = Date.now();

    res.setHeader("x-request-id", requestId);

    res.on("finish", () => {
      log("info", "http_request", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt
      });
    });

    next();
  };
}

export function logError(error: unknown, requestId?: string) {
  log("error", "unhandled_error", {
    requestId,
    error: error instanceof Error ? error.message : String(error)
  });
}
