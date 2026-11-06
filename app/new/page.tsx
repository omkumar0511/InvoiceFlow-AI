"use client";

import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import {
  Sparkles,
  Send,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  ArrowRight,
  RefreshCw,
  Calendar,
  DollarSign,
  User,
  Mail,
  FileText,
  Copy,
  Check,
} from "lucide-react";
import { ParsedInvoice, InvoiceItemInput } from "@/lib/schemas";
import { calculateInvoiceTotal, formatMoneyDisplay, fromCents, toCents } from "@/lib/money";

interface SuccessState {
  id: string;
  invoice_number: string;
  status: string;
  client_name: string;
  client_email: string;
  due_date: string;
  currency: string;
  total_amount: string;
  paypal_link: string;
  sent: boolean;
}

const EXAMPLE_PROMPTS = [
  {
    title: "Design & Revisions",
    prompt:
      "Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days",
  },
  {
    title: "Hourly Consulting (Net 30)",
    prompt:
      "Bill TechStudio Inc (finance@techstudio.io) for 40 hours of fullstack web development at $85/hr, due in 30 days",
  },
  {
    title: "International (EUR)",
    prompt:
      "Invoice Sophie Laurent (sophie.l@design.fr) €750 for UI/UX audit and €250 for design system guidelines, due in 10 days",
  },
];

