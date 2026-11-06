# InvoiceFlow AI

> **Build What's Next with PayPal and AI** (PayPal AI Hackathon)

InvoiceFlow AI is an intelligent invoicing assistant built for freelancers. Simply describe work in plain natural language (e.g., *"Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days"*), and Google Gemini parses the request into structured line items, calculates financials with exact precision, and generates, sends, and tracks professional invoices directly through the PayPal Invoicing API (Sandbox).

## Key Features

- **Natural Language Invoicing**: Conversational prompt to structured PayPal invoice.
- **Strict Money Precision**: Zero floating-point math; financial calculations are executed server-side in code.
- **PayPal Invoicing API v2**: Full lifecycle support—create draft, send, remind, record payment, and cancel.
- **Interactive Dashboard**: Stat cards, AG Grid live invoice table, and AI-powered business health summaries.
- **Smart Payment Follow-ups**: Contextual AI-generated reminder drafts.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: SQLite via `better-sqlite3`
- **Validation**: Zod
- **Data Grid**: AG Grid Community
- **LLM**: Google Gemini API via `@google/genai`
- **Payment Provider**: PayPal Invoicing API v2 (Sandbox)
- **Testing**: Vitest

## Setup & Running

1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd "PayPal Hackthon"
   npm install
   ```

2. **Environment Configuration**:
   Copy `.env.example` to `.env` and fill in your PayPal Sandbox and Gemini API credentials:
   ```bash
   cp .env.example .env
   ```

3. **Verify PayPal Connection**:
   ```bash
   npm run test:paypal
   ```

4. **Run Development Server**:
   ```bash
   npm run dev
   ```

## License

[MIT](LICENSE)
