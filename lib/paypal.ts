import { env, isDemoMode } from "./env";
import { dbOperations } from "./db";
import { calculateInvoiceTotal, fromCents, toCents } from "./money";

export interface PayPalApiErrorDetail {
  field?: string;
  value?: string;
  location?: string;
  issue: string;
  description?: string;
}

export class PayPalApiError extends Error {
  public statusCode: number;
  public errorName: string;
  public debugId?: string;
  public details?: PayPalApiErrorDetail[];

  constructor(params: {
    message: string;
    statusCode: number;
    errorName: string;
    debugId?: string;
    details?: PayPalApiErrorDetail[];
  }) {
    super(params.message);
    this.name = "PayPalApiError";
    this.statusCode = params.statusCode;
    this.errorName = params.errorName;
    this.debugId = params.debugId;
    this.details = params.details;
  }

  public toDetailedString(): string {
    const lines = [
      `PayPal API Error [${this.statusCode} ${this.errorName}]: ${this.message}`,
      this.debugId ? `Debug ID: ${this.debugId}` : null,
      this.details && this.details.length > 0
        ? `Details:\n${this.details
            .map(
              (d) =>
                `  - ${d.field ? `[${d.field}] ` : ""}${d.issue}: ${d.description || ""}`
            )
            .join("\n")}`
        : null,
    ].filter(Boolean);

    return lines.join("\n");
  }
}

// Token cache state
interface TokenCache {
  token: string;
  expiresAt: number; // Unix timestamp in ms
}

let cachedToken: TokenCache | null = null;

/**
 * Retrieves a PayPal OAuth2 Access Token using client credentials.
 * Tokens are cached in-memory until near expiry (with 60s safety buffer).
 */
export async function getAccessToken(forceRefresh = false): Promise<string> {
  if (isDemoMode) {
    return "MOCK_PAYPAL_ACCESS_TOKEN_DEMO";
  }

  const now = Date.now();
  const bufferMs = 60 * 1000; // 60 seconds buffer

  if (!forceRefresh && cachedToken && now < cachedToken.expiresAt - bufferMs) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(
    `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const url = `${env.PAYPAL_BASE_URL}/v1/oauth2/token`;
  const response = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = (await parseResponse(response)) as {
    access_token: string;
    token_type: string;
    expires_in: number;
  };

  cachedToken = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return cachedToken.token;
}

/**
 * Centralized fetch with 15s timeout and 1 retry on 5xx errors.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempt = 1
): Promise<Response> {
  const timeoutMs = 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timer);

    // If 5xx and first attempt, retry once after 1s
    if (response.status >= 500 && attempt === 1) {
      console.warn(
        `PayPal returned 5xx (${response.status}). Retrying once in 1000ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, attempt + 1);
    }

    return response;
  } catch (error: any) {
    clearTimeout(timer);

    if (error.name === "AbortError") {
      throw new PayPalApiError({
        statusCode: 408,
        errorName: "TIMEOUT",
        message: `PayPal request timed out after ${timeoutMs}ms: ${url}`,
      });
    }

    if (attempt === 1) {
      console.warn(
        `Network failure on PayPal request (${error.message}). Retrying once...`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return fetchWithRetry(url, options, attempt + 1);
    }

    throw error;
  }
}

/**
 * Parses response JSON or extracts detailed PayPal error information.
 */
