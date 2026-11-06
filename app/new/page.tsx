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
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [hasParsed, setHasParsed] = useState(false);

  // Success state after creation
  const [createdInvoice, setCreatedInvoice] = useState<SuccessState | null>(null);

  // Error state for PayPal API errors
  const [apiError, setApiError] = useState<{
    message: string;
    debug_id?: string;
  } | null>(null);

  // Decimal-safe live total
  const liveTotal = calculateInvoiceTotal(items);

  // Handle parsing natural language with AI
  const handleParseWithAI = async () => {
    if (!promptText.trim()) {
      toast.error("Please enter an invoice description first.");
      return;
    }

    setIsParsing(true);
    setApiError(null);

    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText.trim() }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to parse invoice description.");
      }

      const parsed: ParsedInvoice = json.data;

      setClientName(parsed.client_name || "");
      setClientEmail(parsed.client_email || "");
      setCurrency(parsed.currency || "USD");
      setDueDate(parsed.due_date || "");
      setNotes(parsed.notes || "");
      setItems(
        parsed.items.length > 0
          ? parsed.items
          : [{ name: "", description: "", quantity: 1, unit_price: 0 }]
      );
      setMissingFields(parsed.missing_fields || []);
      setConfidence(parsed.confidence ?? null);
      setHasParsed(true);

      toast.success(
        `AI successfully parsed invoice (${Math.round((parsed.confidence ?? 0.9) * 100)}% confidence)`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to parse invoice.");
    } finally {
      setIsParsing(false);
    }
  };

  // Line item table helpers
  const handleItemChange = (
    index: number,
    field: keyof InvoiceItemInput,
    val: string | number
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      if (field === "quantity") {
        copy[index] = { ...copy[index], quantity: Math.max(1, Number(val) || 1) };
      } else if (field === "unit_price") {
        copy[index] = {
          ...copy[index],
          unit_price: Math.max(0, Number(val) || 0),
        };
      } else {
        copy[index] = { ...copy[index], [field]: val };
      }
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { name: "", description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("Invoice must have at least one line item.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit invoice (Save as Draft or Create & Send)
  const handleSubmit = async (sendNow: boolean) => {
    setApiError(null);

    // Front-end validations
    if (!clientName.trim()) {
      toast.error("Client name is required.");
      return;
    }

    if (sendNow && !clientEmail.trim()) {
      toast.error("Client email is required to send an invoice via PayPal.");
      return;
    }

    if (!dueDate) {
      toast.error("Due date is required.");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (dueDate < todayStr) {
      toast.error("Due date cannot be in the past.");
      return;
    }

    const validItems = items.filter((item) => item.name.trim().length > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one item with a name and price.");
      return;
    }

    setIsSubmitting(true);
    setSubmitMode(sendNow ? "send" : "draft");

    try {
      const payload = {
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        currency,
        due_date: dueDate,
        notes: notes.trim(),
        items: validItems,
        send_now: sendNow,
        original_prompt: promptText,
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
  };

  // SUCCESS SCREEN
  if (createdInvoice) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-3xl border border-teal-200/80 bg-white p-8 sm:p-12 shadow-xl shadow-teal-500/5 dark:border-teal-900/50 dark:bg-slate-900 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <span className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300">
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
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-500 transition-all hover:scale-[1.02]"
            >
              <span>View Hosted PayPal Invoice</span>
              <ExternalLink className="h-4 w-4" />
            </a>

            <button
              onClick={handleReset}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Create Another Invoice</span>
            </button>

            <Link
              href="/"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
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
          htmlFor="prompt"
          className="block text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2"
        >
          Describe your invoice
        </label>
        <textarea
          id="prompt"
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
              className="rounded-lg border border-slate-200/80 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-teal-500/50 hover:bg-teal-50/50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-teal-500/50 dark:hover:bg-teal-950/40 dark:hover:text-teal-300 transition-all text-left"
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
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 transition-all"
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
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-200/60 bg-teal-50/60 p-4 dark:border-teal-900/60 dark:bg-teal-950/40">
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
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
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
          Review & Finalize Invoice
        </h2>

        {/* Primary Meta Fields */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Client Name */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Currency
            </label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <select
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
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Due Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="date"
                value={dueDate}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Terms & Notes <span className="text-slate-400">(Optional)</span>
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Thank you for your business! Bank transfer details..."
                className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2 text-sm text-slate-900 dark:border-slate-800 dark:text-slate-100 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
          </div>
        </div>

        {/* LINE ITEMS TABLE */}
        <div className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Line Items
            </h3>
            <button
              type="button"
              onClick={handleAddItem}
              className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950/60 dark:text-teal-300 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-950/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 min-w-[220px]">Item Description</th>
                  <th className="px-4 py-3 w-24">Qty / Hrs</th>
                  <th className="px-4 py-3 w-36">Unit Price ({currency})</th>
                  <th className="px-4 py-3 w-36 text-right">Line Total</th>
                  <th className="px-2 py-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, index) => {
                  const lineTotal = fromCents(
                    toCents(item.unit_price) * (item.quantity || 1)
                  );

                  return (
                    <tr
                      key={index}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      {/* Name / Description */}
                      <td className="p-3">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleItemChange(index, "name", e.target.value)
                          }
                          placeholder="Item or service name"
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
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 transition-colors"
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
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors"
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
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-600/20 hover:bg-teal-500 disabled:opacity-50 transition-all hover:scale-[1.01]"
          >
            {isSubmitting && submitMode === "send" ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Sending via PayPal...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Create & Send via PayPal</span>
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
