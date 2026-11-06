import { describe, it, expect } from "vitest";
import { POST } from "../app/api/parse/route";
import { NextRequest } from "next/server";
import { setLLMProvider } from "../lib/llm";

describe("API /api/parse Route Handler", () => {
  it("should return 400 when prompt is missing or empty", async () => {
    const req = new NextRequest("http://localhost:3000/api/parse", {
      method: "POST",
      body: JSON.stringify({ prompt: "" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
  });

  it("should return 200 with parsed invoice on valid prompt", async () => {
    const req = new NextRequest("http://localhost:3000/api/parse", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Invoice Alice (alice@example.com) $250 for website audit due in 10 days",
      }),
      headers: { "Content-Type": "application/json" },
    });

    // Provide mock provider so tests don't depend on external network
    setLLMProvider({
      async generateStructured(options) {
        const mockData = {
          client_name: "Alice",
          client_email: "alice@example.com",
          currency: "USD",
          items: [{ name: "Website Audit", description: "", quantity: 1, unit_price: 250 }],
          due_in_days: 10,
          due_date: "2026-11-16",
          notes: "",
          missing_fields: [],
          confidence: 0.95,
        };
        return {
          data: options.validate(mockData),
          rawText: JSON.stringify(mockData),
          modelUsed: "mock",
        };
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.client_name).toBe("Alice");
    expect(data.data.items[0].unit_price).toBe(250);
  });
});
