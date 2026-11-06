import Link from "next/link";
import { Sparkles, ShieldCheck, Zap, Database, ArrowRight } from "lucide-react";

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
          Build What&apos;s Next with PayPal & AI
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 dark:text-slate-400 sm:text-lg">
          <strong>InvoiceFlow AI</strong> bridges conversational freelancing and professional payment collection. Just describe your work in plain English, and Google Gemini extracts structured billing facts into the official PayPal Invoicing API.
        </p>
      </div>

      {/* Feature Pillars */}
      <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

      {/* Tech Stack Callout */}
      <div className="mt-12 rounded-2xl border border-slate-200/80 bg-gradient-to-r from-teal-50/50 via-white to-cyan-50/50 p-8 dark:border-slate-800 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/60">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          Under the Hood
        </h3>
        <ul className="mt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-4">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Next.js 14 App Router
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            TypeScript (Strict)
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
            SQLite (better-sqlite3)
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Zod Validation
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Tailwind CSS
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500" />
            Vitest Suite
          </li>
        </ul>

        <div className="mt-8 flex items-center justify-between border-t border-slate-200/70 pt-6 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Open Source • MIT Licensed
          </span>
          <Link
            href="/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-500 transition-colors"
          >
            Create an Invoice
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </main>
  );
}
