"use client";

import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface SummaryData {
  narrative: string;
  actionable_suggestion: string;
  cached?: boolean;
  created_at?: string;
}

export function BusinessSummaryCard() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (force = false) => {
    if (force) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const url = force ? "/api/summary?refresh=true" : "/api/summary";
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to generate business summary.");
      }

      setSummary(json.data);
      if (force) {
        toast.success("AI business insights refreshed!");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load summary.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-r from-teal-50/60 via-cyan-50/30 to-white p-6 shadow-sm dark:border-teal-900/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900/80 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 bg-teal-200 dark:bg-teal-900 rounded-md" />
          <div className="h-4 w-40 bg-teal-100 dark:bg-teal-950 rounded" />
        </div>
        <div className="space-y-2 mt-4">
          <div className="h-4 w-full bg-slate-200/80 dark:bg-slate-800 rounded" />
          <div className="h-4 w-3/4 bg-slate-200/80 dark:bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (error && !summary) {
    return null; // Silently fail or hide if API is busy
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-teal-200/80 bg-gradient-to-br from-teal-50/70 via-white to-cyan-50/50 p-6 shadow-sm dark:border-teal-900/50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-teal-100/80 pb-4 dark:border-teal-900/40">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white shadow-sm shadow-teal-500/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>AI Executive Insights</span>
              {summary?.cached && (
                <span className="rounded bg-teal-100/80 px-1.5 py-0.5 text-[10px] font-medium text-teal-800 dark:bg-teal-950 dark:text-teal-300">
                  Cached
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Grounded exclusively in precomputed PayPal revenue totals
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => fetchSummary(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 rounded-lg border border-teal-300/60 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 shadow-sm hover:bg-teal-50 dark:border-teal-800 dark:bg-slate-800 dark:text-teal-300 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-teal-600" : ""}`} />
          <span>{isRefreshing ? "Analyzing..." : "Refresh Insights"}</span>
        </button>
      </div>

      {summary && (
        <div className="mt-4 space-y-3.5">
          {/* Narrative */}
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {summary.narrative}
          </p>

          {/* Actionable Suggestion Callout */}
          <div className="flex items-start gap-3 rounded-xl border border-teal-200/80 bg-teal-50/60 p-3.5 dark:border-teal-900/40 dark:bg-teal-950/40">
            <Lightbulb className="h-4 w-4 text-teal-600 dark:text-teal-400 mt-0.5 shrink-0" />
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-300">
                Actionable Recommendation
              </span>
              <p className="text-xs text-teal-800 dark:text-teal-200 mt-0.5 font-medium leading-relaxed">
                {summary.actionable_suggestion}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
