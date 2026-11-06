import { GoogleGenAI } from "@google/genai";
import { env, isDemoMode } from "./env";

export interface TokenUsage {
  promptTokens: number;
  candidatesTokens: number;
  totalTokens: number;
}

export interface LLMResponse<T> {
  data: T;
  rawText: string;
  usage?: TokenUsage;
  modelUsed: string;
}

export interface LLMGenerateOptions<T> {
  prompt: string;
  systemInstruction?: string;
  responseSchema?: any;
  validate: (rawJson: unknown) => T;
}

export interface LLMProvider {
  generateStructured<T>(
    options: LLMGenerateOptions<T>
  ): Promise<LLMResponse<T>>;
}

export class BusyAIError extends Error {
  constructor(message = "AI is busy, please try again in a moment.") {
    super(message);
    this.name = "BusyAIError";
  }
}

/**
 * Deterministic Mock LLM for Demo Mode.
 * Accurately parses the 3 example prompts, AI reminders, business summary,
 * and handles custom inputs predictably without requiring API keys.
 */
export class MockLLMProvider implements LLMProvider {
  async generateStructured<T>(
    options: LLMGenerateOptions<T>
  ): Promise<LLMResponse<T>> {
    const prompt = options.prompt || "";
    let mockResult: any;

    // Check for AI reminder prompt
    if (
      prompt.includes("friendly") ||
      prompt.includes("neutral") ||
      prompt.includes("firm") ||
      prompt.includes("tone") ||
      prompt.includes("days overdue")
    ) {
      if (prompt.toLowerCase().includes("firm")) {
        mockResult = {
          subject: "Urgent: Payment Past Due Notice",
          message:
            "Dear Client, this is an urgent reminder that your invoice is now past due. Please remit payment immediately via the secure PayPal link below to avoid service interruption.",
        };
      } else if (prompt.toLowerCase().includes("neutral")) {
        mockResult = {
          subject: "Payment Reminder: Outstanding Invoice",
          message:
            "Hello, this is a courtesy reminder regarding your outstanding invoice. Please review the details and arrange for payment at your earliest convenience.",
        };
      } else {
        mockResult = {
          subject: "Friendly Reminder: Invoice Payment",
          message:
            "Hi there! Just a quick and friendly reminder that your invoice is due soon. Let us know if you have any questions or need anything adjusted. Thank you for your business!",
        };
      }
    }
    // Check for AI business summary prompt
    else if (
      prompt.includes("Total invoiced") ||
      prompt.includes("financial stats") ||
      prompt.includes("narrative") ||
      prompt.includes("Precomputed Financial Statistics")
    ) {
      mockResult = {
        narrative:
          "Business cash flow remains healthy with consistent invoicing activity across clients. Collections on paid invoices are solid, and active receivables are actively tracked with manageable aging.",
        suggestion:
          "Send a friendly payment reminder for any overdue invoices to accelerate collections and keep cash flow predictable.",
      };
    }
    // Example Prompt 1: Rahul Mehta
    else if (
      prompt.includes("Rahul Mehta") ||
      prompt.includes("logo design") ||
      prompt.includes("rahul@example.com")
    ) {
      mockResult = {
        client_name: "Rahul Mehta",
        client_email: "rahul@example.com",
        currency: "USD",
        items: [
          {
            name: "Logo design",
            quantity: 1,
            unit_price: 450,
          },
          {
            name: "Revisions",
            description: "Two design revisions",
            quantity: 2,
            unit_price: 60,
          },
        ],
        due_in_days: 15,
        notes: "Thank you for partnering on your brand identity!",
        confidence: 0.98,
        missing_fields: [],
      };
    }
    // Example Prompt 2: TechStudio Inc
    else if (
      prompt.includes("TechStudio") ||
      prompt.includes("techstudio.io") ||
      prompt.includes("fullstack") ||
      prompt.includes("40 hours")
    ) {
      mockResult = {
        client_name: "TechStudio Inc",
        client_email: "finance@techstudio.io",
        currency: "USD",
        items: [
          {
            name: "Fullstack web development",
            description: "Hourly consulting (40 hours at $85/hr)",
            quantity: 40,
            unit_price: 85,
          },
        ],
        due_in_days: 30,
        notes: "Net 30 terms. Milestones completed for sprint 4.",
        confidence: 0.99,
        missing_fields: [],
      };
    }
    // Example Prompt 3: Sophie Laurent
    else if (
      prompt.includes("Sophie Laurent") ||
      prompt.includes("design.fr") ||
      prompt.includes("audit") ||
      prompt.includes("guidelines")
    ) {
      mockResult = {
        client_name: "Sophie Laurent",
        client_email: "sophie.l@design.fr",
        currency: "EUR",
        items: [
          {
            name: "UI/UX audit",
            quantity: 1,
            unit_price: 750,
          },
          {
            name: "Design system guidelines",
            quantity: 1,
            unit_price: 250,
          },
        ],
        due_in_days: 10,
        notes: "Comprehensive heuristic UX review and style guide deliverable.",
        confidence: 0.98,
        missing_fields: [],
      };
    }
    // Generic Fallback / Custom Invoice prompt in Demo Mode
    else {
      // Extract email if present
      const emailMatch = prompt.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );
      // Extract amounts if present
      const amountMatches = prompt.match(/(?:[$€£]\s*|\b)([0-9]+(?:\.[0-9]{2})?)/g);
      const parsedAmount =
        amountMatches && amountMatches.length > 0
          ? parseFloat(amountMatches[0].replace(/[^0-9.]/g, ""))
          : 250;

      // Extract client name if preceded by "Invoice" or "Bill"
      const nameMatch = prompt.match(/(?:invoice|bill)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/i);
      const clientName = nameMatch ? nameMatch[1] : "Client Partner";

      mockResult = {
        client_name: clientName,
        client_email: emailMatch ? emailMatch[0] : "client@example.com",
        currency: prompt.includes("€") || prompt.toLowerCase().includes("eur") ? "EUR" : "USD",
        items: [
          {
            name: "Consulting & Deliverables",
            description: prompt.slice(0, 80),
            quantity: 1,
            unit_price: parsedAmount || 250,
          },
        ],
        due_in_days: 14,
        notes: "Generated with InvoiceFlow Demo Mode",
        confidence: 0.92,
        missing_fields: emailMatch ? [] : ["client_email"],
      };
    }

