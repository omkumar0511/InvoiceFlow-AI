"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  PlusCircle,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  RefreshCw,
  FileText,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { InvoiceGrid, InvoiceRow } from "@/components/InvoiceGrid";
import { BusinessSummaryCard } from "@/components/BusinessSummaryCard";
import { formatMoneyDisplay } from "@/lib/money";

interface DashboardStats {
  total_invoiced: string;
  paid: string;
  outstanding: string;
  overdue: string;
  currency: string;
  counts: {
    total: number;
    paid: number;
    outstanding: number;
    overdue: number;
    draft: number;
    cancelled: number;
  };
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices");
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to load invoices from PayPal.");
      }

      setInvoices(json.data.invoices || []);
      setStats(json.data.stats || null);
    } catch (err: any) {
      setError(err.message || "An error occurred while fetching invoices.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  // Filter invoices based on status filter chip
  const filteredInvoices = useMemo(() => {
    if (selectedStatus === "ALL") return invoices;
    return invoices.filter((inv) => {
      const status = (inv.computed_status || inv.status || "").toUpperCase();
      if (selectedStatus === "PAID") {
        return status === "PAID" || status === "MARKED_AS_PAID";
      }
      if (selectedStatus === "OVERDUE") {
        return status === "OVERDUE";
      }
      if (selectedStatus === "SENT") {
        return status === "SENT" || status === "SCHEDULED";
      }
      if (selectedStatus === "DRAFT") {
        return status === "DRAFT";
      }
      if (selectedStatus === "CANCELLED") {
        return status === "CANCELLED" || status === "REFUNDED";
      }
      return status === selectedStatus;
    });
  }, [invoices, selectedStatus]);

  const currency = stats?.currency || "USD";

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Freelance Invoicing Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time billing performance synced with PayPal Sandbox.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchInvoices}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors"
            title="Refresh invoices"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-teal-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <Link
            href="/new"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:from-teal-500 hover:to-cyan-500 transition-all hover:scale-[1.02]"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Create Invoice</span>
          </Link>
        </div>
      </div>

      {/* ERROR BANNER */}
      {error && (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/60 dark:bg-red-950/50 dark:text-red-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchInvoices}
            className="text-xs font-semibold underline hover:no-underline text-red-700 dark:text-red-300"
          >
            Try Again
          </button>
        </div>
      )}

      {/* AI BUSINESS SUMMARY INSIGHTS */}
      <div className="mt-8">
        <BusinessSummaryCard />
      </div>

      {/* FOUR STAT CARDS */}
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Invoiced */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Invoiced
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-2 animate-pulse">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                {formatMoneyDisplay(stats?.total_invoiced || "0.00", currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats?.counts.total || 0} invoices created
              </p>
            </>
          )}
        </div>

        {/* Card 2: Paid */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Paid
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-2 animate-pulse">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatMoneyDisplay(stats?.paid || "0.00", currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats?.counts.paid || 0} collected
              </p>
            </>
          )}
        </div>

        {/* Card 3: Outstanding */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Outstanding
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-2 animate-pulse">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                {formatMoneyDisplay(stats?.outstanding || "0.00", currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats?.counts.outstanding || 0} pending payment
              </p>
            </>
          )}
        </div>

        {/* Card 4: Overdue */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Overdue
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          </div>
          {isLoading ? (
            <div className="mt-4 space-y-2 animate-pulse">
              <div className="h-8 w-28 bg-slate-200 dark:bg-slate-800 rounded-md" />
              <div className="h-3 w-20 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                {formatMoneyDisplay(stats?.overdue || "0.00", currency)}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {stats?.counts.overdue || 0} past due date
              </p>
            </>
          )}
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Status Filter Chips */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="group"
          aria-label="Filter invoices by status"
        >
          {[
            { id: "ALL", label: "All", count: stats?.counts.total },
            { id: "SENT", label: "Sent", count: stats?.counts.outstanding },
            { id: "PAID", label: "Paid", count: stats?.counts.paid },
            { id: "OVERDUE", label: "Overdue", count: stats?.counts.overdue },
            { id: "DRAFT", label: "Draft", count: stats?.counts.draft },
            { id: "CANCELLED", label: "Cancelled", count: stats?.counts.cancelled },
          ].map((chip) => {
            const isActive = selectedStatus === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setSelectedStatus(chip.id)}
                aria-pressed={isActive}
                aria-label={`Show ${chip.label} invoices (${chip.count ?? 0})`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                  isActive
                    ? "bg-teal-600 text-white shadow-sm shadow-teal-600/20"
                    : "bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <span>{chip.label}</span>
                {chip.count !== undefined && chip.count > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {chip.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Quick Search Input */}
        <div className="relative w-full sm:w-64">
          <label htmlFor="search-invoices" className="sr-only">
            Search invoices
          </label>
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id="search-invoices"
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
      </div>

      {/* TABLE SECTION */}
      <div className="mt-4">
        {isLoading ? (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 animate-pulse">
            <div className="mx-auto h-10 w-10 bg-slate-200 dark:bg-slate-800 rounded-xl mb-4" />
            <div className="mx-auto h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded mb-2" />
            <div className="mx-auto h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
          </div>
        ) : invoices.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-400">
              <FileText className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              No invoices yet
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Create your first invoice by simply typing in plain English. Gemini AI will structure it and PayPal will deliver it.
            </p>
            <div className="mt-6">
              <Link
                href="/new"
                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-500/20 hover:bg-teal-500 transition-all"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Create Your First Invoice</span>
              </Link>
            </div>
          </div>
        ) : (
          /* AG Grid Table */
          <InvoiceGrid invoices={filteredInvoices} quickFilterText={searchQuery} />
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 gap-2">
        <p>
          Connected to PayPal Sandbox • Click any row to view full details and payment reminders.
        </p>
        <p>Zero floating-point rounding errors • Currency amounts in exact cents</p>
      </div>
    </main>
  );
}
