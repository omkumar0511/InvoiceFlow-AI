"use client";

import React, { useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, RowClickedEvent } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { formatMoneyDisplay } from "@/lib/money";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  amount: string;
  currency: string;
  due_date: string;
  created_date: string;
  status: string;
  computed_status: string;
  original_prompt: string | null;
  local_created_at: string | null;
  paypal_link: string;
}

interface InvoiceGridProps {
  invoices: InvoiceRow[];
  quickFilterText: string;
}

export function InvoiceGrid({ invoices, quickFilterText }: InvoiceGridProps) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();

  // Status Badge Renderer
  const StatusCellRenderer = useCallback((params: any) => {
    const status = (params.value || "DRAFT").toUpperCase();

    let badgeClass =
      "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

    if (status === "PAID" || status === "MARKED_AS_PAID") {
      badgeClass =
        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    } else if (status === "SENT" || status === "SCHEDULED") {
      badgeClass =
        "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800";
    } else if (status === "OVERDUE") {
      badgeClass =
        "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    } else if (status === "CANCELLED" || status === "REFUNDED") {
      badgeClass =
        "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";
    }

    return (
      <div className="flex h-full items-center">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${badgeClass}`}
        >
          {status}
        </span>
      </div>
    );
  }, []);

  // Client Name & Email Renderer
  const ClientCellRenderer = useCallback((params: any) => {
    const name = params.data?.client_name || "Client";
    const email = params.data?.client_email || "";
    return (
      <div className="flex flex-col justify-center h-full py-1">
        <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm leading-tight">
          {name}
        </span>
        {email && (
          <span className="text-xs text-slate-400 dark:text-slate-500 leading-tight">
            {email}
          </span>
        )}
      </div>
    );
  }, []);

  // Amount Renderer
  const AmountCellRenderer = useCallback((params: any) => {
    const formatted = formatMoneyDisplay(
      params.data?.amount,
      params.data?.currency || "USD"
    );
    return (
      <div className="flex h-full items-center justify-end font-semibold text-slate-900 dark:text-slate-100">
        {formatted}
      </div>
    );
  }, []);

  // Column Definitions
  const columnDefs = useMemo<ColDef<InvoiceRow>[]>(() => {
    return [
      {
        field: "invoice_number",
        headerName: "Invoice #",
        width: 130,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center font-mono font-bold text-teal-600 dark:text-teal-400">
            #{params.value}
          </div>
        ),
      },
      {
        field: "client_name",
        headerName: "Client",
        flex: 1.5,
        minWidth: 200,
        sortable: true,
        cellRenderer: ClientCellRenderer,
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        sortable: true,
        cellRenderer: AmountCellRenderer,
        headerClass: "ag-right-aligned-header",
      },
      {
        field: "due_date",
        headerName: "Due Date",
        width: 130,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center text-sm text-slate-600 dark:text-slate-400">
            {params.value || "—"}
          </div>
        ),
      },
      {
        field: "computed_status",
        headerName: "Status",
        width: 130,
        sortable: true,
        cellRenderer: StatusCellRenderer,
      },
      {
        field: "created_date",
        headerName: "Created",
        width: 120,
        sortable: true,
        cellRenderer: (params: any) => (
          <div className="flex h-full items-center text-xs text-slate-400 dark:text-slate-500">
            {params.value || "—"}
          </div>
        ),
      },
    ];
  }, [ClientCellRenderer, AmountCellRenderer, StatusCellRenderer]);

  const onRowClicked = useCallback(
    (event: RowClickedEvent<InvoiceRow>) => {
      if (event.data?.id) {
        router.push(`/invoices/${event.data.id}`);
      }
    },
    [router]
  );

  const isDark = resolvedTheme === "dark";

  return (
    <div
      className={`${
        isDark ? "ag-theme-quartz-dark" : "ag-theme-quartz"
      } w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm transition-all`}
      style={{ height: 480 }}
    >
      <AgGridReact<InvoiceRow>
        rowData={invoices}
        columnDefs={columnDefs}
        quickFilterText={quickFilterText}
        onRowClicked={onRowClicked}
        rowSelection="single"
        animateRows={true}
        pagination={true}
        paginationPageSize={10}
        paginationPageSizeSelector={[10, 25, 50]}
        rowHeight={56}
        headerHeight={44}
        overlayNoRowsTemplate={
          '<span class="text-sm text-slate-500">No matching invoices found</span>'
        }
      />
    </div>
  );
}
