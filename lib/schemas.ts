import { z } from "zod";
import { env } from "./env";

export const invoiceItemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional().default(""),
  quantity: z
    .number()
    .positive("Quantity must be greater than 0")
    .default(1),
  unit_price: z
    .number()
    .nonnegative("Unit price cannot be negative"),
});

export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;

export const parsedInvoiceSchema = z.object({
  client_name: z.string().default(""),
  client_email: z
    .string()
    .email("Invalid client email format")
    .optional()
    .nullable()
    .or(z.literal("")),
  currency: z
    .string()
    .length(3, "Currency must be a 3-letter ISO code")
    .toUpperCase()
    .default(env.DEFAULT_CURRENCY || "USD"),
  items: z.array(invoiceItemSchema).default([]),
  due_in_days: z.number().int().nonnegative().optional().nullable(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "due_date must be formatted as YYYY-MM-DD")
    .optional()
    .nullable(),
  notes: z.string().optional().default(""),
  missing_fields: z.array(z.string()).default([]),
  confidence: z
    .number()
    .min(0, "Confidence must be >= 0")
    .max(1, "Confidence must be <= 1")
    .default(0.5),
});

export type ParsedInvoice = z.infer<typeof parsedInvoiceSchema>;

export const parseRequestSchema = z.object({
  prompt: z
    .string({ required_error: "Invoice prompt text is required" })
    .trim()
    .min(1, "Prompt cannot be empty"),
});

export type ParseRequest = z.infer<typeof parseRequestSchema>;
