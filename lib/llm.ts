import { GoogleGenAI } from "@google/genai";
import { env } from "./env";

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
          errorMessage.includes("Too Many Requests");

        if (isTransientError) {
          attempts++;
          if (attempts > maxRetries) {
            console.error(`❌ Gemini transient error reached after ${maxRetries} retries.`);
            throw new BusyAIError("AI is busy, please try again in a moment.");
          }

          console.warn(
            `⚠️ Gemini transient error (${statusCode || "busy"}). Retrying in ${delayMs}ms (Attempt ${attempts}/${maxRetries})...`
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          delayMs *= 2; // Exponential backoff (1s -> 2s -> 4s)
          continue;
        }

        // Other errors bubble up
        throw error;
      }
    }

    throw new BusyAIError("AI is busy, please try again in a moment.");
  }

  private async callGemini<T>(
    model: string,
    options: LLMGenerateOptions<T>
  ): Promise<LLMResponse<T>> {
    const config: any = {
      responseMimeType: "application/json",
      systemInstruction: options.systemInstruction,
    };

    if (options.responseSchema) {
      config.responseSchema = options.responseSchema;
    }

    const response = await this.ai.models.generateContent({
      model,
      contents: options.prompt,
      config,
    });

    const rawText = response.text || "";

    // Extract token usage
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

// Default provider instance
let defaultProvider: LLMProvider = new GeminiLLMProvider();

export function getLLMProvider(): LLMProvider {
  return defaultProvider;
}

export function setLLMProvider(provider: LLMProvider): void {
  defaultProvider = provider;
}
