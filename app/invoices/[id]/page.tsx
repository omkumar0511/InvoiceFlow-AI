"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load invoice details.");
      }
      setInvoice(json.data);
    } catch (err: any) {
      setError(err.message || "Failed to load invoice.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

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
              onClick={fetchInvoice}
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
  const paypalLink = `https://www.sandbox.paypal.com/invoice/p/#${invoice.id}`;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Back button */}
      <div className="mb-6">
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
                <span className="inline-flex items-center rounded-md border border-teal-500/30 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300 uppercase">
                  {status}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-400 font-mono">
                PayPal ID: {invoice.id}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={paypalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-teal-500 transition-colors"
              >
                <span>View on PayPal</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          {/* Meta Grid */}
          <div className="mt-6 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
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
                {invoice.detail?.payment_term?.due_date || "Due on receipt"}
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
                Notes
              </span>
              <p>{invoice.detail.note}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