async function parseResponse<T = any>(response: Response): Promise<T> {
  const debugIdFromHeader = response.headers.get("paypal-debug-id") || undefined;
  const contentType = response.headers.get("content-type") || "";

  if (response.status === 204) {
    return {} as T;
  }

  let body: any = null;
  if (contentType.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  } else {
    try {
      const text = await response.text();
      body = { message: text };
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const errorName = body?.name || `HTTP_${response.status}`;
    const message =
      body?.message || body?.error_description || response.statusText;
    const debugId = body?.debug_id || debugIdFromHeader;
    const details = body?.details;

    throw new PayPalApiError({
      statusCode: response.status,
      errorName,
      message,
      debugId,
      details,
    });
  }

  return body as T;
}

/**
 * Authenticated API call helper.
 */
async function paypalRequest<T = any>(
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const token = await getAccessToken();
  const url = `${env.PAYPAL_BASE_URL}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const response = await fetchWithRetry(url, {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  return parseResponse<T>(response);
}

// --------------------------------------------------------------------------
// PayPal Invoicing v2 API Methods (Real or Mock via SQLite)
// --------------------------------------------------------------------------

export interface InvoiceItem {
  name: string;
  description?: string;
  quantity: string; // Must be string in Invoicing v2
  unit_amount: {
    currency_code: string;
    value: string;
  };
  tax?: {
    name?: string;
    percent?: string;
  };
}

export interface CreateInvoicePayload {
  detail: {
    invoice_number?: string;
    invoice_date?: string; // YYYY-MM-DD
    currency_code: string;
    note?: string;
    term_type?: string;
    payment_term?: {
      term_type?: string;
      due_date?: string; // YYYY-MM-DD
    };
  };
  invoicer?: {
    name?: {
      given_name?: string;
      surname?: string;
    };
    business_name?: string;
    email_address?: string;
    website?: string;
    tax_id?: string;
    phones?: any[];
    address?: any;
  };
  primary_recipients: Array<{
    billing_info: {
      name?: {
        given_name?: string;
        surname?: string;
      };
      email_address: string;
      business_name?: string;
      phones?: any[];
      address?: any;
    };
  }>;
  items: InvoiceItem[];
  configuration?: {
    allow_tip?: boolean;
    tax_calculated_after_discount?: boolean;
    tax_inclusive?: boolean;
  };
}

export interface PayPalInvoice {
  id: string;
  status:
    | "DRAFT"
    | "SENT"
    | "SCHEDULED"
    | "PAID"
    | "MARKED_AS_PAID"
    | "CANCELLED"
    | "REFUNDED"
    | "PARTIALLY_PAID"
    | "PARTIALLY_REFUNDED"
    | "PAYMENT_PENDING";
  detail: {
    invoice_number: string;
    invoice_date: string;
    currency_code: string;
    note?: string;
    term_type?: string;
    payment_term?: {
      term_type?: string;
      due_date?: string;
    };
    metadata?: {
      create_time?: string;
      created_by?: string;
      last_update_time?: string;
      last_updated_by?: string;
      cancel_time?: string;
      cancelled_by?: string;
    };
  };
  invoicer?: any;
  primary_recipients?: any[];
  items?: InvoiceItem[];
  amount?: {
    currency_code: string;
    value: string;
    breakdown?: any;
  };
  payments?: {
    paid_amount?: {
      currency_code: string;
      value: string;
    };
    transactions?: any[];
  };
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface NotificationOptions {
  subject?: string;
  note?: string;
  send_to_invoicer?: boolean;
  send_to_recipient?: boolean;
  additional_recipients?: string[];
}

export interface ListInvoicesParams {
  page?: number;
  pageSize?: number;
  totalCountRequired?: boolean;
}

export interface InvoiceListResponse {
  total_items?: number;
  total_pages?: number;
  items: PayPalInvoice[];
  links?: Array<{ href: string; rel: string; method: string }>;
}

export interface CancelInvoiceOptions {
  subject?: string;
  note?: string;
  send_to_invoicer?: boolean;
  send_to_recipient?: boolean;
  additional_recipients?: string[];
}

export interface RecordPaymentPayload {
  method:
    | "BANK_TRANSFER"
    | "CASH"
    | "CHECK"
    | "CREDIT_CARD"
    | "DEBIT_CARD"
    | "PAYPAL"
    | "WIRE_TRANSFER"
    | "OTHER";
  payment_date: string; // YYYY-MM-DD
  amount?: {
    currency_code: string;
    value: string;
  };
  payment_id?: string;
  note?: string;
}

/**
 * Generates the next available invoice number.
 * POST /v2/invoicing/generate-next-invoice-number
 */
export async function generateInvoiceNumber(): Promise<string> {
  if (isDemoMode) {
    const count = dbOperations.countMockInvoices();
    return `INV2-${String(count + 1).padStart(4, "0")}`;
  }

  const data = await paypalRequest<{ invoice_number: string }>(
    "/v2/invoicing/generate-next-invoice-number",
    {
      method: "POST",
      body: {},
    }
  );
  return data.invoice_number;
}

/**
 * Creates a draft invoice.
 * POST /v2/invoicing/invoices
 */
export async function createDraftInvoice(
  payload: CreateInvoicePayload
): Promise<PayPalInvoice> {
  if (isDemoMode) {
    // Generate deterministic mock invoice
    const count = dbOperations.countMockInvoices();
    const id = `INV2-DEMO-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const invoiceNumber =
      payload.detail.invoice_number || `INV2-${String(count + 1).padStart(4, "0")}`;

    // Compute safe total with integer-cents math
    const total = calculateInvoiceTotal(
      payload.items.map((i) => ({
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_amount.value) || 0,
      }))
    );
    const totalStr = total.formatted;

    const mockInvoice: PayPalInvoice = {
      id,
      status: "DRAFT",
      detail: {
        invoice_number: invoiceNumber,
        invoice_date:
          payload.detail.invoice_date || new Date().toISOString().slice(0, 10),
        currency_code: payload.detail.currency_code,
        note: payload.detail.note,
        payment_term: payload.detail.payment_term,
        metadata: {
          create_time: new Date().toISOString(),
          last_update_time: new Date().toISOString(),
        },
      },
      invoicer: {
        business_name: payload.invoicer?.business_name || env.BUSINESS_NAME,
        email_address: payload.invoicer?.email_address || env.BUSINESS_EMAIL,
      },
      primary_recipients: payload.primary_recipients,
      items: payload.items,
      amount: {
        currency_code: payload.detail.currency_code,
        value: totalStr,
        breakdown: {
          item_total: {
            currency_code: payload.detail.currency_code,
            value: totalStr,
          },
        },
      },
      links: [
        {
          href: `https://www.sandbox.paypal.com/invoice/p/#DEMO-${id}`,
          rel: "self",
          method: "GET",
        },
        {
          href: `https://www.sandbox.paypal.com/invoice/p/#DEMO-${id}`,
          rel: "payer-view",
          method: "GET",
        },
      ],
    };

    dbOperations.saveMockInvoice(mockInvoice);
    return mockInvoice;
  }

  const response = await paypalRequest<any>("/v2/invoicing/invoices", {
    method: "POST",
    body: payload,
  });

  // Extract ID from response.id, response.href, or response.links
  let invoiceId = response.id;
  if (!invoiceId && response.href) {
    const parts = response.href.split("/");
    invoiceId = parts[parts.length - 1];
  }
  if (!invoiceId && Array.isArray(response.links)) {
    const selfLink = response.links.find((l: any) => l.rel === "self");
    if (selfLink) {
      const parts = selfLink.href.split("/");
      invoiceId = parts[parts.length - 1];
    }
  }

  if (invoiceId) {
    try {
      const fullInvoice = await getInvoice(invoiceId);
      return fullInvoice;
    } catch {
      return { id: invoiceId, status: "DRAFT", ...response };
    }
  }

  return response;
}

