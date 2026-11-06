"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  Calendar,
  User,
  Mail,
  FileText,
  DollarSign,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  Bell,
  XCircle,
  Sparkles,
  Send,
  X,
  History,
  ShieldAlert,
} from "lucide-react";
import { formatMoneyDisplay } from "@/lib/money";

interface InvoiceDetail {
  id: string;
  status: string;
  detail?: {
    invoice_number: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
    payment_term?: {
      due_date?: string;
    };
    metadata?: {
      create_time?: string;
    };
  };
  primary_recipients?: Array<{
    billing_info?: {
      name?: { full_name?: string; given_name?: string; surname?: string };
      email_address?: string;
    };
  }>;
  items?: Array<{
    name: string;
    description?: string;
    quantity: string | number;
    unit_amount?: { currency_code: string; value: string };
  }>;
  amount?: {
    currency_code: string;
    value: string;
  };
  original_prompt?: string | null;
  local_created_at?: string | null;
}

interface ReminderRecord {
  id: number;
  invoice_id: string;
  subject: string;
  message: string;
  sent_at: string;
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [reminders, setReminders] = useState<ReminderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reminder Drafter Modal State
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTone, setReminderTone] = useState<"friendly" | "neutral" | "firm">("friendly");
  const [isDraftingReminder, setIsDraftingReminder] = useState(false);
  const [reminderSubject, setReminderSubject] = useState("");
  const [reminderMessage, setReminderMessage] = useState("");
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Pay Action State
  const [isPaying, setIsPaying] = useState(false);

  // Cancel Action Modal State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  // Fetch Invoice Details
  const fetchInvoiceData = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const [invRes, remRes] = await Promise.all([
        fetch(`/api/invoices/${id}`),
        fetch(`/api/invoices/${id}/reminders`),
      ]);

      const invJson = await invRes.json();
      if (!invRes.ok || !invJson.success) {
        throw new Error(invJson.error || "Failed to load invoice details.");
      }
      setInvoice(invJson.data);

      const remJson = await remRes.json();
      if (remJson.success) {
        setReminders(remJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load invoice.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceData();
  }, [id]);

  // Handle AI Reminder Drafting
  const handleDraftReminder = async (selectedTone = reminderTone) => {
    setIsDraftingReminder(true);
    try {
      const res = await fetch(`/api/invoices/${id}/draft-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tone: selectedTone }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to draft reminder.");
      }

      setReminderSubject(json.data.subject);
      setReminderMessage(json.data.message);
      toast.success(`Drafted ${selectedTone} reminder with Gemini AI!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to draft reminder.");
    } finally {
      setIsDraftingReminder(false);
    }
  };

  // Open Reminder Modal and automatically generate initial draft if empty
  const openReminderModal = () => {
    setShowReminderModal(true);
    if (!reminderSubject || !reminderMessage) {
      handleDraftReminder(reminderTone);
    }
  };

  // Send Reminder via PayPal
  const handleSendReminder = async () => {
    if (!reminderSubject.trim() || !reminderMessage.trim()) {
      toast.error("Subject and message are required.");
      return;
    }

    setIsSendingReminder(true);
    try {
      const res = await fetch(`/api/invoices/${id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: reminderSubject.trim(),
          message: reminderMessage.trim(),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "PayPal failed to send reminder.");
      }

      toast.success("Payment reminder sent via PayPal!");
      setShowReminderModal(false);

      // Refresh reminder history list
      const remRes = await fetch(`/api/invoices/${id}/reminders`);
      const remJson = await remRes.json();
      if (remJson.success) {
        setReminders(remJson.data || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send reminder.");
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Mark as Paid (Sandbox demo)
  const handleMarkAsPaid = async () => {
    setIsPaying(true);
    try {
      const res = await fetch(`/api/invoices/${id}/pay`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to record payment with PayPal.");
      }

      setInvoice((prev) => (prev ? { ...prev, status: "PAID" } : null));
      toast.success("Invoice marked as PAID in PayPal Sandbox!");
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment.");
    } finally {
      setIsPaying(false);
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async () => {
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/invoices/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: cancelNote.trim() }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to cancel invoice.");
      }

      setInvoice((prev) => (prev ? { ...prev, status: "CANCELLED" } : null));
      toast.success("Invoice successfully cancelled in PayPal.");
      setShowCancelModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel invoice.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 animate-pulse">
          <div className="mx-auto h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
          <div className="mx-auto h-4 w-60 bg-slate-100 dark:bg-slate-800/60 rounded" />
        </div>
      </main>
    );
  }

  if (error || !invoice) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200">
          <AlertCircle className="mx-auto h-10 w-10 text-red-500 mb-3" />
          <h2 className="text-lg font-bold">Could Not Load Invoice</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error || "Invoice not found"}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm border border-slate-200 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>
            <button
              onClick={fetchInvoiceData}
              className="rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const recipient = invoice.primary_recipients?.[0]?.billing_info;
  const clientName =
    recipient?.name?.full_name ||
    [recipient?.name?.given_name, recipient?.name?.surname].filter(Boolean).join(" ") ||
    "Client";
  const clientEmail = recipient?.email_address || "";

  const currency = invoice.amount?.currency_code || "USD";
  const status = (invoice.status || "DRAFT").toUpperCase();
  const isPaid = status === "PAID" || status === "MARKED_AS_PAID";
  const isCancelled = status === "CANCELLED" || status === "REFUNDED";

  const todayStr = new Date().toISOString().split("T")[0];
  const dueDate = invoice.detail?.payment_term?.due_date || "";
  const isOverdue = !isPaid && !isCancelled && status !== "DRAFT" && dueDate && dueDate < todayStr;

  const paypalLink = `https://www.sandbox.paypal.com/invoice/p/#${invoice.id}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
      </div>

      {/* Main Invoice Card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {/* Top Header */}
        <div className="border-b border-slate-200/80 bg-slate-50/50 p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Invoice #{invoice.detail?.invoice_number || "Draft"}
                </h1>
                <span
                  className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    isPaid
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300"
                      : isCancelled
                      ? "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400"
                      : isOverdue
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300"
                      : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300"
                  }`}
                >
                  {isOverdue ? "OVERDUE" : status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 font-mono">
                PayPal ID: {invoice.id}
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={paypalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                <span>View on PayPal</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              {!isPaid && !isCancelled && (
                <>
                  <button
                    onClick={openReminderModal}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-teal-50 px-3.5 py-2 text-xs font-semibold text-teal-700 border border-teal-200 hover:bg-teal-100 dark:bg-teal-950/60 dark:border-teal-800 dark:text-teal-300 transition-colors"
                  >
                    <Bell className="h-3.5 w-3.5" />
                    <span>Send Reminder</span>
                  </button>

                  <button
                    onClick={handleMarkAsPaid}
                    disabled={isPaying}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-50 transition-colors"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{isPaying ? "Recording..." : "Mark as Paid"}</span>
                  </button>

                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-300 transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>Cancel</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* STATUS TIMELINE */}
          <div className="mt-8 border-t border-slate-200/80 pt-6 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-3 uppercase tracking-wider">
              Status Progression
            </span>
            <div className="flex items-center w-full max-w-xl">
              {/* Step 1: Created */}
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold">
                  ✓
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Created</p>
                  <p className="text-[10px] text-slate-400">{invoice.detail?.invoice_date}</p>
                </div>
              </div>

              <div className="flex-1 h-0.5 mx-3 bg-teal-500" />

              {/* Step 2: Sent */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    status !== "DRAFT"
                      ? "bg-teal-600 text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                  }`}
                >
                  {status !== "DRAFT" ? "✓" : "2"}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">Sent</p>
                  <p className="text-[10px] text-slate-400">
                    {status !== "DRAFT" ? "Delivered" : "Draft state"}
                  </p>
                </div>
              </div>

              <div
                className={`flex-1 h-0.5 mx-3 ${
                  isPaid ? "bg-emerald-500" : isCancelled ? "bg-zinc-400" : "bg-slate-200 dark:bg-slate-800"
                }`}
              />

              {/* Step 3: Paid / Resolved */}
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                    isPaid
                      ? "bg-emerald-600 text-white"
                      : isCancelled
                      ? "bg-zinc-600 text-white"
                      : isOverdue
                      ? "bg-rose-500 text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800"
                  }`}
                >
                  {isPaid ? "✓" : isCancelled ? "✕" : isOverdue ? "!" : "3"}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">
                    {isPaid ? "Paid" : isCancelled ? "Cancelled" : isOverdue ? "Overdue" : "Pending"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isPaid ? "Completed" : isCancelled ? "Revoked" : dueDate ? `Due: ${dueDate}` : "Pending"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Meta Grid */}
          <div className="mt-8 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Client</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {clientName}
              </p>
              {clientEmail && (
                <p className="text-slate-400 truncate">{clientEmail}</p>
              )}
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Issue Date</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {invoice.detail?.invoice_date || "—"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Due Date</span>
              <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                {dueDate || "Due on receipt"}
              </p>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Total Amount</span>
              <p className="font-bold text-teal-600 dark:text-teal-400 text-sm mt-0.5">
                {formatMoneyDisplay(invoice.amount?.value || "0.00", currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Original Prompt Card if present */}
        {invoice.original_prompt && (
          <div className="border-b border-slate-100 bg-teal-50/30 px-6 py-4 dark:border-slate-800 dark:bg-teal-950/20">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-800 dark:text-teal-300">
              Original Natural Language Prompt (SQLite)
            </span>
            <p className="mt-1 text-xs italic text-slate-700 dark:text-slate-300">
              &quot;{invoice.original_prompt}&quot;
            </p>
          </div>
        )}

        {/* Line Items */}
        <div className="p-6 sm:p-8">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">
            Line Items
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 uppercase text-[11px] font-semibold text-slate-500 dark:bg-slate-950 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoice.items?.map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const unitPrice = item.unit_amount?.value || "0.00";
                  const total = (parseFloat(unitPrice) * qty).toFixed(2);

                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {item.name}
                        {item.description && (
                          <span className="block text-[11px] text-slate-400">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{qty}</td>
                      <td className="px-4 py-3 text-right">
                        {formatMoneyDisplay(unitPrice, currency)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                        {formatMoneyDisplay(total, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Notes */}
          {invoice.detail?.note && (
            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <span className="font-semibold block text-slate-800 dark:text-slate-200 mb-1">
                Notes & Terms
              </span>
              <p>{invoice.detail.note}</p>
            </div>
          )}
        </div>

        {/* REMINDER HISTORY SECTION */}
        <div className="border-t border-slate-200/80 p-6 sm:p-8 bg-slate-50/30 dark:border-slate-800 dark:bg-slate-950/20">
          <div className="flex items-center gap-2 mb-4">
            <History className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Reminder History ({reminders.length})
            </h2>
          </div>

          {reminders.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              No reminders have been sent yet for this invoice.
            </p>
          ) : (
            <div className="space-y-3">
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-xs"
                >
                  <div className="flex items-center justify-between text-slate-500 mb-1.5">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {rem.subject}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Sent on {new Date(rem.sent_at).toLocaleDateString()} at{" "}
                      {new Date(rem.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {rem.message}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI REMINDER DRAFTER MODAL */}
      {showReminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  AI Payment Reminder Drafter
                </h3>
              </div>
              <button
                onClick={() => setShowReminderModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Tone Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Select Reminder Tone:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["friendly", "neutral", "firm"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setReminderTone(t);
                        handleDraftReminder(t);
                      }}
                      className={`rounded-xl border py-2 text-xs font-semibold capitalize transition-all ${
                        reminderTone === t
                          ? "border-teal-600 bg-teal-50 text-teal-700 dark:bg-teal-950 dark:border-teal-700 dark:text-teal-300 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={reminderSubject}
                  onChange={(e) => setReminderSubject(e.target.value)}
                  placeholder="Payment reminder subject"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Message Body (Editable Preview)
                </label>
                <textarea
                  rows={6}
                  value={reminderMessage}
                  onChange={(e) => setReminderMessage(e.target.value)}
                  placeholder="AI drafting your message..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs leading-relaxed text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 font-sans"
                />
              </div>

              {/* Notice */}
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Note: PayPal restricts manual reminders to a maximum of 2 per day per invoice. This reminder will ONLY be sent when you click &quot;Send via PayPal&quot; below.
              </p>
            </div>

            {/* Footer Buttons */}
            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleDraftReminder(reminderTone)}
                disabled={isDraftingReminder}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isDraftingReminder ? "animate-spin text-teal-600" : ""}`} />
                <span>Re-draft</span>
              </button>

              <button
                type="button"
                onClick={handleSendReminder}
                disabled={isSendingReminder || isDraftingReminder}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                <span>{isSendingReminder ? "Sending..." : "Send via PayPal"}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CANCEL CONFIRMATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" />
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Cancel Invoice #{invoice.detail?.invoice_number}?
              </h3>
            </div>

            <p className="mt-3 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Are you sure you want to cancel this invoice? Once cancelled in PayPal, the client will no longer be able to submit payment for this invoice.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Reason / Note for Client (Optional):
              </label>
              <textarea
                rows={2}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="e.g. Terms modified, will re-issue new invoice."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-300"
              >
                Keep Invoice
              </button>
              <button
                type="button"
                onClick={handleCancelInvoice}
                disabled={isCancelling}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-500 disabled:opacity-50"
              >
                {isCancelling ? "Cancelling..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
