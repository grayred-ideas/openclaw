/**
 * Finance Controller - Data loading and API interactions
 * Handles all data operations for the bookkeeping module
 */

import type { GatewayBrowserClient } from "../../gateway.js";

// Usage/Cost API types
export interface UsageWindow {
  label: string;
  usedPercent: number;
  resetAt?: number;
}

export interface ProviderUsageSnapshot {
  provider: string;
  displayName: string;
  windows: UsageWindow[];
  plan?: string;
  error?: string;
}

export interface UsageSummary {
  updatedAt: number;
  providers: ProviderUsageSnapshot[];
}

export interface CostUsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  missingCostEntries: number;
}

export interface CostUsageDailyEntry extends CostUsageTotals {
  date: string;
}

export interface CostUsageSummary {
  updatedAt: number;
  days: number;
  daily: CostUsageDailyEntry[];
  totals: CostUsageTotals;
}

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
  description?: string;
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

export type MatchSuggestion = {
  invoiceId: string;
  statementLineId: string;
  confidence: number; // 0-100
  reasons: string[]; // why this match was suggested
};

const DATA_FILE = "finance-data.json";

/**
 * Load finance data from workspace
 */
export async function loadFinanceData(gateway: GatewayBrowserClient): Promise<FinanceData> {
  try {
    const result = await gateway.request("agents.files.read", {
      agentId: "main",
      path: DATA_FILE,
    });
    const res = result as { file?: { content?: string; missing?: boolean } } | null;
    if (res?.file && !res.file.missing && res.file.content) {
      return JSON.parse(res.file.content);
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
  await gateway.request("agents.files.write", {
    agentId: "main",
    path: DATA_FILE,
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
      {
        id: "inv-006",
        company: "aexy",
        vendor: "OpenAI",
        amount: 150.75,
        currency: "EUR",
        date: "2026-02-05",
        file: "finance/invoices/openai-feb-2026.pdf",
        statementLineId: null,
        category: "software",
      },
      {
        id: "inv-007",
        company: "aexy",
        vendor: "Adobe Creative Cloud",
        amount: 52.99,
        currency: "EUR",
        date: "2026-02-04",
        file: "finance/invoices/adobe-cc-feb.pdf",
        statementLineId: null,
        category: "software",
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
      // Smart matching test cases
      {
        id: "sl-008",
        statementId: "stmt-001",
        date: "2026-02-05",
        description: "OPENAI LP - API USAGE",
        amount: -150.75,
        invoiceId: null,
      },
      {
        id: "sl-009",
        statementId: "stmt-001",
        date: "2026-02-03",
        description: "ADBE INC - CREATIVE CLOUD",
        amount: -52.99,
        invoiceId: null,
      },
      {
        id: "sl-010",
        statementId: "stmt-001",
        date: "2026-02-01",
        description: "STRIPE PAYMENT - FIGMA INC",
        amount: -45.0,
        invoiceId: null,
      },
      {
        id: "sl-011",
        statementId: "stmt-002",
        date: "2026-02-04",
        description: "Google LLC - Advertising Services",
        amount: -500.0,
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
 * Normalize vendor name for fuzzy matching
 */
function normalizeVendorName(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // Remove special characters
    .replace(/\b(ltd|sια|as|inc|gmbh|ou|llc|corp|corporation|limited|company|co)\b/g, "") // Remove company suffixes
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Extract tokens (words) from normalized vendor name
 */
function extractVendorTokens(vendor: string): string[] {
  const normalized = normalizeVendorName(vendor);
  return normalized.split(" ").filter((token) => token.length > 2); // Only keep tokens longer than 2 chars
}

/**
 * Check if vendor name appears in bank description with fuzzy matching
 */
function fuzzyVendorMatch(vendorName: string, bankDescription: string): boolean {
  const vendorTokens = extractVendorTokens(vendorName);
  const descriptionNormalized = normalizeVendorName(bankDescription);

  if (vendorTokens.length === 0) return false;

  // Check if any significant token from vendor appears in description
  for (const token of vendorTokens) {
    if (descriptionNormalized.includes(token)) {
      return true;
    }
  }

  // Check common abbreviations
  const abbreviations: Record<string, string[]> = {
    digitalocean: ["do", "digital"],
    github: ["gh"],
    amazon: ["amzn", "aws"],
    google: ["goog"],
    microsoft: ["msft", "ms"],
    adobe: ["adbe"],
  };

  const vendorKey = vendorTokens.join(" ");
  for (const [fullName, abbrevs] of Object.entries(abbreviations)) {
    if (vendorKey.includes(fullName)) {
      for (const abbrev of abbrevs) {
        if (descriptionNormalized.includes(abbrev)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Check if invoice reference/number appears in bank description
 */
function referenceMatch(invoice: Invoice, bankDescription: string): boolean {
  const description = bankDescription.toLowerCase();

  // Check if filename appears in description (without extension)
  const filename =
    invoice.file
      .split("/")
      .pop()
      ?.replace(/\.(pdf|jpg|jpeg|png)$/i, "") || "";
  if (filename.length > 3 && description.includes(filename.toLowerCase())) {
    return true;
  }

  // Check if invoice ID appears
  if (description.includes(invoice.id.toLowerCase())) {
    return true;
  }

  return false;
}

/**
 * Smart auto-matching suggestions with confidence scoring
 */
export function autoMatchSuggestions(data: FinanceData): MatchSuggestion[] {
  const suggestions: MatchSuggestion[] = [];

  // Get all companies separately to respect company boundaries
  const companies: Array<"aexy" | "carxo"> = ["aexy", "carxo"];

  for (const company of companies) {
    const invoices = getUnmatchedInvoices(data, company);
    const lines = getUnmatchedStatementLines(data, company);

    for (const invoice of invoices) {
      for (const line of lines) {
        let confidence = 0;
        const reasons: string[] = [];

        // Amount matching (invoice amount is positive, line amount is negative for expenses)
        const invoiceAmount = invoice.amount;
        const lineAmount = Math.abs(line.amount);

        if (invoiceAmount === lineAmount) {
          confidence += 40;
          reasons.push("Exact amount match");
        } else {
          const percentDiff = Math.abs(invoiceAmount - lineAmount) / invoiceAmount;
          if (percentDiff <= 0.05) {
            confidence += 25;
            reasons.push("Amount within 5%");
          } else if (percentDiff <= 0.1) {
            confidence += 15;
            reasons.push("Amount within 10%");
          } else {
            // Skip if amount difference is too large
            continue;
          }
        }

        // Date proximity
        const invoiceDate = new Date(invoice.date);
        const lineDate = new Date(line.date);
        const daysDiff = Math.abs(
          (invoiceDate.getTime() - lineDate.getTime()) / (1000 * 60 * 60 * 24),
        );

        if (daysDiff === 0) {
          confidence += 20;
          reasons.push("Same day");
        } else if (daysDiff <= 3) {
          confidence += 15;
          reasons.push("Within 3 days");
        } else if (daysDiff <= 7) {
          confidence += 10;
          reasons.push("Within 7 days");
        } else if (daysDiff <= 30) {
          confidence += 5;
          reasons.push("Within 30 days");
        }

        // Vendor name fuzzy match
        if (fuzzyVendorMatch(invoice.vendor, line.description)) {
          confidence += 30;
          reasons.push("Vendor name match");
        }

        // Reference/invoice number match
        if (referenceMatch(invoice, line.description)) {
          confidence += 10;
          reasons.push("Reference number match");
        }

        // Only suggest if confidence is reasonable (at least 30)
        if (confidence >= 30) {
          suggestions.push({
            invoiceId: invoice.id,
            statementLineId: line.id,
            confidence,
            reasons,
          });
        }
      }
    }
  }

  // Sort by confidence (highest first)
  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Extract vendor name and date from filename patterns
 */
export function parseInvoiceFromFilename(filename: string): {
  vendor: string;
  date: string;
} {
  const nameWithoutExt = filename.replace(/\.(pdf|jpg|jpeg|png|webp)$/i, "");
  const parts = nameWithoutExt.toLowerCase().split(/[-_\s]+/);

  let vendor = "";
  let date = "";

  // Common vendor patterns
  const vendorMap: Record<string, string> = {
    digitalocean: "DigitalOcean",
    do: "DigitalOcean",
    github: "GitHub",
    gh: "GitHub",
    aws: "AWS",
    amazon: "Amazon",
    google: "Google",
    gcp: "Google Cloud",
    microsoft: "Microsoft",
    azure: "Azure",
    figma: "Figma",
    adobe: "Adobe",
    openai: "OpenAI",
    stripe: "Stripe",
    paypal: "PayPal",
    revolut: "Revolut",
    wise: "Wise",
    cloudflare: "Cloudflare",
    vercel: "Vercel",
    netlify: "Netlify",
    slack: "Slack",
    zoom: "Zoom",
    notion: "Notion",
    linear: "Linear",
    docker: "Docker",
    mailchimp: "Mailchimp",
    sendgrid: "SendGrid",
  };

  // Look for vendor name in filename
  for (const part of parts) {
    if (vendorMap[part]) {
      vendor = vendorMap[part];
      break;
    }
  }

  // If no known vendor found, capitalize first meaningful part
  if (!vendor) {
    const meaningfulPart = parts.find(
      (p) =>
        p.length > 2 &&
        !p.match(/^\d{4}$/) && // not a year
        !p.match(/^\d{1,2}$/) && // not day/month
        ![
          "invoice",
          "bill",
          "receipt",
          "statement",
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ].includes(p),
    );
    if (meaningfulPart) {
      vendor = meaningfulPart.charAt(0).toUpperCase() + meaningfulPart.slice(1);
    }
  }

  // Look for date patterns
  const today = new Date();

  // Pattern 1: YYYY-MM-DD
  const isoMatch = nameWithoutExt.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    const year = isoMatch[1];
    const month = isoMatch[2].padStart(2, "0");
    const day = isoMatch[3].padStart(2, "0");
    date = `${year}-${month}-${day}`;
  }

  // Pattern 2: YYYY-MM or YYYY_MM
  const yearMonthMatch = nameWithoutExt.match(/(\d{4})[-_](\d{1,2})/);
  if (!date && yearMonthMatch) {
    const year = yearMonthMatch[1];
    const month = yearMonthMatch[2].padStart(2, "0");
    date = `${year}-${month}-01`;
  }

  // Pattern 3: Month names
  const monthNames: Record<string, string> = {
    jan: "01",
    january: "01",
    feb: "02",
    february: "02",
    mar: "03",
    march: "03",
    apr: "04",
    april: "04",
    may: "05",
    jun: "06",
    june: "06",
    jul: "07",
    july: "07",
    aug: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    oct: "10",
    october: "10",
    nov: "11",
    november: "11",
    dec: "12",
    december: "12",
  };

  if (!date) {
    for (const part of parts) {
      if (monthNames[part]) {
        const month = monthNames[part];
        // Look for year in adjacent parts
        let year = String(today.getFullYear());
        const yearMatch = parts.find((p) => p.match(/^\d{4}$/));
        if (yearMatch) {
          year = yearMatch;
        }
        date = `${year}-${month}-01`;
        break;
      }
    }
  }

  // Default to today if no date found
  if (!date) {
    date = today.toISOString().split("T")[0];
  }

  return {
    vendor: vendor || "Unknown Vendor",
    date,
  };
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
 * Add multiple invoices at once
 */
export function addInvoices(data: FinanceData, invoices: Omit<Invoice, "id">[]): FinanceData {
  const newData = JSON.parse(JSON.stringify(data)) as FinanceData;
  for (const invoice of invoices) {
    const newInvoice: Invoice = {
      ...invoice,
      id: `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    newData.invoices.push(newInvoice);
  }
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
 * Parse XLS/XLSX bank statement using SheetJS.
 * Auto-detects columns and handles Citadele's pipe-separated format.
 */
export async function parseXLS(arrayBuffer: ArrayBuffer): Promise<StatementLine[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  // Use first sheet
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  // Convert to JSON rows (array of arrays)
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  if (rows.length < 2) return [];

  // Check if this is a Citadele-style format (pipe-separated data in single cells)
  const isCitadeleFormat = detectCitadeleFormat(rows);

  if (isCitadeleFormat) {
    return parseCitadeleFormat(rows);
  }

  // Standard spreadsheet format - existing logic
  return parseStandardFormat(rows);
}

/**
 * Detect if this is a Citadele format (pipe-separated data)
 */
function detectCitadeleFormat(rows: unknown[][]): boolean {
  // Look for the characteristic Citadele header pattern
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i];
    if (row && row.length > 0) {
      const firstCell = String(row[0] ?? "").trim();
      // Check for Citadele header: "Date | Type | Narrative | Payment No. | Bank Reference | Amount DR | Amount CR"
      if (
        firstCell.includes("Date") &&
        firstCell.includes("Type") &&
        firstCell.includes("Narrative") &&
        firstCell.includes("Amount DR") &&
        firstCell.includes("Amount CR")
      ) {
        return true;
      }
      // Also check for transaction data pattern: "DD.MM.YYYY | TYPE | ..."
      if (/^\d{2}\.\d{2}\.\d{4}\s*\|/.test(firstCell)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Parse Citadele format (pipe-separated data in single cells)
 */
function parseCitadeleFormat(rows: unknown[][]): StatementLine[] {
  const parsed: StatementLine[] = [];
  let headerRowIndex = -1;
  let headerParts: string[] = [];

  // Find the header row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.length > 0) {
      const firstCell = String(row[0] ?? "").trim();
      if (
        firstCell.includes("Date") &&
        firstCell.includes("Type") &&
        firstCell.includes("Narrative") &&
        firstCell.includes("Amount DR") &&
        firstCell.includes("Amount CR")
      ) {
        headerRowIndex = i;
        headerParts = firstCell.split(" | ").map((part) => part.trim().toLowerCase());
        break;
      }
    }
  }

  if (headerRowIndex === -1) {
    console.warn("Could not find Citadele header row");
    return [];
  }

  // Find column indices
  const dateIdx = headerParts.findIndex((h) => h.includes("date"));
  const typeIdx = headerParts.findIndex((h) => h.includes("type"));
  const narrativeIdx = headerParts.findIndex((h) => h.includes("narrative"));
  const amountDRIdx = headerParts.findIndex((h) => h.includes("amount dr"));
  const amountCRIdx = headerParts.findIndex((h) => h.includes("amount cr"));

  // Process transaction rows
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const firstCell = String(row[0] ?? "").trim();
    if (!firstCell) continue;

    // Skip rows that don't look like transactions
    if (!/^\d{2}\.\d{2}\.\d{4}\s*\|/.test(firstCell)) continue;

    // Split on pipe separator
    const parts = firstCell.split(" | ").map((part) => part.trim());

    // Extract date (DD.MM.YYYY format)
    let date = "Unknown";
    if (dateIdx >= 0 && parts[dateIdx]) {
      const dateStr = parts[dateIdx].trim();
      const dotMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        date = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
      }
    }

    // Extract description (combine type and narrative)
    let description = "";
    const type = typeIdx >= 0 && parts[typeIdx] ? parts[typeIdx] : "";
    const narrative = narrativeIdx >= 0 && parts[narrativeIdx] ? parts[narrativeIdx] : "";

    if (type && narrative) {
      description = `${type} - ${narrative}`;
    } else if (type) {
      description = type;
    } else if (narrative) {
      description = narrative;
    } else {
      description = "(no description)";
    }

    // Extract amount (DR = negative, CR = positive)
    let amount = 0;
    const debitStr = amountDRIdx >= 0 && parts[amountDRIdx] ? parts[amountDRIdx] : "";
    const creditStr = amountCRIdx >= 0 && parts[amountCRIdx] ? parts[amountCRIdx] : "";

    const debitAmount = parseAmount(debitStr);
    const creditAmount = parseAmount(creditStr);

    if (creditAmount > 0) {
      amount = creditAmount; // Income (positive)
    } else if (debitAmount > 0) {
      amount = -debitAmount; // Expense (negative)
    }

    // Skip rows with no meaningful data
    if (date === "Unknown" && !description && amount === 0) continue;

    parsed.push({
      id: `sl-${Date.now()}-${i}`,
      statementId: "",
      date,
      description,
      amount,
      invoiceId: null,
    });
  }

  return parsed;
}

/**
 * Parse standard spreadsheet format (existing logic)
 */
function parseStandardFormat(rows: unknown[][]): StatementLine[] {
  // Auto-detect columns from header row
  const header = rows[0].map((h) => String(h).toLowerCase().trim());

  // Find date column
  const dateIdx = header.findIndex((h) => /date|datum|datums|kuupäev|data/.test(h));

  // Find description column
  const descIdx = header.findIndex((h) =>
    /desc|description|details|info|maksājum|saņēmēj|beneficiary|purpose|narrative|reference/.test(
      h,
    ),
  );

  // Find amount column (debit/credit or combined)
  const amountIdx = header.findIndex((h) => /amount|summa|suma|total|debit|credit|value/.test(h));

  // Find debit and credit separately
  const debitIdx = header.findIndex((h) => /debit|debits|izdevum/.test(h));
  const creditIdx = header.findIndex((h) => /credit|credits|ieņēmum/.test(h));

  // Find bank name if present
  const bankIdx = header.findIndex((h) => /bank|banka/.test(h));

  const parsed: StatementLine[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    // Skip empty rows
    const hasData = row.some((cell) => cell !== "" && cell !== null && cell !== undefined);
    if (!hasData) continue;

    // Extract date
    let date = "Unknown";
    if (dateIdx >= 0 && row[dateIdx] != null) {
      const raw = row[dateIdx];
      if (raw instanceof Date) {
        date = raw.toISOString().split("T")[0];
      } else {
        const str = String(raw).trim();
        // Try common date formats: DD.MM.YYYY, YYYY-MM-DD, DD/MM/YYYY
        const dotMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
        const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (dotMatch) {
          date = `${dotMatch[3]}-${dotMatch[2].padStart(2, "0")}-${dotMatch[1].padStart(2, "0")}`;
        } else if (isoMatch) {
          date = `${isoMatch[1]}-${isoMatch[2].padStart(2, "0")}-${isoMatch[3].padStart(2, "0")}`;
        } else if (slashMatch) {
          date = `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
        } else {
          date = str || "Unknown";
        }
      }
    }

    // Extract description — combine multiple text columns if needed
    let description = "";
    if (descIdx >= 0) {
      description = String(row[descIdx] ?? "").trim();
    } else {
      // Fallback: join all string columns that aren't date/amount
      description = row
        .filter(
          (_cell, idx) =>
            idx !== dateIdx && idx !== amountIdx && idx !== debitIdx && idx !== creditIdx,
        )
        .map((c) => String(c ?? "").trim())
        .filter((s) => s && !/^\d+[\.,]?\d*$/.test(s))
        .join(" | ");
    }

    // Extract amount
    let amount = 0;
    if (amountIdx >= 0) {
      amount = parseAmount(row[amountIdx]);
    } else if (debitIdx >= 0 || creditIdx >= 0) {
      const debit = debitIdx >= 0 ? parseAmount(row[debitIdx]) : 0;
      const credit = creditIdx >= 0 ? parseAmount(row[creditIdx]) : 0;
      amount = credit - debit; // positive = income, negative = expense
    }

    // Skip rows with no meaningful data
    if (date === "Unknown" && !description && amount === 0) continue;

    parsed.push({
      id: `sl-${Date.now()}-${i}`,
      statementId: "",
      date,
      description: description || "(no description)",
      amount,
      invoiceId: null,
    });
  }

  return parsed;
}

/** Parse various number formats: 1,234.56 or 1.234,56 or -500 */
function parseAmount(value: unknown): number {
  if (typeof value === "number") return value;
  if (value == null || value === "") return 0;
  let str = String(value).trim();
  // Remove currency symbols
  str = str.replace(/[€$£\s]/g, "");
  // Handle European format: 1.234,56 → 1234.56
  if (/^\-?\d{1,3}(\.\d{3})*(,\d+)?$/.test(str)) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  // Handle standard: 1,234.56 → 1234.56
  str = str.replace(/,/g, "");
  return parseFloat(str) || 0;
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
  // const result = await gateway.request("gmail.messages.list", { query: "has:attachment filename:pdf" });
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

/**
 * Load provider usage summary from the gateway
 */
export async function loadUsageSummary(gateway: GatewayBrowserClient): Promise<UsageSummary> {
  try {
    const result = await gateway.request("usage.status", {});
    return result as UsageSummary;
  } catch (e) {
    console.error("Failed to load usage summary:", e);
    return {
      updatedAt: Date.now(),
      providers: [],
    };
  }
}

/**
 * Load cost/usage summary from the gateway
 */
export async function loadCostUsageSummary(
  gateway: GatewayBrowserClient,
  days = 30,
): Promise<CostUsageSummary> {
  try {
    const result = await gateway.request("usage.cost", { days });
    return result as CostUsageSummary;
  } catch (e) {
    console.error("Failed to load cost usage summary:", e);
    return {
      updatedAt: Date.now(),
      days,
      daily: [],
      totals: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        totalCost: 0,
        missingCostEntries: 0,
      },
    };
  }
}

/**
 * Format token numbers with commas
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Format cost as currency (USD)
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cost);
}

/**
 * Get cost color class based on amount
 */
export function getCostColorClass(cost: number): string {
  if (cost < 0.1) return "cost-low";
  if (cost < 1.0) return "cost-medium";
  return "cost-high";
}
