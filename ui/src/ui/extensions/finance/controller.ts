/**
 * Finance Controller - Data loading and API interactions
 * Handles all data operations for the bookkeeping module
 */

import type { GatewayBrowserClient } from "../../gateway.js";

// Type definitions
export interface Invoice {
  id: string;
  company: "aexy" | "carxo";
  vendor: string;
  amount: number;
  currency: string;
  date: string;
  file: string;
  statementLineId: string | null;
  category: string | null;
}

export interface Statement {
  id: string;
  company: "aexy" | "carxo";
  bank: string;
  file: string;
  uploadedAt: string;
}

export interface StatementLine {
  id: string;
  statementId: string;
  date: string;
  description: string;
  amount: number;
  invoiceId: string | null;
}

export interface Email {
  id: string;
  from: string;
  subject: string;
  date: string;
  hasAttachments: boolean;
  attachments?: Array<{ filename: string; mimeType: string }>;
}

export interface FinanceData {
  companies: string[];
  invoices: Invoice[];
  statements: Statement[];
  statementLines: StatementLine[];
  categories: string[];
}

export type CompanyFilter = "all" | "aexy" | "carxo";

const DATA_FILE = "finance-data.json";

/**
 * Load finance data from workspace
 */
export async function loadFinanceData(gateway: GatewayBrowserClient): Promise<FinanceData> {
  try {
    const result = await gateway.call("agents.files.read", {
      agentId: "main",
      name: DATA_FILE,
    });
    if (result && typeof result === "object" && "content" in result) {
      return JSON.parse(result.content as string);
    }
  } catch (e) {
    console.warn("Finance data not found, using defaults:", e);
  }
  return getDefaultData();
}

/**
 * Save finance data to workspace
 */
export async function saveFinanceData(
  gateway: GatewayBrowserClient,
  data: FinanceData,
): Promise<void> {
  await gateway.call("agents.files.write", {
    agentId: "main",
    name: DATA_FILE,
    content: JSON.stringify(data, null, 2),
  });
}

/**
 * Get default/mock data for development
 */
function getDefaultData(): FinanceData {
  return {
    companies: ["aexy", "carxo"],
    invoices: [
      {
        id: "inv-001",
        company: "aexy",
        vendor: "DigitalOcean",
        amount: 156.0,
        currency: "EUR",
        date: "2026-01-15",
        file: "finance/invoices/digitalocean-jan.pdf",
        statementLineId: "sl-001",
        category: "hosting",
      },
      {
        id: "inv-002",
        company: "aexy",
        vendor: "GitHub",
        amount: 21.0,
        currency: "EUR",
        date: "2026-01-20",
        file: "finance/invoices/github-jan.pdf",
        statementLineId: null,
        category: "software",
      },
      {
        id: "inv-003",
        company: "carxo",
        vendor: "AWS",
        amount: 342.5,
        currency: "EUR",
        date: "2026-01-18",
        file: "finance/invoices/aws-jan.pdf",
        statementLineId: "sl-005",
        category: "hosting",
      },
      {
        id: "inv-004",
        company: "aexy",
        vendor: "Figma",
        amount: 45.0,
        currency: "EUR",
        date: "2026-02-01",
        file: "finance/invoices/figma-feb.pdf",
        statementLineId: null,
        category: "software",
      },
      {
        id: "inv-005",
        company: "carxo",
        vendor: "Google Ads",
        amount: 500.0,
        currency: "EUR",
        date: "2026-02-03",
        file: "finance/invoices/google-ads-feb.pdf",
        statementLineId: null,
        category: "marketing",
      },
    ],
    statements: [
      {
        id: "stmt-001",
        company: "aexy",
        bank: "Swedbank",
        file: "finance/statements/aexy-jan-2026.csv",
        uploadedAt: "2026-02-01T10:00:00Z",
      },
      {
        id: "stmt-002",
        company: "carxo",
        bank: "Revolut Business",
        file: "finance/statements/carxo-jan-2026.csv",
        uploadedAt: "2026-02-01T10:15:00Z",
      },
    ],
    statementLines: [
      {
        id: "sl-001",
        statementId: "stmt-001",
        date: "2026-01-15",
        description: "DIGITALOCEAN.COM",
        amount: -156.0,
        invoiceId: "inv-001",
      },
      {
        id: "sl-002",
        statementId: "stmt-001",
        date: "2026-01-22",
        description: "GITHUB INC",
        amount: -21.0,
        invoiceId: null,
      },
      {
        id: "sl-003",
        statementId: "stmt-001",
        date: "2026-01-25",
        description: "STRIPE PAYOUT",
        amount: 1250.0,
        invoiceId: null,
      },
      {
        id: "sl-004",
        statementId: "stmt-001",
        date: "2026-02-02",
        description: "FIGMA INC",
        amount: -45.0,
        invoiceId: null,
      },
      {
        id: "sl-005",
        statementId: "stmt-002",
        date: "2026-01-18",
        description: "Amazon Web Services",
        amount: -342.5,
        invoiceId: "inv-003",
      },
      {
        id: "sl-006",
        statementId: "stmt-002",
        date: "2026-02-03",
        description: "GOOGLE ADS",
        amount: -500.0,
        invoiceId: null,
      },
      {
        id: "sl-007",
        statementId: "stmt-002",
        date: "2026-01-30",
        description: "CLIENT PAYMENT - ACME CORP",
        amount: 3500.0,
        invoiceId: null,
      },
    ],
    categories: [
      "software",
      "hosting",
      "services",
      "marketing",
      "travel",
      "office",
      "legal",
      "other",
    ],
  };
}

