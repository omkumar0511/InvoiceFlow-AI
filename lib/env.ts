import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env if running in Node/scripts
config();

const envSchema = z.object({
  PAYPAL_CLIENT_ID: z
    .string({ required_error: "PAYPAL_CLIENT_ID is required in .env" })
    .trim()
    .min(1, "PAYPAL_CLIENT_ID cannot be empty"),
  PAYPAL_CLIENT_SECRET: z
    .string({ required_error: "PAYPAL_CLIENT_SECRET is required in .env" })
    .trim()
    .min(1, "PAYPAL_CLIENT_SECRET cannot be empty"),
  PAYPAL_BASE_URL: z
    .string()
    .trim()
    .url("PAYPAL_BASE_URL must be a valid URL")
    .default("https://api-m.sandbox.paypal.com"),
  GEMINI_API_KEY: z
    .string({ required_error: "GEMINI_API_KEY is required in .env" })
    .trim()
    .min(1, "GEMINI_API_KEY cannot be empty"),
  LLM_MODEL: z
    .string()
    .trim()
    .default("gemini-3-flash-preview"),
  BUSINESS_NAME: z
    .string({ required_error: "BUSINESS_NAME is required in .env" })
    .trim()
    .min(1, "BUSINESS_NAME cannot be empty"),
  BUSINESS_EMAIL: z
    .string({ required_error: "BUSINESS_EMAIL is required in .env" })
    .trim()
    .email("BUSINESS_EMAIL must be a valid email address"),
  DEFAULT_CURRENCY: z
    .string()
    .trim()
    .min(3, "DEFAULT_CURRENCY must be a 3-letter currency code (e.g. USD)")
    .default("USD"),
  DEMO_MODE: z
    .string()
    .trim()
    .default("false")
    .transform((val) => val.toLowerCase() === "true"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // Support both process.env and any parsed values
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `❌ Environment validation error:\n${errorDetails}\nPlease verify your .env file.`
    );
  }

  return parsed.data;
}

export const env = loadEnv();
