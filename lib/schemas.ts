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

export const createInvoiceRequestSchema = z.object({
  client_name: z
    .string({ required_error: "Client name is required" })
    .trim()
    .min(1, "Client name cannot be empty"),
  client_email: z
    .string({ required_error: "Client email is required" })
    .trim()
    .email("A valid client email address is required"),
  currency: z
    .string()
    .trim()
    .length(3, "Currency code must be a 3-letter ISO code")
    .toUpperCase()
    .default(env.DEFAULT_CURRENCY || "USD"),
  due_date: z
    .string({ required_error: "Due date is required" })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be formatted as YYYY-MM-DD")
    .refine((date) => {
      const today = new Date().toISOString().split("T")[0];
      return date >= today;
    }, "Due date cannot be in the past"),
  notes: z.string().optional().default(""),
  items: z
    .array(invoiceItemSchema)
    .min(1, "Invoice must include at least one item"),
  send_now: z.boolean().default(false),
  original_prompt: z.string().optional().default(""),
});

export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;

// Reminder Schemas
export const draftReminderRequestSchema = z.object({
  tone: z.enum(["friendly", "neutral", "firm"]).default("friendly"),
});

export const reminderOutputSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

export type ReminderOutput = z.infer<typeof reminderOutputSchema>;

export const sendReminderBodySchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  message: z.string().trim().min(1, "Message body is required"),
});

// Business Summary Schema
export const businessSummarySchema = z.object({
  narrative: z.string().min(1),
  actionable_suggestion: z.string().min(1),
});

export type BusinessSummary = z.infer<typeof businessSummarySchema>;