/**
 * Filter invoices by company
 */
export function getInvoices(data: FinanceData, companyFilter: CompanyFilter = "all"): Invoice[] {
  if (companyFilter === "all") return data.invoices;
  return data.invoices.filter((inv) => inv.company === companyFilter);
}

/**
 * Get unmatched invoices (no statementLineId)
 */
export function getUnmatchedInvoices(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): Invoice[] {
  return getInvoices(data, companyFilter).filter((inv) => !inv.statementLineId);
}

/**
 * Get matched invoices
 */
export function getMatchedInvoices(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): Invoice[] {
  return getInvoices(data, companyFilter).filter((inv) => inv.statementLineId);
}

/**
 * Filter statements by company
 */
export function getStatements(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): Statement[] {
  if (companyFilter === "all") return data.statements;
  return data.statements.filter((stmt) => stmt.company === companyFilter);
}

/**
 * Get statement lines, optionally filtered by company (via statement)
 */
export function getStatementLines(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): StatementLine[] {
  if (companyFilter === "all") return data.statementLines;
  const companyStatements = getStatements(data, companyFilter);
  const statementIds = new Set(companyStatements.map((s) => s.id));
  return data.statementLines.filter((sl) => statementIds.has(sl.statementId));
}

/**
 * Get unmatched statement lines (no invoiceId, expenses only)
 */
export function getUnmatchedStatementLines(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): StatementLine[] {
  return getStatementLines(data, companyFilter).filter((sl) => !sl.invoiceId && sl.amount < 0);
}

/**
 * Match an invoice to a statement line
 */
export function matchInvoiceToLine(
  data: FinanceData,
  invoiceId: string,
  statementLineId: string,
): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  const invoice = newData.invoices.find((inv) => inv.id === invoiceId);
  const line = newData.statementLines.find((sl) => sl.id === statementLineId);

  if (invoice && line) {
    invoice.statementLineId = statementLineId;
    line.invoiceId = invoiceId;
  }
  return newData;
}

/**
 * Unmatch an invoice
 */
export function unmatchInvoice(data: FinanceData, invoiceId: string): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  const invoice = newData.invoices.find((inv) => inv.id === invoiceId);

  if (invoice && invoice.statementLineId) {
    const line = newData.statementLines.find((sl) => sl.id === invoice.statementLineId);
    if (line) line.invoiceId = null;
    invoice.statementLineId = null;
  }
  return newData;
}

/**
 * Auto-suggest matches based on amount and date proximity
 */
