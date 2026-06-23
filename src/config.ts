import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  OWNCAST_URL: z.string().url().default("http://localhost:8080"),
  OWNCAST_WEBHOOK_SECRET: z.string().optional(),
  CIRCLE_API_KEY: z.string().optional(),
  CIRCLE_GATEWAY_URL: z
    .string()
    .url()
    .default("https://gateway-api-testnet.circle.com"),
  CREATOR_WALLET_ADDRESS: z.string().optional(),
  ARC_TESTNET_RPC: z.string().url().optional(),
  LEDGER_FILE: z.string().default("data/ledger.json"),
  BASE_RATE_PER_SECOND: z.coerce.number().positive().default(0.001),
  MIN_RATE_PER_SECOND: z.coerce.number().positive().default(0.0005),
  MAX_RATE_PER_SECOND: z.coerce.number().positive().default(0.003)
});

export const config = envSchema.parse(process.env);
