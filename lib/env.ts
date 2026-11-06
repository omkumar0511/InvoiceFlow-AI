import { config } from "dotenv";
import { z } from "zod";

// Load environment variables from .env if running in Node/scripts
config();

// Helper to check if a value is a real secret or a placeholder/empty
function isPlaceholderOrEmpty(val?: string | null): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    trimmed === "" ||
    trimmed.startsWith("your_") ||
    trimmed === "placeholder" ||
    trimmed === "demo"
  );
}

// Determine if Demo Mode should be active automatically
const rawDemoMode = (process.env.DEMO_MODE || "").toLowerCase() === "true";
const missingCredentials =
  isPlaceholderOrEmpty(process.env.PAYPAL_CLIENT_ID) ||
  isPlaceholderOrEmpty(process.env.PAYPAL_CLIENT_SECRET) ||
  isPlaceholderOrEmpty(process.env.GEMINI_API_KEY);

export const isDemoMode = rawDemoMode || missingCredentials;

const envSchema = z.object({
  PAYPAL_CLIENT_ID: z.string().trim().default("demo_paypal_client_id"),
  PAYPAL_CLIENT_SECRET: z.string().trim().default("demo_paypal_client_secret"),
  PAYPAL_BASE_URL: z
    .string()
    .trim()
    .url("PAYPAL_BASE_URL must be a valid URL")
    .default("https://api-m.sandbox.paypal.com"),
  GEMINI_API_KEY: z.string().trim().default("demo_gemini_api_key"),
  LLM_MODEL: z.string().trim().default("gemini-3-flash-preview"),
  BUSINESS_NAME: z.string().trim().default("InvoiceFlow Studio"),
  BUSINESS_EMAIL: z
    .string()
    .trim()
    .email("BUSINESS_EMAIL must be a valid email address")
    .default("billing@invoiceflow.demo"),
  DEFAULT_CURRENCY: z
    .string()
    .trim()
    .min(3, "DEFAULT_CURRENCY must be a 3-letter currency code (e.g. USD)")
    .default("USD"),
  DEMO_MODE: z.boolean().default(isDemoMode),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  // If in Real Mode, validate credentials strictly
  if (!isDemoMode) {
    const strictSchema = envSchema.extend({
      PAYPAL_CLIENT_ID: z
        .string()
        .min(1, "PAYPAL_CLIENT_ID cannot be empty in Real Mode"),
      PAYPAL_CLIENT_SECRET: z
        .string()
        .min(1, "PAYPAL_CLIENT_SECRET cannot be empty in Real Mode"),
      GEMINI_API_KEY: z
        .string()
        .min(1, "GEMINI_API_KEY cannot be empty in Real Mode"),
    });

    const parsed = strictSchema.safeParse({
      ...process.env,
      DEMO_MODE: isDemoMode,
    });

    if (!parsed.success) {
      const errorDetails = parsed.error.issues
        .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
        .join("\n");
      throw new Error(
        `❌ Environment validation error:\n${errorDetails}\nPlease verify your .env file or enable DEMO_MODE=true.`
      );
    }

    return parsed.data;
  }

  // In Demo Mode, parse with safe defaults
  const parsed = envSchema.safeParse({
    ...process.env,
    DEMO_MODE: true,
  });

  if (!parsed.success) {
    return {
      PAYPAL_CLIENT_ID: "demo_paypal_client_id",
      PAYPAL_CLIENT_SECRET: "demo_paypal_client_secret",
      PAYPAL_BASE_URL: "https://api-m.sandbox.paypal.com",
      GEMINI_API_KEY: "demo_gemini_api_key",
      LLM_MODEL: "gemini-3-flash-preview",
      BUSINESS_NAME: "InvoiceFlow Studio",
      BUSINESS_EMAIL: "billing@invoiceflow.demo",
      DEFAULT_CURRENCY: "USD",
      DEMO_MODE: true,
    };
  }

  return parsed.data;
}

export const env = loadEnv();
