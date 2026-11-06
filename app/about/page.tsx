import Link from "next/link";
import {
  Sparkles,
  ShieldCheck,
  Zap,
  Database,
  ArrowRight,
  Code2,
  CheckCircle2,
  Lock,
  Layers,
  Terminal,
} from "lucide-react";

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300">
          <Sparkles className="h-3.5 w-3.5" />
          PayPal AI Hackathon Submission
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
          Build What&apos;s Next with PayPal &amp; AI
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400 sm:text-lg">
          <strong>InvoiceFlow AI</strong> bridges conversational freelancing and professional payment collection. Just describe your work in plain English, and Google Gemini extracts structured billing facts directly into official PayPal Invoicing v2 workflows.
        </p>
      </div>

      {/* Feature Pillars */}
      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 dark:text-white">
            Natural Language Invoicing
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Freelancers can dictate or type unstructured invoices like <em>&quot;Invoice Acme $450 for logo and $120 for revisions due in 15 days&quot;</em>. Gemini parses line items, rates, and relative dates with structured Zod schemas.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 dark:text-white">
            Zero Floating-Point Math
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            All currency totals, line multipliers, and financial statistics are calculated in server code using integer-cents arithmetic. The LLM never computes totals, preventing hallucinations and rounding errors.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Zap className="h-5 w-5" />
          </div>
          <h2 className="mt-4 font-semibold text-slate-900 dark:text-white">
            PayPal Invoicing v2 (Sandbox)
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            Direct integration with PayPal Invoicing v2. Creates drafts, immediately delivers invoices with direct payment links, sends payment reminders, and records payments.
          </p>
        </div>
      </div>

      {/* Deep Dive Section: How PayPal Invoicing is Used */}
      <section className="mt-16 rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Zap className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            How PayPal Invoicing v2 is Integrated
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          InvoiceFlow AI interfaces with PayPal&apos;s REST Invoicing API v2 in Sandbox mode (<code>https://api-m.sandbox.paypal.com</code>). The integration includes token caching with safety buffers, automatic 5xx retry handling, and comprehensive error parsing capturing PayPal <code>debug_id</code>s.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              POST /v2/invoicing/generate-next-invoice-number
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Generates compliant sequential invoice numbers (e.g. <code>INV2-0004</code>) assigned to merchant profiles.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              POST /v2/invoicing/invoices
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Creates draft invoices containing items, quantities, currency, payment terms, and invoicer metadata.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              POST /v2/invoicing/invoices/{`{id}`}/send
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Transitions the draft into an official payable invoice, generates buyer URLs, and notifies recipients.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              GET /v2/invoicing/invoices &amp; GET /v2/invoicing/invoices/{`{id}`}
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Fetches paginated invoice listings and full details, status histories, payer links, and line item arrays.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              POST /v2/invoicing/invoices/{`{id}`}/remind
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Dispatches gentle, neutral, or firm payment reminders via PayPal&apos;s notification engine.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <h3 className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              POST /v2/invoicing/invoices/{`{id}`}/payments &amp; cancel
            </h3>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
              Enables recording simulated sandbox payments or cancelling invoices with custom internal notes.
            </p>
          </div>
        </div>
      </section>

      {/* Deep Dive Section: How AI is Used */}
      <section className="mt-12 rounded-3xl border border-slate-200/80 bg-white p-8 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            How Google Gemini AI is Applied &amp; Guarded
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          We use Google Gemini (<code>gemini-3-flash-preview</code> with fallback to <code>gemini-2.5-flash</code>) via the official <code>@google/genai</code> SDK with <code>apiVersion: &quot;v1beta&quot;</code>. AI is never trusted blindly; all outputs pass through strict programmatic guardrails:
        </p>

        <div className="mt-6 space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="p-1 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Structured Schema Enforcement &amp; Zod Validation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Gemini receives a JSON schema constraint (<code>responseMimeType: &quot;application/json&quot;</code>). On receipt, the payload is immediately validated with Zod. If validation fails, an automatic self-healing retry is triggered with the validation issue provided.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="p-1 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Prompt Injection Defense &amp; Isolation
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                User input is enclosed in strict data boundary tags (<code>&lt;user_invoice_description&gt;</code>) and treated solely as untrusted data, never as prompt instructions.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="p-1 rounded-md bg-teal-500/10 text-teal-600 dark:text-teal-400 mt-0.5">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Contextual AI Reminders &amp; Financial Summaries
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                Gemini drafts personalized tone-tailored reminders (friendly, neutral, firm) matching invoice age, and generates plain-English business summaries from precomputed financial totals. Summaries are cached in SQLite by stats hash to minimize token usage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Mode vs Real Mode Guide */}
      <section
        id="setup"
        className="mt-12 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-white to-teal-500/5 p-8 dark:border-amber-500/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/60"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Terminal className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Demo Mode &amp; Real Mode Setup Guide
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          InvoiceFlow AI is designed to run seamlessly in two modes:
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-300">
              Demo Mode (Zero Configuration)
            </span>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              When <code>DEMO_MODE=true</code> or credentials are unset, the app uses an SQLite-backed mock PayPal client and deterministic mock LLM. Invoices, payments, and reminders persist across page reloads.
            </p>
            <div className="mt-4 text-xs font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-slate-800 dark:text-slate-200">
              npm install<br />
              npm run dev
            </div>
          </div>

          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/60">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-500/15 text-teal-800 dark:text-teal-300">
              Real Mode (PayPal Sandbox &amp; Gemini)
            </span>
            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Configure your credentials in <code>.env</code> to connect directly to the live PayPal Sandbox Invoicing API and Google Gemini model.
            </p>
            <div className="mt-4 text-xs font-mono bg-slate-100 dark:bg-slate-900 p-3 rounded-lg text-slate-800 dark:text-slate-200">
              PAYPAL_CLIENT_ID=...<br />
              PAYPAL_CLIENT_SECRET=...<br />
              GEMINI_API_KEY=...<br />
              DEMO_MODE=false
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Callout */}
      <div className="mt-12 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-teal-50/50 via-white to-cyan-50/50 p-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/60">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Complete Technology Stack
        </h3>
        <ul className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-4">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Next.js 14 App Router
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            TypeScript (Strict Mode)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Google Gemini 3 Flash
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            PayPal Invoicing v2
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            SQLite (WAL Mode)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            AG Grid Community
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Tailwind CSS
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Vitest Test Suite
          </li>
        </ul>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between border-t border-slate-200/70 pt-6 dark:border-slate-800 gap-4">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Crafted for the PayPal AI Hackathon • MIT Licensed
          </span>
          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:bg-teal-500 transition-all hover:scale-[1.02]"
          >
            <span>Create an Invoice Now</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
