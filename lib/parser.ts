import { getLLMProvider, LLMProvider } from "./llm";
import {
  buildParserUserPrompt,
  geminiInvoiceResponseSchema,
  INVOICE_PARSER_SYSTEM_INSTRUCTION,
} from "./prompts";
import { ParsedInvoice, parsedInvoiceSchema } from "./schemas";
import { env } from "./env";

export interface ParseInvoiceOptions {
  referenceDate?: string; // YYYY-MM-DD
  provider?: LLMProvider;
}

export interface ParseInvoiceResult {
  invoice: ParsedInvoice;
  modelUsed: string;
  usage?: {
    promptTokens: number;
    candidatesTokens: number;
    totalTokens: number;
  };
}

/**
 * Parses free-form user text into a structured ParsedInvoice.
 * Handles validation retries (1 retry if Zod validation fails).
 */
export async function parseInvoice(
  userInput: string,
  options: ParseInvoiceOptions = {}
): Promise<ParseInvoiceResult> {
  const trimmedInput = userInput.trim();

  // Reference date defaults to today
  const referenceDate =
    options.referenceDate || new Date().toISOString().split("T")[0];
  const provider = options.provider || getLLMProvider();
  const defaultCurrency = env.DEFAULT_CURRENCY || "USD";

  // Fast-path: empty input returns immediate default missing state
  if (!trimmedInput) {
    return {
      invoice: {
        client_name: "",
        client_email: null,
        currency: defaultCurrency,
        items: [],
        due_in_days: null,
        due_date: null,
        notes: "",
        missing_fields: ["client_name", "client_email", "items", "amount", "due_date"],
        confidence: 0,
      },
      modelUsed: "local-fast-path",
    };
  }

  // Attempt 1
  try {
    const userPrompt = buildParserUserPrompt({
      userInput: trimmedInput,
      referenceDate,
      defaultCurrency,
    });

    const result = await provider.generateStructured<ParsedInvoice>({
      prompt: userPrompt,
      systemInstruction: INVOICE_PARSER_SYSTEM_INSTRUCTION,
      responseSchema: geminiInvoiceResponseSchema,
      validate: (rawJson) => postProcessInvoice(parsedInvoiceSchema.parse(rawJson), referenceDate),
    });

    return {
      invoice: result.data,
      modelUsed: result.modelUsed,
      usage: result.usage,
    };
  } catch (firstError: any) {
    // If it's a rate limit error (BusyAIError), propagate immediately without burning retries
    if (firstError.name === "BusyAIError") {
      throw firstError;
    }

    console.warn(
      `⚠️ First invoice parse attempt failed validation (${firstError.message}). Retrying once with error feedback...`
    );

    // Attempt 2: Retry with validation error feedback appended
    try {
      const retryPrompt = buildParserUserPrompt({
        userInput: trimmedInput,
        referenceDate,
        defaultCurrency,
        validationError: firstError.message,
      });

      const retryResult = await provider.generateStructured<ParsedInvoice>({
        prompt: retryPrompt,
        systemInstruction: INVOICE_PARSER_SYSTEM_INSTRUCTION,
        responseSchema: geminiInvoiceResponseSchema,
        validate: (rawJson) =>
          postProcessInvoice(parsedInvoiceSchema.parse(rawJson), referenceDate),
      });

      return {
        invoice: retryResult.data,
        modelUsed: retryResult.modelUsed,
        usage: retryResult.usage,
      };
    } catch (secondError: any) {
      if (secondError.name === "BusyAIError") {
        throw secondError;
      }

      console.error("❌ Second invoice parse attempt also failed:", secondError);
      throw new Error(
        "Unable to accurately parse your invoice description. Please clarify the details and try again."
      );
    }
  }
}

/**
 * Post-processes and normalizes parsed invoice data:
 * - Ensures missing essential fields are recorded in missing_fields.
 * - Synchronizes due_date and due_in_days if one is present and the other is not.
 */
export function postProcessInvoice(
  invoice: ParsedInvoice,
  referenceDate: string
): ParsedInvoice {
  const missing = new Set<string>(invoice.missing_fields || []);

  // Client name check
  if (!invoice.client_name || invoice.client_name.trim().length === 0) {
    invoice.client_name = "";
    missing.add("client_name");
  }

  // Client email check
  if (!invoice.client_email || invoice.client_email.trim().length === 0) {
    invoice.client_email = null;
    missing.add("client_email");
  }

  // Items check
  if (!invoice.items || invoice.items.length === 0) {
    invoice.items = [];
    missing.add("items");
    missing.add("amount");
  } else {
    // Check if any item has missing or 0 price
    const hasZeroPrice = invoice.items.some((item) => item.unit_price <= 0);
    if (hasZeroPrice) {
      missing.add("amount");
    }
  }

  // Date synchronization
  const refDateObj = new Date(referenceDate + "T00:00:00Z");

  if (
    invoice.due_in_days !== undefined &&
    invoice.due_in_days !== null &&
    !invoice.due_date
  ) {
    const calculated = new Date(
      refDateObj.getTime() + invoice.due_in_days * 24 * 60 * 60 * 1000
    );
    invoice.due_date = calculated.toISOString().split("T")[0];
  } else if (
    invoice.due_date &&
    (invoice.due_in_days === undefined || invoice.due_in_days === null)
  ) {
    const targetDateObj = new Date(invoice.due_date + "T00:00:00Z");
    const diffMs = targetDateObj.getTime() - refDateObj.getTime();
    invoice.due_in_days = Math.max(0, Math.round(diffMs / (24 * 60 * 60 * 1000)));
  }

  if (!invoice.due_date && !invoice.due_in_days) {
    missing.add("due_date");
  }

  invoice.missing_fields = Array.from(missing);
  return invoice;
}