export function suggestMatches(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): Array<{ invoice: Invoice; line: StatementLine; confidence: number }> {
  const invoices = getUnmatchedInvoices(data, companyFilter);
  const lines = getUnmatchedStatementLines(data, companyFilter);
  const suggestions: Array<{ invoice: Invoice; line: StatementLine; confidence: number }> = [];

  for (const invoice of invoices) {
    for (const line of lines) {
      // Amount must match (negative statement amount matches positive invoice)
      if (Math.abs(line.amount) !== invoice.amount) continue;

      // Calculate date proximity (within 14 days)
      const invoiceDate = new Date(invoice.date);
      const lineDate = new Date(line.date);
      const daysDiff = Math.abs(
        (invoiceDate.getTime() - lineDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff <= 14) {
        const confidence = daysDiff <= 3 ? 0.95 : daysDiff <= 7 ? 0.8 : 0.6;
        suggestions.push({ invoice, line, confidence });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Add a new invoice
 */
export function addInvoice(data: FinanceData, invoice: Omit<Invoice, "id">): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  const newInvoice: Invoice = {
    ...invoice,
    id: `inv-${Date.now()}`,
  };
  newData.invoices.push(newInvoice);
  return newData;
}

/**
 * Update invoice category
 */
export function updateInvoiceCategory(
  data: FinanceData,
  invoiceId: string,
  category: string,
): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  const invoice = newData.invoices.find((inv) => inv.id === invoiceId);
  if (invoice) {
    invoice.category = category;
  }
  return newData;
}

/**
 * Parse CSV bank statement
 */
export function parseCSV(csvContent: string): StatementLine[] {
  const lines = csvContent.trim().split("\n");
  if (lines.length < 2) return [];

  const parsed: StatementLine[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length >= 3) {
      parsed.push({
        id: `sl-${Date.now()}-${i}`,
        statementId: "",
        date: parts[0],
        description: parts[1],
        amount: parseFloat(parts[2]) || 0,
        invoiceId: null,
      });
    }
  }
  return parsed;
}

/**
 * Add a bank statement with parsed lines
 */
export function addStatement(
  data: FinanceData,
  company: "aexy" | "carxo",
  bank: string,
  file: string,
  lines: StatementLine[],
): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  const statement: Statement = {
    id: `stmt-${Date.now()}`,
    company,
    bank,
    file,
    uploadedAt: new Date().toISOString(),
  };

  for (const line of lines) {
    line.statementId = statement.id;
  }

  newData.statements.push(statement);
  newData.statementLines.push(...lines);
  return newData;
}

/**
 * Get spending by category for reports
 */
export function getSpendingByCategory(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
  startDate?: string,
  endDate?: string,
): Record<string, number> {
  const invoices = getMatchedInvoices(data, companyFilter);
  const spending: Record<string, number> = {};

  for (const invoice of invoices) {
    if (startDate && invoice.date < startDate) continue;
    if (endDate && invoice.date > endDate) continue;

    const category = invoice.category || "other";
    spending[category] = (spending[category] || 0) + invoice.amount;
  }

  return spending;
}

/**
 * Get spending by month
 */
export function getSpendingByMonth(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
): Record<string, number> {
  const invoices = getMatchedInvoices(data, companyFilter);
  const spending: Record<string, number> = {};

  for (const invoice of invoices) {
    const month = invoice.date.substring(0, 7);
    spending[month] = (spending[month] || 0) + invoice.amount;
  }

  return spending;
}

/**
 * Get spending by vendor
 */
export function getSpendingByVendor(
  data: FinanceData,
  companyFilter: CompanyFilter = "all",
  startDate?: string,
  endDate?: string,
): Array<{ vendor: string; total: number; count: number }> {
  const invoices = getMatchedInvoices(data, companyFilter);
  const vendors: Record<string, { total: number; count: number }> = {};

  for (const invoice of invoices) {
    if (startDate && invoice.date < startDate) continue;
    if (endDate && invoice.date > endDate) continue;

    if (!vendors[invoice.vendor]) {
      vendors[invoice.vendor] = { total: 0, count: 0 };
    }
    vendors[invoice.vendor].total += invoice.amount;
    vendors[invoice.vendor].count++;
  }

  return Object.entries(vendors)
    .map(([vendor, data]) => ({ vendor, ...data }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Get inbox emails (mock until Gmail API ready)
 */
export async function getInboxEmails(_gateway: GatewayBrowserClient): Promise<Email[]> {
  // TODO: Integrate with Gmail API when Infra Agent completes it
  // const result = await gateway.call("gmail.messages.list", { query: "has:attachment filename:pdf" });
  return [
    {
      id: "email-001",
      from: "billing@digitalocean.com",
      subject: "Your DigitalOcean Invoice",
      date: "2026-02-05",
      hasAttachments: true,
      attachments: [{ filename: "invoice-feb-2026.pdf", mimeType: "application/pdf" }],
    },
    {
      id: "email-002",
      from: "noreply@github.com",
      subject: "GitHub Invoice - February 2026",
      date: "2026-02-04",
      hasAttachments: true,
      attachments: [{ filename: "github-invoice.pdf", mimeType: "application/pdf" }],
    },
    {
      id: "email-003",
      from: "billing@aws.amazon.com",
      subject: "AWS Invoice Available",
      date: "2026-02-03",
      hasAttachments: false,
    },
    {
      id: "email-004",
      from: "invoices@stripe.com",
      subject: "Your Stripe fees receipt",
      date: "2026-02-02",
      hasAttachments: true,
      attachments: [{ filename: "stripe-receipt.pdf", mimeType: "application/pdf" }],
    },
  ];
}

/**
 * Format currency
 */
export function formatCurrency(amount: number, currency = "EUR"): string {
  return new Intl.NumberFormat("en-EU", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Format date
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