/**
 * Sends a draft invoice to the customer.
 * POST /v2/invoicing/invoices/{invoice_id}/send
 */
export async function sendInvoice(
  invoiceId: string,
  options: NotificationOptions = {}
): Promise<{ success: boolean; invoiceId: string; href?: string }> {
  if (isDemoMode) {
    const invoice = dbOperations.getMockInvoice(invoiceId);
    if (!invoice) {
      throw new PayPalApiError({
        statusCode: 404,
        errorName: "RESOURCE_NOT_FOUND",
        message: `Invoice ${invoiceId} not found in demo storage.`,
      });
    }

    invoice.status = "SENT";
    invoice.detail.metadata = {
      ...invoice.detail.metadata,
      last_update_time: new Date().toISOString(),
    };
    dbOperations.saveMockInvoice(invoice);

    return {
      success: true,
      invoiceId,
      href: `https://www.sandbox.paypal.com/invoice/p/#DEMO-${invoiceId}`,
    };
  }

  const result = await paypalRequest<{ href?: string; rel?: string }>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`,
    {
      method: "POST",
      body: {
        send_to_invoicer: options.send_to_invoicer ?? false,
        send_to_recipient: options.send_to_recipient ?? true,
        ...(options.subject ? { subject: options.subject } : {}),
        ...(options.note ? { note: options.note } : {}),
        ...(options.additional_recipients
          ? { additional_recipients: options.additional_recipients }
          : {}),
      },
    }
  );

  return { success: true, invoiceId, href: result.href };
}

/**
 * Fetches an invoice by ID.
 * GET /v2/invoicing/invoices/{invoice_id}
 */
export async function getInvoice(invoiceId: string): Promise<PayPalInvoice> {
  if (isDemoMode) {
    const invoice = dbOperations.getMockInvoice(invoiceId);
    if (!invoice) {
      throw new PayPalApiError({
        statusCode: 404,
        errorName: "RESOURCE_NOT_FOUND",
        message: `Invoice ${invoiceId} not found in demo store.`,
      });
    }
    return invoice;
  }

  return paypalRequest<PayPalInvoice>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}`
  );
}

/**
 * Lists invoices.
 * GET /v2/invoicing/invoices
 */