export default function NewInvoicePage() {
  const [promptText, setPromptText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMode, setSubmitMode] = useState<"draft" | "send" | null>(null);

  // Parsed / Form State
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItemInput[]>([
    { name: "", description: "", quantity: 1, unit_price: 0 },
  ]);

  // AI Feedback State
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [hasParsed, setHasParsed] = useState(false);

  // Success / Error State
  const [createdInvoice, setCreatedInvoice] = useState<SuccessState | null>(null);
  const [apiError, setApiError] = useState<{ message: string; debug_id?: string } | null>(null);
  const [hasCopiedLink, setHasCopiedLink] = useState(false);

  // Live total computed with integer cents
  const liveTotal = calculateInvoiceTotal(items);

  // Handle AI parsing
  const handleParseWithAI = async () => {
    if (!promptText.trim()) {
      toast.error("Please enter an invoice description first.");
      return;
    }

    setIsParsing(true);
    setApiError(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: promptText.trim(),
          referenceDate: new Date().toISOString().split("T")[0],
        }),
      });

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.error || "Failed to parse invoice description");
      }

      const parsed: ParsedInvoice = json.data;

      // Populate review form
      setClientName(parsed.client_name || "");
      setClientEmail(parsed.client_email || "");
      setCurrency(parsed.currency || "USD");
      setDueDate(parsed.due_date || "");
      setNotes(parsed.notes || "");
      setMissingFields(parsed.missing_fields || []);
      setConfidence(parsed.confidence ?? null);

      if (parsed.items && parsed.items.length > 0) {
        setItems(
          parsed.items.map((it) => ({
            name: it.name,
            description: it.description || "",
            quantity: it.quantity,
            unit_price: it.unit_price,
          }))
        );
      }

      setHasParsed(true);
      toast.success(
        `Parsed invoice with ${Math.round((parsed.confidence ?? 0.9) * 100)}% confidence!`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to parse invoice.");
    } finally {
      setIsParsing(false);
    }
  };

  // Item table management
  const handleItemChange = (
    index: number,
    field: keyof InvoiceItemInput,
    value: any
  ) => {
    const updated = [...items];
    if (field === "quantity") {
      const num = parseFloat(value);
      updated[index].quantity = isNaN(num) ? 0 : num;
    } else if (field === "unit_price") {
      const num = parseFloat(value);
      updated[index].unit_price = isNaN(num) ? 0 : num;
    } else {
      (updated[index] as any)[field] = value;
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { name: "", description: "", quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Form Submission
  const handleSubmit = async (sendNow: boolean) => {
    setApiError(null);

    if (!clientName.trim()) {
      toast.error("Client name is required.");
      return;
    }

    if (sendNow && !clientEmail.trim()) {
      toast.error("Client email is required to send via PayPal.");
      return;
    }

    if (!dueDate) {
      toast.error("Please select a due date.");
      return;
    }

    // Validate due date is not in the past
    const today = new Date().toISOString().split("T")[0];
    if (dueDate < today) {
      toast.error("Due date cannot be in the past.");
      return;
    }

    // Validate line items
    const invalidItem = items.find(
      (item) => !item.name.trim() || item.quantity <= 0 || item.unit_price < 0
    );
    if (invalidItem) {
      toast.error("All items must have a description, positive quantity, and non-negative price.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(sendNow ? "send" : "draft");

    try {
      const payload = {
        client_name: clientName.trim(),
        client_email: clientEmail.trim() || undefined,
        currency,
        due_date: dueDate,
        notes: notes.trim() || undefined,
        items,
        send_now: sendNow,
        original_prompt: promptText.trim() || undefined,
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setApiError({
          message: json.error || "Failed to create invoice in PayPal.",
          debug_id: json.debug_id,
        });
        toast.error(
          json.error || "PayPal rejected the invoice. Please check the details."
        );
        return;
      }

      setCreatedInvoice(json.data);
      toast.success(
        sendNow
          ? `Invoice #${json.data.invoice_number} sent via PayPal!`
          : `Invoice #${json.data.invoice_number} saved as draft!`
      );
    } catch (err: any) {
      setApiError({ message: err.message || "Network error occurred." });
      toast.error(err.message || "Failed to connect to invoice server.");
    } finally {
      setIsSubmitting(false);
      setSubmitMode(null);
    }
  };

  // Copy PayPal URL
  const handleCopyLink = () => {
    if (!createdInvoice?.paypal_link) return;
    navigator.clipboard.writeText(createdInvoice.paypal_link);
    setHasCopiedLink(true);
    toast.success("PayPal invoice link copied to clipboard!");
    setTimeout(() => setHasCopiedLink(false), 2000);
  };

  // Reset to create another invoice
  const handleReset = () => {
    setCreatedInvoice(null);
    setPromptText("");
    setClientName("");
    setClientEmail("");
    setCurrency("USD");
    setDueDate("");
    setNotes("");
    setItems([{ name: "", description: "", quantity: 1, unit_price: 0 }]);
    setMissingFields([]);
    setConfidence(null);
    setHasParsed(false);
    setApiError(null);
    setHasCopiedLink(false);
  };

  // SUCCESS SCREEN
  if (createdInvoice) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-teal-200/80 bg-white p-8 sm:p-12 shadow-xl shadow-teal-500/5 dark:border-teal-900/50 dark:bg-slate-900 text-center animate-in zoom-in-95 duration-300">
          {/* Animated celebratory checkmark */}
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-8 ring-teal-50 dark:ring-teal-900/30">
            <CheckCircle2 className="h-11 w-11 text-teal-600 dark:text-teal-400" />
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
            </span>
          </div>

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300">
            <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            {createdInvoice.sent ? "Sent via PayPal Sandbox" : "Draft Created in PayPal"}
          </span>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Invoice #{createdInvoice.invoice_number}
          </h1>

          <p className="mt-2 text-slate-600 dark:text-slate-400 text-sm">
            PayPal Invoice ID: <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono dark:bg-slate-800">{createdInvoice.id}</code>
          </p>

          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50/70 p-6 text-left dark:border-slate-800 dark:bg-slate-950/50">
            <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Status</span>
                <p className="font-semibold text-slate-900 dark:text-white uppercase">
                  {createdInvoice.status}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Total Amount</span>
                <p className="font-semibold text-teal-600 dark:text-teal-400">
                  {formatMoneyDisplay(createdInvoice.total_amount, createdInvoice.currency)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Recipient</span>
                <p className="font-medium text-slate-900 dark:text-white truncate">
                  {createdInvoice.client_name}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400">Due Date</span>
                <p className="font-medium text-slate-900 dark:text-white">
                  {createdInvoice.due_date}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={createdInvoice.paypal_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-500 transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span>View Hosted PayPal Invoice</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={handleCopyLink}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
              aria-label="Copy PayPal invoice link"
            >
              {hasCopiedLink ? (
                <>
                  <Check className="h-4 w-4 text-teal-600" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              onClick={handleReset}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Create Another</span>
            </button>

            <Link
              href="/"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span>Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Page Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Create New Invoice
        </h1>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
          Describe the invoice in natural language. Gemini AI extracts structured billing data, and the app connects directly to PayPal Sandbox.
        </p>
      </div>

      {/* NATURAL LANGUAGE INPUT CARD */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <label
          htmlFor="invoice-prompt"
          className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          Describe your invoice
        </label>
        <textarea
          id="invoice-prompt"
          rows={3}
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          placeholder='e.g. "Invoice Rahul Mehta (rahul@example.com) $450 for logo design and $120 for two revisions, due in 15 days"'
          className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 transition-all"
        />

        {/* Example Prompt Chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
            Try an example:
          </span>
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPromptText(ex.prompt)}
              className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-teal-500/50 hover:bg-teal-50/50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              {ex.title}
            </button>
          ))}
        </div>

        {/* Parse Button */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Powered by Google Gemini 3 Flash
          </span>

          <button
            type="button"
            onClick={handleParseWithAI}
            disabled={isParsing}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isParsing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Parsing with Gemini AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Parse with AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* AI Confidence & Missing Fields Banner */}
      {hasParsed && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200/60 bg-teal-50/60 p-4 dark:border-teal-900/60 dark:bg-teal-950/40 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white text-xs font-bold">
              ✓
            </div>
            <div>
              <p className="text-sm font-semibold text-teal-950 dark:text-teal-200">
                AI Extracted Invoice Details
              </p>
              <p className="text-xs text-teal-700 dark:text-teal-300">
                {confidence !== null && (
                  <span>Confidence: {Math.round(confidence * 100)}% • </span>
                )}
                Review and edit any field below before sending to PayPal.
              </p>
            </div>
          </div>

          {missingFields.length > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-300/80 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Missing from prompt: {missingFields.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* PAYPAL ERROR BANNER */}
      {apiError && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200 animate-in fade-in duration-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">PayPal Transaction Error</p>
              <p className="mt-1 text-xs text-red-700 dark:text-red-300">{apiError.message}</p>
              {apiError.debug_id && (
                <p className="mt-2 font-mono text-[11px] text-red-600 dark:text-red-400">
                  PayPal Debug ID: <span className="bg-red-100 dark:bg-red-900/60 px-1.5 py-0.5 rounded">{apiError.debug_id}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDITABLE REVIEW FORM */}
      <div className="mt-8 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-colors">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">
          Review &amp; Finalize Invoice
        </h2>

        {/* Primary Meta Fields */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Client Name */}
          <div className="lg:col-span-2">
            <label
              htmlFor="client-name"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Client Name <span className="text-red-500">*</span>
              {missingFields.includes("client_name") && (
                <span className="ml-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  (Needs Review)
                </span>
              )}
            </label>
            <div className="relative">
              <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="client-name"
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Client or Company Name"
                className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                  missingFields.includes("client_name") && !clientName
                    ? "border-amber-400 bg-amber-50/20 dark:border-amber-600"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              />
            </div>
          </div>

          {/* Client Email */}
          <div className="lg:col-span-2">
            <label
              htmlFor="client-email"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Client Email <span className="text-slate-400">(Required to Send)</span>
              {missingFields.includes("client_email") && (
                <span className="ml-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  (Missing)
                </span>
              )}
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="client-email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.com"
                className={`w-full rounded-xl border pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20 ${
                  missingFields.includes("client_email") && !clientEmail
                    ? "border-amber-400 bg-amber-50/20 dark:border-amber-600"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              />
            </div>
          </div>

          {/* Currency */}
          <div>
            <label
              htmlFor="currency-select"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Currency
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select
                id="currency-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-8 py-2 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CAD">CAD (CA$)</option>
                <option value="AUD">AUD (A$)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label
              htmlFor="due-date"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="due-date"
                type="date"
                value={dueDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="lg:col-span-2">
            <label
              htmlFor="notes-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Notes / Terms <span className="text-slate-400">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                id="notes-input"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thank you for your business!"
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>
        </div>

        {/* ITEMS TABLE */}
        <div className="mt-8 border-t border-slate-100 pt-6 dark:border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Line Items
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-slate-800">
            <table className="w-full text-left text-sm" role="table">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-950/60 dark:text-slate-400 border-b border-slate-200/80 dark:border-slate-800">
                <tr>
                  <th scope="col" className="p-3 w-1/3">Item Name</th>
                  <th scope="col" className="p-3">Description</th>
                  <th scope="col" className="p-3 w-20 text-center">Qty</th>
                  <th scope="col" className="p-3 w-28">Price</th>
                  <th scope="col" className="p-3 w-28 text-right">Total</th>
                  <th scope="col" className="p-2 w-12 text-center" aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {items.map((item, index) => {
                  const lineTotal = fromCents(
                    toCents(item.quantity) * toCents(item.unit_price) / 100
                  );
                  return (
                    <tr key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      {/* Name */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleItemChange(index, "name", e.target.value)
                          }
                          aria-label={`Item ${index + 1} name`}
                          placeholder="e.g. Logo Design"
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>

                      {/* Description */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.description || ""}
                          onChange={(e) =>
                            handleItemChange(index, "description", e.target.value)
                          }
                          aria-label={`Item ${index + 1} description`}
                          placeholder="Optional notes"
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>

                      {/* Quantity */}
                      <td className="p-3">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleItemChange(index, "quantity", e.target.value)
                          }
                          aria-label={`Item ${index + 1} quantity`}
                          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 text-center focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>

                      {/* Unit Price */}
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            handleItemChange(index, "unit_price", e.target.value)
                          }
                          aria-label={`Item ${index + 1} unit price`}
                          className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        />
                      </td>

                      {/* Line Total */}
                      <td className="p-3 text-right font-medium text-slate-900 dark:text-slate-100">
                        {formatMoneyDisplay(lineTotal, currency)}
                      </td>

                      {/* Action */}
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          disabled={items.length <= 1}
                          aria-label={`Remove item ${index + 1}`}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Grand Total Summary */}
          <div className="mt-4 flex flex-col items-end">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-6 py-4 dark:border-slate-800 dark:bg-slate-950 min-w-[240px] text-right">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Invoice Total (Exact Math)
              </span>
              <p className="mt-1 text-2xl font-bold text-teal-600 dark:text-teal-400">
                {formatMoneyDisplay(liveTotal.formatted, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-6 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleSubmit(false)}
            disabled={isSubmitting}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isSubmitting && submitMode === "draft" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Saving Draft...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>Save as Draft</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={isSubmitting}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-500 disabled:opacity-50 transition-all hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            {isSubmitting && submitMode === "send" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Sending via PayPal...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Create &amp; Send via PayPal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
