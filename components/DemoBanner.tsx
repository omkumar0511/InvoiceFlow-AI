"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Info, ArrowRight, X } from "lucide-react";

export function DemoBanner() {
  const [isDemo, setIsDemo] = useState<boolean | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((res) => res.json())
      .then((data) => {
        setIsDemo(Boolean(data.isDemoMode));
      })
      .catch(() => {
        setIsDemo(false);
      });
  }, []);

  if (!isDemo || isDismissed) {
    return null;
  }

  return (
    <aside
      aria-label="Demo mode announcement"
      className="relative z-40 bg-gradient-to-r from-amber-500/15 via-blue-500/10 to-teal-500/15 border-b border-amber-500/20 text-slate-800 dark:text-slate-200 text-xs sm:text-sm px-4 py-2.5 transition-all"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
            <Sparkles className="w-3 h-3 text-amber-500 animate-pulse" />
            Demo Mode Active
          </span>
          <span className="text-slate-600 dark:text-slate-300">
            Running with simulated PayPal Invoicing v2 & deterministic Gemini AI
            (no credentials required).
          </span>
          <Link
            href="/about#setup"
            className="inline-flex items-center gap-1 font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            Switch to Real Mode
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          aria-label="Dismiss demo mode banner"
          className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1 rounded-md transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