export async function listInvoices(
  params: ListInvoicesParams = {}
): Promise<InvoiceListResponse> {
  if (isDemoMode) {
    const result = dbOperations.listMockInvoices(
      params.page || 1,
      params.pageSize || 20
    );
    return {
      items: result.items,
      total_items: result.total_items,
      total_pages: result.total_pages,
    };
  }

  const query = new URLSearchParams();
  if (params.page !== undefined) query.set("page", params.page.toString());
  if (params.pageSize !== undefined)
    query.set("page_size", params.pageSize.toString());
  if (params.totalCountRequired !== undefined)
    query.set("total_count_required", params.totalCountRequired.toString());

  const queryString = query.toString();
  const path = `/v2/invoicing/invoices${queryString ? `?${queryString}` : ""}`;
  return paypalRequest<InvoiceListResponse>(path);
}

/**
 * Sends a payment reminder for an invoice.
 * POST /v2/invoicing/invoices/{invoice_id}/remind
 */
export async function sendReminder(
  invoiceId: string,
  options: NotificationOptions = {}
): Promise<{ success: boolean; invoiceId: string }> {
  if (isDemoMode) {
    const invoice = dbOperations.getMockInvoice(invoiceId);
    if (!invoice) {
      throw new PayPalApiError({
        statusCode: 404,
        errorName: "RESOURCE_NOT_FOUND",
        message: `Invoice ${invoiceId} not found in demo storage.`,
      });
    }
    return { success: true, invoiceId };
  }

  await paypalRequest(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`,
    {
      method: "POST",
      body: {
        send_to_invoicer: options.send_to_invoicer ?? false,
        send_to_recipient: options.send_to_recipient ?? true,
        ...(options.subject ? { subject: options.subject } : {}),
        ...(options.note ? { note: options.note } : {}),
        ...(options.additional_recipients
          ? { additional_recipients: options.additional_recipients }
          : {}),
      },
    }
  );

  return { success: true, invoiceId };
}

/**
 * Cancels a sent invoice.
 * POST /v2/invoicing/invoices/{invoice_id}/cancel
 */
export async function cancelInvoice(
  invoiceId: string,
  options: CancelInvoiceOptions = {}
): Promise<{ success: boolean; invoiceId: string }> {
  if (isDemoMode) {
    const invoice = dbOperations.getMockInvoice(invoiceId);
    if (!invoice) {
      throw new PayPalApiError({
        statusCode: 404,
        errorName: "RESOURCE_NOT_FOUND",
        message: `Invoice ${invoiceId} not found in demo storage.`,
      });
    }

    invoice.status = "CANCELLED";
    invoice.detail.metadata = {
      ...invoice.detail.metadata,
      cancel_time: new Date().toISOString(),
      last_update_time: new Date().toISOString(),
    };
    dbOperations.saveMockInvoice(invoice);

    return { success: true, invoiceId };
  }

  await paypalRequest(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/cancel`,
    {
      method: "POST",
      body: {
        send_to_invoicer: options.send_to_invoicer ?? false,
        send_to_recipient: options.send_to_recipient ?? true,
        ...(options.subject ? { subject: options.subject } : {}),
        ...(options.note ? { note: options.note } : {}),
        ...(options.additional_recipients
          ? { additional_recipients: options.additional_recipients }
          : {}),
      },
    }
  );

  return { success: true, invoiceId };
}

/**
 * Records a payment against an invoice (e.g. for sandbox demo payments).
 * POST /v2/invoicing/invoices/{invoice_id}/payments
 */
export async function recordPayment(
  invoiceId: string,
  payment: RecordPaymentPayload
): Promise<{ payment_id: string }> {
  if (isDemoMode) {
    const invoice = dbOperations.getMockInvoice(invoiceId);
    if (!invoice) {
      throw new PayPalApiError({
        statusCode: 404,
        errorName: "RESOURCE_NOT_FOUND",
        message: `Invoice ${invoiceId} not found in demo storage.`,
      });
    }

    invoice.status = "MARKED_AS_PAID";
    invoice.payments = {
      paid_amount: payment.amount || invoice.amount,
      transactions: [
        {
          payment_id: `PAY-DEMO-${Date.now()}`,
          payment_date: payment.payment_date,
          method: payment.method,
          amount: payment.amount || invoice.amount,
          note: payment.note,
        },
      ],
    };
    dbOperations.saveMockInvoice(invoice);

    return { payment_id: `PAY-DEMO-${Date.now()}` };
  }

  return paypalRequest<{ payment_id: string }>(
    `/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`,
    {
      method: "POST",
      body: payment,
    }
  );
}