    const rawText = JSON.stringify(mockResult);
    const data = options.validate(mockResult);

    const usage: TokenUsage = {
      promptTokens: Math.max(10, Math.floor(prompt.length / 4)),
      candidatesTokens: 48,
      totalTokens: Math.max(10, Math.floor(prompt.length / 4)) + 48,
    };

    return {
      data,
      rawText,
      usage,
      modelUsed: "mock-deterministic-gemini",
    };
  }
}

export class GeminiLLMProvider implements LLMProvider {
  private ai: GoogleGenAI;
  private primaryModel: string;
  private fallbackModel: string;

  constructor(params?: {
    apiKey?: string;
    model?: string;
    fallbackModel?: string;
  }) {
    const apiKey = params?.apiKey || env.GEMINI_API_KEY;
    this.primaryModel = params?.model || env.LLM_MODEL || "gemini-3-flash-preview";
    this.fallbackModel = params?.fallbackModel || "gemini-2.5-flash";

    this.ai = new GoogleGenAI({
      apiKey,
      apiVersion: "v1beta",
    });
  }

  /**
   * Generates structured data using Gemini with exponential backoff on 429
   * and fallback model support.
   */
  async generateStructured<T>(
    options: LLMGenerateOptions<T>
  ): Promise<LLMResponse<T>> {
    let currentModel = this.primaryModel;
    let attempts = 0;
    const maxRetries = 3;
    let delayMs = 1000;

    while (attempts <= maxRetries) {
      try {
        const response = await this.callGemini(currentModel, options);
        return response;
      } catch (error: any) {
        const errorMessage = error?.message || String(error);
        const statusCode = error?.status || error?.code || error?.statusCode;

        // Check for 404 / unsupported model to trigger fallback
        const isModelNotFoundError =
          statusCode === 404 ||
          errorMessage.includes("404") ||
          errorMessage.includes("not found") ||
          errorMessage.includes("not supported") ||
          errorMessage.includes("no longer available");

        if (isModelNotFoundError && currentModel === this.primaryModel) {
          console.warn(
            `⚠️ Model '${this.primaryModel}' unsupported or not found. Falling back to '${this.fallbackModel}'. Warning: ${errorMessage}`
          );
          currentModel = this.fallbackModel;
          // Retry immediately with the fallback model
          continue;
        }

        // Check for 429 / 503 / Rate limit / High demand spikes
        const isTransientError =
          statusCode === 429 ||
          statusCode === 503 ||
          errorMessage.includes("429") ||
          errorMessage.includes("503") ||
          errorMessage.includes("RESOURCE_EXHAUSTED") ||
          errorMessage.includes("UNAVAILABLE") ||
          errorMessage.includes("high demand") ||
          errorMessage.includes("rate limit");

        if (isTransientError) {
          attempts++;
          if (attempts > maxRetries) {
            console.error(
              `❌ Exhausted retries for transient AI error (${statusCode || "TRANSIENT"}). Surfacing BusyAIError.`
            );
            throw new BusyAIError();
          }

          console.warn(
            `⏳ AI service busy/rate-limited (attempt ${attempts}/${maxRetries}). Retrying in ${delayMs}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff: 1s, 2s, 4s
          continue;
        }

        // Re-throw non-retryable errors
        throw error;
      }
    }

    throw new BusyAIError();
  }

  private async callGemini<T>(
    model: string,
    options: LLMGenerateOptions<T>
  ): Promise<LLMResponse<T>> {
    const config: any = {
      responseMimeType: "application/json",
    };

    if (options.systemInstruction) {
      config.systemInstruction = options.systemInstruction;
    }

    if (options.responseSchema) {
      config.responseSchema = options.responseSchema;
    }

    const response = await this.ai.models.generateContent({
      model,
      contents: options.prompt,
      config,
    });

    const rawText = response.text || "";
    if (!rawText.trim()) {
      throw new Error("Received empty response from Gemini API");
    }

    const usageMetadata = response.usageMetadata;
    const usage: TokenUsage | undefined = usageMetadata
      ? {
          promptTokens: usageMetadata.promptTokenCount ?? 0,
          candidatesTokens: usageMetadata.candidatesTokenCount ?? 0,
          totalTokens: usageMetadata.totalTokenCount ?? 0,
        }
      : undefined;

    if (usage) {
      console.log(
        `[LLM Usage] Model: ${model} | Prompt Tokens: ${usage.promptTokens} | Candidate Tokens: ${usage.candidatesTokens} | Total: ${usage.totalTokens}`
      );
    }

    // Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawText);
    } catch (parseError: any) {
      throw new Error(
        `Failed to parse LLM JSON output: ${parseError.message}\nRaw Text: ${rawText}`
      );
    }

    // Validate with provided validator (e.g. Zod)
    const data = options.validate(parsedJson);

    return {
      data,
      rawText,
      usage,
      modelUsed: model,
    };
  }
}

// Default provider instance: MockLLMProvider when in Demo Mode, GeminiLLMProvider otherwise
let defaultProvider: LLMProvider = isDemoMode
  ? new MockLLMProvider()
  : new GeminiLLMProvider();

export function getLLMProvider(): LLMProvider {
  return defaultProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  defaultProvider = provider;
}
