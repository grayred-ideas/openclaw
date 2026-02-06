/**
 * Finance View - Bookkeeping Dashboard
 * Manages invoices, bank statements, matching, and reports
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayBrowserClient } from "../../gateway.js";
import { icons } from "../../icons.js";
import { ocTheme, ocBaseFormStyles } from "../shared/theme.js";
import {
  loadFinanceData,
  saveFinanceData,
  getInvoices,
  getUnmatchedInvoices,
  getMatchedInvoices,
  getStatements,
  getStatementLines,
  getUnmatchedStatementLines,
  matchInvoiceToLine,
  suggestMatches,
  autoMatchSuggestions,
  getSpendingByCategory,
  getSpendingByMonth,
  getSpendingByVendor,
  getInboxEmails,
  addInvoice,
  addInvoices,
  addStatement,
  parseCSV,
  parseXLS,
  parseInvoiceFromFilename,
  formatCurrency,
  formatDate,
  loadUsageSummary,
  loadCostUsageSummary,
  formatTokens,
  formatCost,
  getCostColorClass,
  extractVendors,
  updateVendors,
  getVendors,
  updateVendor,
  getSpendingByDepartment,
  getVendorSpendingByCategory,
  type FinanceData,
  type Invoice,
  type StatementLine,
  type Email,
  type CompanyFilter,
  type MatchSuggestion,
  type UsageSummary,
  type CostUsageSummary,
  type Vendor,
} from "./controller.js";

interface UploadedFile {
  file: File;
  id: string;
  status: "uploading" | "parsing" | "ready" | "added" | "error";
  error?: string;
  previewUrl?: string;
  parsedInvoice?: Omit<Invoice, "id" | "file">;
}

type BulkUploadStep = "upload" | "review" | "complete";

type TabType = "inbox" | "invoices" | "statements" | "matching" | "reports" | "vendors" | "usage";

@customElement("finance-view")
export class FinanceView extends LitElement {
  @property({ attribute: false })
  gateway: GatewayBrowserClient | null = null;

  @state() private data: FinanceData | null = null;
  @state() private emails: Email[] = [];
  @state() private loading = true;
  @state() private saving = false;
  @state() private error: string | null = null;
  @state() private activeTab: TabType = "invoices";
  @state() private companyFilter: CompanyFilter = "all";
  @state() private selectedInvoice: Invoice | null = null;
  @state() private selectedLine: StatementLine | null = null;
  @state() private toast: string | null = null;
  @state() private showExportModal = false;
  @state() private showInvoiceUpload = false;
  @state() private showStatementUpload = false;
  @state() private uploadCompany: "aexy" | "carxo" = "aexy";
  @state() private uploadVendor = "";
  @state() private uploadAmount = "";
  @state() private uploadDate = new Date().toISOString().split("T")[0];
  @state() private uploadCategory = "other";
  @state() private uploadBank = "";

  // Invoice filtering and sorting state
  @state() private invoiceFilters = {
    category: "",
    status: "",
    dateStart: "",
    dateEnd: "",
    search: "",
  };
  @state() private invoiceSort: "date" | "amount" | "vendor" = "date";
  @state() private invoiceSortDirection: "asc" | "desc" = "desc";
  @state() private selectedInvoices = new Set<string>();
  @state() private showBulkActions = false;
  @state() private editingInvoice: Invoice | null = null;

  // Bulk upload system
  @state() private showBulkUpload = false;
  @state() private bulkUploadStep: BulkUploadStep = "upload";
  @state() private uploadedFiles: UploadedFile[] = [];
  @state() private dragActive = false;
  @state() private dateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  };

  // Usage/Cost tracking
  @state() private usageSummary: UsageSummary | null = null;
  @state() private costUsageSummary: CostUsageSummary | null = null;
  @state() private usageLoading = false;

  // Vendor management
  @state() private selectedVendor: Vendor | null = null;
  @state() private showVendorEdit = false;
  @state() private vendorSearchTerm = "";
  @state() private vendorCategoryFilter = "all";
  @state() private vendorDepartmentFilter = "all";
  @state() private vendorSortBy: "name" | "category" | "spending" | "transactions" | "lastUsed" =
    "spending";

  static override styles = [
    ocTheme,
    ocBaseFormStyles,
    css`
      :host {
        display: block;
        height: 100%;
        background: var(--background);
        color: var(--foreground);
        padding: 1.25rem;
        overflow: auto;
        font-family: var(--oc-font-sans);
      }

      * {
        box-sizing: border-box;
      }

      .icon {
        display: inline-flex;
        width: 16px;
        height: 16px;
        flex-shrink: 0;
      }

      .icon svg {
        width: 100%;
        height: 100%;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .icon-lg {
        width: 20px;
        height: 20px;
      }

      .icon-xl {
        width: 32px;
        height: 32px;
      }

      .container {
        max-width: 1400px;
        margin: 0 auto;
      }

      /* Header */
      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;
      }

      .title {
        font-size: 20px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-strong);
      }

      /* Company Selector */
      .company-selector {
        display: flex;
        gap: 8px;
      }

      .company-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--muted);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition:
          border-color var(--duration-fast) var(--ease-out),
          background var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out);
      }

      .company-btn:hover {
        border-color: var(--border-strong);
        color: var(--text);
        background: var(--bg-hover);
      }

      .company-btn.active {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--primary-foreground);
      }

      .company-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }

      .company-dot.aexy {
        background: #3b82f6;
      }
      .company-dot.carxo {
        background: #8b5cf6;
      }

      /* Tabs */
      .tabs {
        display: flex;
        gap: 4px;
        margin-bottom: 20px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 12px;
      }

      .tab {
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--muted);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition:
          background var(--duration-fast) var(--ease-out),
          color var(--duration-fast) var(--ease-out);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .tab:hover {
        background: var(--bg-hover);
        color: var(--text);
      }

      .tab.active {
        background: var(--accent-subtle);
        color: var(--accent);
      }

      .tab .badge {
        background: var(--danger);
        color: white;
        font-size: 11px;
        padding: 2px 6px;
        border-radius: var(--radius-lg);
        font-weight: 600;
      }

      /* Cards */
      .card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
        margin-bottom: 20px;
      }

      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
      }

      .card-title {
        font-size: 15px;
        font-weight: 600;
        margin: 0;
        color: var(--text-strong);
      }

      /* Tables */
      table {
        width: 100%;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      th {
        color: var(--muted);
        font-weight: 500;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      tbody tr:hover {
        background: var(--bg);
      }

      tbody tr:last-child td {
        border-bottom: none;
      }

      /* Status badges */
      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: var(--radius-full);
        font-size: 12px;
        font-weight: 500;
      }

      .status.matched {
        background: var(--ok-subtle);
        color: var(--ok);
      }

      .status.unmatched {
        background: var(--warn-subtle);
        color: var(--warn);
      }

      .status.income {
        background: var(--ok-subtle);
        color: var(--ok);
      }

      .status.expense {
        background: var(--danger-subtle);
        color: var(--danger);
      }

      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 9px 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--bg-elevated);
        color: var(--text);
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        letter-spacing: -0.01em;
        transition:
          border-color var(--duration-fast) var(--ease-out),
          background var(--duration-fast) var(--ease-out),
          box-shadow var(--duration-fast) var(--ease-out),
          transform var(--duration-fast) var(--ease-out);
      }

      .btn:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
        transform: translateY(-1px);
        box-shadow: var(--shadow-sm);
      }

      .btn:active {
        transform: translateY(0);
        box-shadow: none;
      }

      .btn svg {
        width: 16px;
        height: 16px;
        stroke: currentColor;
        fill: none;
        stroke-width: 1.5;
        stroke-linecap: round;
        stroke-linejoin: round;
        flex-shrink: 0;
      }

      .btn-primary {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--primary-foreground);
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .btn-primary:hover {
        background: var(--accent-hover);
        border-color: var(--accent-hover);
        box-shadow:
          var(--shadow-md),
          0 0 20px var(--accent-glow);
      }

      .btn-secondary {
        background: var(--bg-elevated);
        color: var(--text);
        border: 1px solid var(--border);
      }

      .btn-secondary:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
      }

      .btn-success {
        background: var(--ok);
        border-color: var(--ok);
        color: white;
      }

      .btn-success:hover {
        opacity: 0.9;
      }

      .btn-sm {
        padding: 6px 12px;
        font-size: 12px;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      /* Matching View */
      .matching-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
      }

      @media (max-width: 900px) {
        .matching-container {
          grid-template-columns: 1fr;
        }
      }

      .match-list {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .match-list-header {
        padding: 14px 20px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        font-weight: 600;
        font-size: 14px;
      }

      .match-item {
        padding: 14px 20px;
        border-bottom: 1px solid var(--border);
        cursor: pointer;
        transition: all 0.2s;
      }

      .match-item:hover {
        background: var(--bg);
      }

      .match-item.selected {
        background: var(--accent-subtle);
        border-left: 3px solid var(--accent);
      }

      .match-item:last-child {
        border-bottom: none;
      }

      .match-item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }

      .match-item-vendor {
        font-weight: 600;
        font-size: 14px;
      }

      .match-item-amount {
        font-weight: 600;
        font-family: var(--font-mono);
      }

      .match-item-meta {
        color: var(--muted);
        font-size: 12px;
      }

      /* Suggestions */
      .suggestions {
        margin-bottom: 24px;
      }

      .suggestion-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        padding: 16px;
        background: var(--accent-subtle);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        margin-bottom: 12px;
        gap: 16px;
      }

      .suggestion-content {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        flex: 1;
        min-width: 0;
      }

      .suggestion-arrow {
        color: var(--accent);
        font-size: 18px;
      }

      .confidence-bar {
        height: 6px;
        background: var(--border);
        border-radius: 3px;
        overflow: hidden;
      }

      .confidence-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--danger) 0%, var(--warn) 50%, var(--ok) 100%);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      /* Reports */
      .report-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 20px;
      }

      .stat-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
      }

      .stat-label {
        color: var(--muted);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text-strong);
      }

      .stat-sub {
        font-size: 11px;
        color: var(--muted);
        margin-top: 4px;
      }

      /* Cost color coding */
      .cost-low {
        color: #10b981 !important;
      }

      .cost-medium {
        color: #f59e0b !important;
      }

      .cost-high {
        color: #ef4444 !important;
      }

      .stat-card.cost-low {
        border-color: #10b981;
        background: #ecfdf5;
      }

      .stat-card.cost-medium {
        border-color: #f59e0b;
        background: #fefce8;
      }

      .stat-card.cost-high {
        border-color: #ef4444;
        background: #fef2f2;
      }

      /* Chart bars */
      .chart-bar-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        flex: 1;
        margin: 0 2px;
      }

      .chart-label {
        font-size: 10px;
        color: var(--muted);
        margin-top: 8px;
      }

      /* Chart */
      .chart-container {
        height: 200px;
        display: flex;
        align-items: flex-end;
        gap: 8px;
        padding: 20px 0;
      }

      .chart-bar {
        flex: 1;
        background: var(--accent);
        border-radius: 4px 4px 0 0;
        min-height: 20px;
        position: relative;
        transition: all 0.3s;
      }

      .chart-bar:hover {
        opacity: 0.8;
      }

      .chart-bar::after {
        content: attr(data-label);
        position: absolute;
        bottom: -24px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 10px;
        color: var(--muted);
        white-space: nowrap;
      }

      /* Category colors */
      .category-software {
        color: #8b5cf6;
      }
      .category-hosting {
        color: #3b82f6;
      }
      .category-services {
        color: #06b6d4;
      }
      .category-marketing {
        color: #f59e0b;
      }
      .category-travel {
        color: #10b981;
      }
      .category-office {
        color: #ec4899;
      }
      .category-legal {
        color: #6366f1;
      }
      .category-other {
        color: var(--muted);
      }

      /* Date range picker */
      .date-range {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }

      .date-input {
        padding: 8px 12px;
        border: 1px solid var(--border);
        background: var(--bg);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 13px;
      }

      .date-input:focus {
        outline: none;
        border-color: var(--accent);
      }

      /* Amount formatting */
      .amount {
        font-family: var(--font-mono);
        font-weight: 600;
      }

      .amount.positive {
        color: var(--ok);
      }

      .amount.negative {
        color: var(--danger);
      }

      /* Select */
      select,
      select.form-input {
        padding: 8px 32px 8px 12px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text);
        border-radius: var(--radius-md);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        background-size: 16px;
        transition:
          border-color var(--duration-fast) var(--ease-out),
          background var(--duration-fast) var(--ease-out);
      }

      select:hover {
        border-color: var(--border-strong);
        background-color: var(--bg-hover);
      }

      select:focus {
        outline: none;
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      /* Toast */
      .toast {
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 14px 20px;
        background: var(--ok);
        color: white;
        border-radius: var(--radius-md);
        font-weight: 500;
        font-size: 14px;
        animation: slideIn 0.3s ease;
        z-index: 1000;
        box-shadow: var(--shadow-lg);
      }

      @keyframes slideIn {
        from {
          transform: translateY(100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }

      /* Modal */
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .modal {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 24px;
        min-width: 400px;
        max-width: 90vw;
        box-shadow: var(--shadow-xl);
      }

      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }

      .modal-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .modal-close {
        background: none;
        border: none;
        color: var(--muted);
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }

      .modal-close:hover {
        color: var(--text);
      }

      .form-group {
        display: grid;
        gap: 6px;
        margin-bottom: 14px;
      }

      .form-label {
        color: var(--muted);
        font-size: 13px;
        font-weight: 500;
      }

      .form-input {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 12px;
        border: 1px solid var(--input);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-md);
        font-size: 14px;
        outline: none;
        box-shadow: inset 0 1px 0 var(--card-highlight);
        transition:
          border-color var(--duration-fast) ease,
          box-shadow var(--duration-fast) ease;
      }

      .form-input:focus {
        border-color: var(--ring);
        box-shadow: var(--focus-ring);
      }

      input[type="file"] {
        padding: 8px 12px;
        border: 1px solid var(--input);
        background: var(--card);
        border-radius: var(--radius-md);
        font-size: 13px;
        color: var(--text);
        cursor: pointer;
        width: 100%;
        box-sizing: border-box;
      }

      input[type="file"]::file-selector-button {
        padding: 6px 12px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--bg-elevated);
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        margin-right: 10px;
      }

      input[type="file"]::file-selector-button:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
      }

      /* Empty state */
      .empty-state {
        text-align: center;
        padding: 50px 20px;
        color: var(--muted);
      }

      .empty-state-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }

      /* Loading */
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px;
        color: var(--muted);
      }

      .spinner {
        width: 36px;
        height: 36px;
        border: 3px solid var(--border);
        border-top-color: var(--accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      /* Saving indicator */
      .saving-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--muted);
      }

      .saving-indicator .spinner {
        width: 14px;
        height: 14px;
        margin: 0;
      }

      /* Bulk Upload System */
      .upload-zone {
        border: 2px dashed var(--border);
        border-radius: var(--radius-lg);
        padding: 40px 20px;
        text-align: center;
        background: var(--bg);
        transition: all 0.2s ease;
        cursor: pointer;
      }

      .upload-zone:hover,
      .upload-zone.drag-active {
        border-color: var(--accent);
        background: var(--accent-subtle);
      }

      .upload-zone.drag-active {
        transform: scale(1.01);
      }

      .upload-zone-icon {
        margin-bottom: 16px;
        color: var(--muted);
      }

      .upload-zone-text {
        font-size: 16px;
        font-weight: 500;
        color: var(--text-strong);
        margin-bottom: 8px;
      }

      .upload-zone-subtitle {
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 16px;
      }

      .upload-zone-formats {
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* File List */
      .file-list {
        margin-top: 24px;
      }

      .file-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        margin-bottom: 12px;
      }

      .file-preview {
        width: 48px;
        height: 48px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
        flex-shrink: 0;
        overflow: hidden;
      }

      .file-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .file-info {
        flex: 1;
        min-width: 0;
      }

      .file-name {
        font-weight: 500;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .file-status {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
      }

      .status-parsing {
        color: var(--warn);
      }

      .status-ready {
        color: var(--ok);
      }

      .status-added {
        color: var(--ok);
      }

      .status-error {
        color: var(--danger);
      }

      .file-actions {
        display: flex;
        gap: 8px;
        flex-shrink: 0;
      }

      /* Review Screen */
      .review-container {
        max-height: 60vh;
        overflow-y: auto;
        margin: 20px 0;
      }

      .review-item {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 20px;
        margin-bottom: 16px;
      }

      .review-header {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border);
      }

      .review-preview {
        width: 60px;
        height: 60px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        border: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--muted);
        flex-shrink: 0;
        overflow: hidden;
      }

      .review-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .review-filename {
        font-weight: 500;
        color: var(--text-strong);
        margin-bottom: 4px;
      }

      .review-extracted {
        font-size: 12px;
        color: var(--muted);
      }

      .review-form {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .review-form .form-group {
        margin-bottom: 0;
      }

      .review-form .form-group:nth-child(5),
      .review-form .form-group:nth-child(6) {
        grid-column: 1 / -1;
      }

      .review-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      }

      /* Step indicator */
      .step-indicator {
        display: flex;
        justify-content: center;
        margin-bottom: 24px;
      }

      .step {
        display: flex;
        align-items: center;
        font-size: 13px;
        color: var(--muted);
      }

      .step.active {
        color: var(--accent);
        font-weight: 500;
      }

      .step.completed {
        color: var(--ok);
      }

      .step:not(:last-child)::after {
        content: "→";
        margin: 0 12px;
        color: var(--border);
      }

      /* Summary Bar */
      .summary-bar {
        display: flex;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        flex-wrap: wrap;
      }

      .summary-stat {
        flex: 1;
        text-align: center;
        min-width: 120px;
      }

      .summary-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--text-strong);
        font-family: var(--font-mono);
      }

      .summary-label {
        font-size: 11px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
      }

      /* Invoice Header */
      .invoices-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .invoices-title {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-strong);
        margin: 0;
      }

      .invoices-actions {
        display: flex;
        gap: 8px;
      }

      /* Bulk Actions Bar */
      .bulk-actions-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--accent-subtle);
        border: 1px solid var(--accent);
        border-radius: var(--radius-md);
        margin-bottom: 16px;
      }

      .bulk-actions-info {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--accent);
        font-weight: 500;
        font-size: 14px;
      }

      .bulk-actions-buttons {
        display: flex;
        gap: 8px;
        align-items: center;
      }

      .bulk-action-select {
        padding: 6px 10px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 12px;
        cursor: pointer;
      }

      /* Empty State Card */
      .empty-state-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 40px;
        text-align: center;
        margin-bottom: 20px;
      }

      .empty-state-card .empty-state h4 {
        margin: 16px 0 8px 0;
        font-size: 18px;
        color: var(--text-strong);
      }

      /* Filter and Sort Bar */
      .filter-sort-bar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        flex-wrap: wrap;
      }

      .filter-section {
        display: flex;
        gap: 16px;
        align-items: center;
        flex-wrap: wrap;
      }

      .sort-section {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      .filter-input {
        padding: 6px 10px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 13px;
        min-width: 120px;
      }

      .filter-input:focus {
        outline: none;
        border-color: var(--accent);
      }

      .filter-date {
        min-width: 140px;
      }

      .filter-to {
        color: var(--muted);
        font-size: 12px;
      }

      .sort-btn {
        padding: 6px 12px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        color: var(--text);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .sort-btn:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
      }

      .sort-btn.active {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--primary-foreground);
      }

      /* No Results State */
      .no-results {
        text-align: center;
        padding: 40px;
        color: var(--muted);
      }

      .no-results .icon {
        width: 32px;
        height: 32px;
        margin-bottom: 12px;
        opacity: 0.5;
      }

      /* Invoice Grid Container */
      .invoice-grid-container {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
      }

      .invoice-grid-header {
        padding: 12px 16px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .invoice-grid {
        display: flex;
        flex-direction: column;
      }

      /* Enhanced Invoice Cards */
      .enhanced-invoice-card {
        background: var(--card);
        border-bottom: 1px solid var(--border);
        padding: 16px;
        transition: all 0.2s ease;
        cursor: pointer;
        position: relative;
      }

      .enhanced-invoice-card:last-child {
        border-bottom: none;
      }

      .enhanced-invoice-card:hover {
        background: var(--bg-subtle);
      }

      .enhanced-invoice-card.selected {
        background: var(--accent-subtle);
        border-left-color: var(--accent) !important;
      }

      .enhanced-invoice-card.expanded {
        background: var(--bg-subtle);
      }

      .enhanced-invoice-card.newly-added {
        background: var(--ok-subtle);
        animation: highlightFade 3s ease-out forwards;
      }

      @keyframes highlightFade {
        0% {
          background: var(--ok-subtle);
        }
        100% {
          background: var(--card);
        }
      }

      .enhanced-card-header {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: 100%;
      }

      .invoice-checkbox-container {
        flex-shrink: 0;
        padding-top: 2px;
      }

      .invoice-checkbox-label {
        display: flex;
        align-items: center;
        cursor: pointer;
        font-size: 12px;
        color: var(--muted);
        gap: 6px;
      }

      .invoice-checkbox {
        margin: 0;
        width: 16px;
        height: 16px;
      }

      .checkmark {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        position: relative;
        background: var(--card);
      }

      .enhanced-invoice-main {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex: 1;
        gap: 16px;
      }

      .enhanced-vendor-section {
        flex: 1;
        min-width: 0;
      }

      .enhanced-vendor-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-strong);
        margin: 0 0 6px 0;
      }

      .enhanced-invoice-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }

      .enhanced-company-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .enhanced-company-badge.aexy {
        background: rgba(59, 130, 246, 0.1);
        color: #3b82f6;
      }

      .enhanced-company-badge.carxo {
        background: rgba(139, 92, 246, 0.1);
        color: #8b5cf6;
      }

      .enhanced-category-badge {
        font-size: 11px;
        font-weight: 500;
        padding: 2px 6px;
        border-radius: var(--radius-sm);
        background: rgba(0, 0, 0, 0.05);
      }

      .enhanced-date {
        font-size: 12px;
        color: var(--muted);
      }

      .enhanced-amount-section {
        text-align: right;
        flex-shrink: 0;
      }

      .enhanced-amount {
        font-size: 18px;
        font-weight: 700;
        color: var(--text-strong);
        font-family: var(--font-mono);
        margin-bottom: 4px;
      }

      .enhanced-status {
        display: flex;
        justify-content: flex-end;
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: var(--radius-full);
        font-size: 11px;
        font-weight: 500;
      }

      .status-badge.matched {
        background: var(--ok-subtle);
        color: var(--ok);
      }

      .status-badge.unmatched {
        background: var(--warn-subtle);
        color: var(--warn);
      }

      .enhanced-card-actions {
        display: flex;
        gap: 4px;
        flex-shrink: 0;
        padding-top: 2px;
      }

      .btn-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: 1px solid var(--border);
        background: var(--bg-elevated);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all 0.2s ease;
        color: var(--text);
      }

      .btn-icon:hover {
        background: var(--bg-hover);
        border-color: var(--border-strong);
      }

      .btn-icon-danger:hover {
        background: var(--danger);
        border-color: var(--danger);
        color: white;
      }

      .btn-icon .icon {
        width: 14px;
        height: 14px;
      }

      .enhanced-description {
        margin: 12px 0 8px 40px;
        font-size: 13px;
        color: var(--muted);
        line-height: 1.4;
      }

      .enhanced-file-section {
        margin: 8px 0 0 40px;
      }

      .enhanced-file-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--muted);
        text-decoration: none;
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        background: var(--bg);
        border: 1px solid var(--border);
        transition: all 0.2s ease;
      }

      .enhanced-file-link:hover {
        color: var(--accent);
        border-color: var(--accent);
        background: var(--accent-subtle);
      }

      /* Enhanced Details */
      .enhanced-details {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
        margin-left: 40px;
      }

      .enhanced-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        font-size: 13px;
      }

      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
      }

      .detail-item-full {
        grid-column: 1 / -1;
      }

      .detail-label {
        color: var(--muted);
        font-weight: 500;
        margin-right: 12px;
      }

      .detail-value {
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 12px;
        text-align: right;
        flex-shrink: 0;
      }

      .detail-file {
        word-break: break-all;
        max-width: 200px;
      }

      .matched-transaction {
        background: var(--ok-subtle);
        padding: 8px 12px;
        border-radius: var(--radius-sm);
        border-left: 3px solid var(--ok);
      }

      .matched-description {
        font-weight: 500;
        margin-bottom: 4px;
      }

      .matched-meta {
        font-size: 11px;
        color: var(--muted);
        font-family: var(--font-mono);
      }

      /* Edit Form */
      .enhanced-edit-form {
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 16px;
      }

      .edit-form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
      }

      .form-group-full {
        grid-column: 1 / -1;
      }

      .edit-form-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      /* Category Colors */
      .category-software {
        color: #8b5cf6;
      }
      .category-hosting {
        color: #3b82f6;
      }
      .category-services {
        color: #06b6d4;
      }
      .category-marketing {
        color: #f59e0b;
      }
      .category-travel {
        color: #10b981;
      }
      .category-office {
        color: #ec4899;
      }
      .category-legal {
        color: #6366f1;
      }
      .category-uncategorized {
        color: #6b7280;
      }
      .category-other {
        color: #9ca3af;
      }

      /* Filter bar */
      .filter-bar {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        flex-wrap: wrap;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 500;
      }

      .filter-select {
        padding: 6px 10px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 12px;
        cursor: pointer;
      }

      /* Expanded invoice details */
      .invoice-expanded {
        border-color: var(--accent);
        background: var(--accent-subtle);
      }

      .invoice-details {
        margin-top: 16px;
        padding-top: 16px;
        border-top: 1px solid var(--border);
      }

      .invoice-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        font-size: 13px;
      }

      .invoice-detail {
        display: flex;
        justify-content: space-between;
      }

      .invoice-detail-label {
        color: var(--muted);
        font-weight: 500;
      }

      .invoice-detail-value {
        color: var(--foreground);
      }

      /* Statement Cards */
      .statement-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .statement-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .statement-card.expanded {
        border-color: var(--accent);
        box-shadow: var(--shadow-md);
      }

      .statement-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px;
        cursor: pointer;
        transition: background 0.2s ease;
        gap: 20px;
      }

      .statement-header:hover {
        background: var(--bg-subtle);
      }

      .statement-header-left {
        flex: 1;
        min-width: 0;
      }

      .statement-bank {
        font-size: 18px;
        font-weight: 600;
        color: var(--text-strong);
        margin-bottom: 4px;
      }

      .statement-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
        margin-bottom: 8px;
      }

      .quality-warning {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--warn);
        background: var(--warn-subtle);
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        width: fit-content;
      }

      .statement-header-right {
        display: flex;
        align-items: center;
        gap: 20px;
        flex-shrink: 0;
      }

      .statement-totals {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        text-align: right;
      }

      .total-income,
      .total-expenses,
      .total-net {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .total-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--muted);
        margin-bottom: 4px;
      }

      .total-value {
        font-family: var(--font-mono);
        font-weight: 600;
        font-size: 16px;
      }

      .total-value.positive {
        color: var(--ok);
      }

      .total-value.negative {
        color: var(--danger);
      }

      .statement-actions {
        display: flex;
        gap: 8px;
      }

      .expand-indicator {
        display: flex;
        align-items: center;
        color: var(--muted);
        flex-shrink: 0;
      }

      /* Transaction Tables */
      .statement-transactions {
        padding: 0 20px 20px 20px;
        background: var(--bg-subtle);
        border-top: 1px solid var(--border);
      }

      .quality-issues {
        background: var(--warn-subtle);
        border: 1px solid var(--warn);
        border-radius: var(--radius-md);
        padding: 16px;
        margin-bottom: 16px;
      }

      .quality-issues h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--warn);
      }

      .quality-issues ul {
        margin: 0;
        padding-left: 20px;
        color: var(--warn);
        font-size: 13px;
      }

      .transaction-table-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        padding-top: 16px;
      }

      .table-info {
        font-size: 13px;
        color: var(--muted);
      }

      .table-actions {
        display: flex;
        gap: 8px;
      }

      .transaction-table {
        width: 100%;
        border-collapse: collapse;
        background: var(--card);
        border-radius: var(--radius-md);
        overflow: hidden;
        border: 1px solid var(--border);
      }

      .transaction-table th {
        background: var(--bg);
        color: var(--muted);
        font-weight: 500;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        text-align: left;
      }

      .transaction-table th:nth-child(3),
      .transaction-table th:nth-child(4) {
        text-align: right;
      }

      .transaction-table th:last-child {
        text-align: center;
      }

      .transaction-row {
        transition: background 0.2s ease;
      }

      .transaction-row:nth-child(even) {
        background: var(--bg-subtle);
      }

      .transaction-row:hover {
        background: var(--bg-hover);
      }

      .transaction-row.quality-issue {
        background: var(--warn-subtle);
      }

      .transaction-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        font-size: 13px;
      }

      .date-cell {
        font-family: var(--font-mono);
        font-size: 12px;
        white-space: nowrap;
      }

      .date-unknown {
        color: var(--danger);
        font-style: italic;
      }

      .description-cell {
        max-width: 300px;
      }

      .description-main {
        color: var(--text);
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .quality-flag {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--warn);
      }

      .amount-cell {
        text-align: right;
        font-family: var(--font-mono);
        font-weight: 600;
        white-space: nowrap;
      }

      .balance-cell {
        text-align: right;
        font-family: var(--font-mono);
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
      }

      .category-cell {
        text-align: center;
      }

      .category-tag {
        display: inline-flex;
        align-items: center;
        padding: 2px 8px;
        border-radius: var(--radius-full);
        font-size: 11px;
        font-weight: 500;
        background: var(--accent-subtle);
        color: var(--accent);
      }

      .category-empty {
        color: var(--muted);
        font-style: italic;
      }

      .matched-cell {
        text-align: center;
      }

      .match-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: none;
        background: none;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .match-status.matched {
        background: var(--ok-subtle);
        color: var(--ok);
        cursor: default;
      }

      .match-status.unmatched {
        background: var(--warn-subtle);
        color: var(--warn);
      }

      .match-status.unmatched:hover {
        background: var(--warn);
        color: white;
        transform: scale(1.1);
      }

      .match-status.income {
        background: var(--ok-subtle);
        color: var(--ok);
        cursor: default;
      }

      /* Responsive design for statement cards */
      @media (max-width: 768px) {
        .statement-header {
          flex-direction: column;
          align-items: stretch;
          gap: 16px;
        }

        .statement-header-right {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .statement-totals {
          grid-template-columns: 1fr;
          gap: 8px;
          text-align: left;
        }

        .total-income,
        .total-expenses,
        .total-net {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
        }

        .transaction-table {
          font-size: 12px;
        }

        .transaction-table th,
        .transaction-table td {
          padding: 8px 12px;
        }

        .description-cell {
          max-width: 200px;
        }
      }

      /* Upload Status and Preview */
      .upload-status {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border);
        margin-bottom: 20px;
        background: var(--bg-subtle);
      }

      .upload-status.success {
        border-color: var(--ok);
        background: var(--ok-subtle);
      }

      .upload-status.error {
        border-color: var(--danger);
        background: var(--danger-subtle);
      }

      .status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: var(--card);
        border: 1px solid var(--border);
        flex-shrink: 0;
      }

      .status-message strong {
        display: block;
        margin-bottom: 4px;
        color: var(--text-strong);
      }

      .status-message p {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
      }

      .preview-section {
        margin-bottom: 20px;
      }

      .preview-section h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--text-strong);
      }

      .preview-table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        overflow: hidden;
        font-size: 12px;
      }

      .preview-table th {
        background: var(--bg);
        color: var(--muted);
        font-weight: 500;
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }

      .preview-table td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--border);
      }

      .preview-table tr:last-child td {
        border-bottom: none;
      }

      .preview-table tr:nth-child(even) {
        background: var(--bg-subtle);
      }

      .error-help {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        padding: 16px;
        margin-bottom: 20px;
      }

      .error-help h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        color: var(--text-strong);
      }

      .error-help ul {
        margin: 0;
        padding-left: 20px;
        color: var(--muted);
        font-size: 12px;
      }

      .error-help li {
        margin-bottom: 4px;
      }

      /* Vendor Management */
      .vendor-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .vendor-table-container {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        overflow: hidden;
        margin-bottom: 24px;
      }

      .vendor-table {
        width: 100%;
      }

      .vendor-table th {
        background: var(--bg);
        cursor: pointer;
        user-select: none;
        transition: background var(--duration-fast) var(--ease-out);
      }

      .vendor-table th:hover {
        background: var(--bg-hover);
      }

      .vendor-table th.sortable::after {
        content: "↕";
        margin-left: 8px;
        color: var(--muted);
      }

      .vendor-table th.sort-asc::after {
        content: "↑";
        color: var(--accent);
      }

      .vendor-table th.sort-desc::after {
        content: "↓";
        color: var(--accent);
      }

      .vendor-table tbody tr {
        cursor: pointer;
        transition: background var(--duration-fast) var(--ease-out);
      }

      .vendor-table tbody tr:hover {
        background: var(--bg-hover);
      }

      .vendor-table tbody tr.expanded {
        background: var(--accent-subtle);
        border-left: 3px solid var(--accent);
      }

      .vendor-category {
        display: inline-block;
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .vendor-category.software {
        background: #8b5cf6;
        color: white;
      }
      .vendor-category.hosting {
        background: #3b82f6;
        color: white;
      }
      .vendor-category.marketing {
        background: #f59e0b;
        color: white;
      }
      .vendor-category.transport {
        background: #10b981;
        color: white;
      }
      .vendor-category.telecom {
        background: #06b6d4;
        color: white;
      }
      .vendor-category.utilities {
        background: #ef4444;
        color: white;
      }
      .vendor-category.legal {
        background: #6366f1;
        color: white;
      }
      .vendor-category.office {
        background: #ec4899;
        color: white;
      }
      .vendor-category.other {
        background: var(--muted);
        color: white;
      }

      .vendor-department {
        display: inline-block;
        padding: 2px 6px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 10px;
        color: var(--muted);
        text-transform: uppercase;
      }

      .vendor-department.engineering {
        border-color: #3b82f6;
        color: #3b82f6;
      }
      .vendor-department.marketing {
        border-color: #f59e0b;
        color: #f59e0b;
      }
      .vendor-department.sales {
        border-color: #10b981;
        color: #10b981;
      }
      .vendor-department.operations {
        border-color: #8b5cf6;
        color: #8b5cf6;
      }

      .vendor-expanded-details {
        padding: 20px;
        border-top: 1px solid var(--border);
        background: var(--bg);
      }

      .vendor-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 20px;
      }

      .vendor-details-section h4 {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 12px;
        color: var(--text-strong);
      }

      .vendor-aliases {
        font-size: 12px;
        color: var(--muted);
        margin-top: 4px;
      }

      .vendor-alias-tag {
        display: inline-block;
        padding: 2px 6px;
        background: var(--bg-elevated);
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        font-size: 10px;
        margin-right: 4px;
        margin-bottom: 4px;
      }

      .department-breakdown {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
        margin-bottom: 24px;
      }

      .department-card {
        background: var(--card);
        border: 1px solid var(--border);
        border-left: 4px solid var(--accent);
        border-radius: var(--radius-lg);
        padding: 20px;
      }

      .department-card.engineering {
        border-left-color: #3b82f6;
      }
      .department-card.marketing {
        border-left-color: #f59e0b;
      }
      .department-card.sales {
        border-left-color: #10b981;
      }
      .department-card.operations {
        border-left-color: #8b5cf6;
      }
      .department-card.unassigned {
        border-left-color: var(--muted);
      }

      .department-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--text-strong);
        margin-bottom: 8px;
        text-transform: capitalize;
      }

      .department-amount {
        font-size: 24px;
        font-weight: 700;
        font-family: var(--font-mono);
        color: var(--text-strong);
      }

      .department-vendors {
        font-size: 12px;
        color: var(--muted);
        margin-top: 4px;
      }

      .category-breakdown {
        background: var(--card);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        padding: 20px;
      }

      .category-chart {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }

      .category-bar {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .category-label {
        min-width: 80px;
        font-size: 12px;
        font-weight: 500;
        text-transform: capitalize;
      }

      .category-bar-fill {
        flex: 1;
        height: 24px;
        background: var(--bg);
        border-radius: var(--radius-sm);
        overflow: hidden;
        position: relative;
      }

      .category-bar-progress {
        height: 100%;
        background: linear-gradient(90deg, var(--accent), var(--accent-hover));
        border-radius: var(--radius-sm);
        transition: width 0.5s ease;
      }

      .category-amount {
        font-size: 11px;
        font-weight: 600;
        font-family: var(--font-mono);
        white-space: nowrap;
        min-width: 80px;
        text-align: right;
      }

      .vendor-filters {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
        padding: 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        flex-wrap: wrap;
      }

      .vendor-search {
        flex: 1;
        min-width: 200px;
        padding: 8px 12px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 13px;
      }

      .vendor-search::placeholder {
        color: var(--muted);
      }

      .vendor-filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .vendor-filter-label {
        font-size: 12px;
        color: var(--muted);
        font-weight: 500;
        white-space: nowrap;
      }

      .vendor-filter-select {
        padding: 6px 10px;
        border: 1px solid var(--border);
        background: var(--card);
        color: var(--text);
        border-radius: var(--radius-sm);
        font-size: 12px;
        cursor: pointer;
      }
    `,
  ];

  override async connectedCallback() {
    super.connectedCallback();
    await this.loadData();
  }

  private async loadData() {
    if (!this.gateway) return;
    this.loading = true;
    this.error = null;

    try {
      this.data = await loadFinanceData(this.gateway);
      this.emails = await getInboxEmails(this.gateway);

      // Also load usage data if we're on the usage tab
      if (this.activeTab === "usage") {
        await this.loadUsageData();
      }
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to load data";
      console.error("Finance load error:", e);
    } finally {
      this.loading = false;
    }
  }

  private async loadUsageData() {
    if (!this.gateway) return;
    this.usageLoading = true;

    try {
      const [usage, costUsage] = await Promise.all([
        loadUsageSummary(this.gateway),
        loadCostUsageSummary(this.gateway, 7), // Last 7 days for dashboard
      ]);
      this.usageSummary = usage;
      this.costUsageSummary = costUsage;
    } catch (e) {
      console.error("Usage load error:", e);
      // Don't set main error, this is secondary data
    } finally {
      this.usageLoading = false;
    }
  }

  private async saveData() {
    if (!this.gateway || !this.data) return;
    this.saving = true;

    try {
      await saveFinanceData(this.gateway, this.data);
    } catch (e) {
      console.error("Save error:", e);
    } finally {
      this.saving = false;
    }
  }

  private showToast(message: string) {
    this.toast = message;
    setTimeout(() => {
      this.toast = null;
    }, 3000);
  }

  private setTab(tab: TabType) {
    this.activeTab = tab;
    this.selectedInvoice = null;
    this.selectedLine = null;

    // Load usage data when switching to usage tab
    if (tab === "usage" && this.gateway) {
      this.loadUsageData();
    }
  }

  private setCompany(company: CompanyFilter) {
    this.companyFilter = company;
  }

  private selectInvoice(invoice: Invoice) {
    this.selectedInvoice = invoice;
    if (this.selectedLine) {
      this.tryMatch();
    }
  }

  private selectLine(line: StatementLine) {
    this.selectedLine = line;
    if (this.selectedInvoice) {
      this.tryMatch();
    }
  }

  private async tryMatch() {
    if (!this.selectedInvoice || !this.selectedLine || !this.data) return;

    this.data = matchInvoiceToLine(this.data, this.selectedInvoice.id, this.selectedLine.id);
    this.showToast(`Matched ${this.selectedInvoice.vendor}`);
    this.selectedInvoice = null;
    this.selectedLine = null;
    await this.saveData();
  }

  private async confirmSuggestion(invoiceId: string, lineId: string) {
    if (!this.data) return;
    this.data = matchInvoiceToLine(this.data, invoiceId, lineId);
    this.showToast("Match confirmed");
    await this.saveData();
  }

  private async approveSuggestion(suggestion: MatchSuggestion) {
    if (!this.data) return;
    this.data = matchInvoiceToLine(this.data, suggestion.invoiceId, suggestion.statementLineId);
    this.showToast("Match approved");
    await this.saveData();
  }

  @state() private rejectedSuggestions = new Set<string>();

  private rejectSuggestion(suggestion: MatchSuggestion) {
    const key = `${suggestion.invoiceId}:${suggestion.statementLineId}`;
    this.rejectedSuggestions.add(key);
    this.requestUpdate();
    this.showToast("Suggestion dismissed");
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data:...;base64, prefix
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private detectBankFromFilename(filename: string): string {
    const lower = filename.toLowerCase();
    const banks: Record<string, string> = {
      citadele: "Citadele",
      swedbank: "Swedbank",
      seb: "SEB",
      luminor: "Luminor",
      revolut: "Revolut",
      wise: "Wise",
      paypal: "PayPal",
      stripe: "Stripe",
    };
    for (const [key, name] of Object.entries(banks)) {
      if (lower.includes(key)) return name;
    }
    return "";
  }

  private resetUploadForm() {
    this.showInvoiceUpload = false;
    this.showStatementUpload = false;
    this.showBulkUpload = false;
    this.uploadVendor = "";
    this.uploadAmount = "";
    this.uploadDate = new Date().toISOString().split("T")[0];
    this.uploadCategory = "other";
    this.uploadBank = "";
    this.bulkUploadStep = "upload";
    this.uploadedFiles = [];
    this.dragActive = false;
    this.uploadProgress = { status: "idle" };
  }

  private async startBulkUpload() {
    this.showBulkUpload = true;
    this.bulkUploadStep = "upload";
    this.uploadedFiles = [];
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = false;
  }

  private async handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.dragActive = false;

    const files = Array.from(e.dataTransfer?.files || []);
    await this.processUploadedFiles(files);
  }

  private async handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    await this.processUploadedFiles(files);
    input.value = ""; // Reset input
  }

  private async processUploadedFiles(files: File[]) {
    const validFiles = files.filter((file) => {
      const ext = file.name.toLowerCase().split(".").pop();
      return ["pdf", "jpg", "jpeg", "png", "webp"].includes(ext || "");
    });

    if (validFiles.length !== files.length) {
      this.showToast(`${files.length - validFiles.length} files skipped (unsupported format)`);
    }

    for (const file of validFiles) {
      const uploadedFile: UploadedFile = {
        file,
        id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: "uploading",
      };

      this.uploadedFiles = [...this.uploadedFiles, uploadedFile];

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        try {
          uploadedFile.previewUrl = URL.createObjectURL(file);
        } catch (e) {
          console.warn("Failed to create preview:", e);
        }
      }

      // Parse filename and create initial invoice data
      uploadedFile.status = "parsing";
      this.requestUpdate();

      try {
        const parsed = parseInvoiceFromFilename(file.name);
        uploadedFile.parsedInvoice = {
          company: this.uploadCompany,
          vendor: parsed.vendor,
          amount: 0,
          currency: "EUR",
          date: parsed.date,
          statementLineId: null,
          category: this.autoCategorizeVendor(parsed.vendor),
          description: "",
        };
        uploadedFile.status = "ready";
      } catch (e) {
        uploadedFile.status = "error";
        uploadedFile.error = "Failed to parse filename";
      }

      this.requestUpdate();
    }

    // Auto-advance to review if we have files
    if (this.uploadedFiles.length > 0) {
      setTimeout(() => {
        this.bulkUploadStep = "review";
      }, 500);
    }
  }

  private removeFile(fileId: string) {
    this.uploadedFiles = this.uploadedFiles.filter((f) => f.id !== fileId);
    if (this.uploadedFiles.length === 0) {
      this.bulkUploadStep = "upload";
    }
  }

  private updateFileInvoice(fileId: string, field: keyof Omit<Invoice, "id" | "file">, value: any) {
    const fileIndex = this.uploadedFiles.findIndex((f) => f.id === fileId);
    if (fileIndex >= 0 && this.uploadedFiles[fileIndex].parsedInvoice) {
      this.uploadedFiles[fileIndex].parsedInvoice = {
        ...this.uploadedFiles[fileIndex].parsedInvoice!,
        [field]: value,
      };
      this.requestUpdate();
    }
  }

  private async addSingleInvoice(fileId: string) {
    if (!this.gateway || !this.data) return;

    const uploadedFile = this.uploadedFiles.find((f) => f.id === fileId);
    if (!uploadedFile || !uploadedFile.parsedInvoice) return;

    try {
      // Upload file to storage
      const base64 = await this.fileToBase64(uploadedFile.file);
      const ext = uploadedFile.file.name.split(".").pop() || "pdf";
      const vendorSlug = uploadedFile.parsedInvoice.vendor.toLowerCase().replace(/\s+/g, "-");
      const destFilename = `${vendorSlug}-${uploadedFile.parsedInvoice.date}.${ext}`;
      const filePath = `finance/invoices/${destFilename}`;

      await this.gateway.request("agents.files.upload", {
        agentId: "main",
        filename: destFilename,
        path: "finance/invoices",
        content: base64,
      });

      // Add invoice to data
      this.data = addInvoice(this.data, {
        ...uploadedFile.parsedInvoice,
        file: filePath,
      });

      // Find the new invoice and mark it as newly added
      const addedInvoice = this.data.invoices[this.data.invoices.length - 1];
      this.markInvoiceAsNew(addedInvoice.id);

      uploadedFile.status = "added";
      this.requestUpdate();
      await this.saveData();
      this.showToast(`Added ${uploadedFile.parsedInvoice.vendor}`);
    } catch (e) {
      uploadedFile.status = "error";
      uploadedFile.error = "Upload failed";
      this.requestUpdate();
      console.error("Invoice upload error:", e);
    }
  }

  private async addAllInvoices() {
    const readyFiles = this.uploadedFiles.filter((f) => f.status === "ready" && f.parsedInvoice);

    for (const file of readyFiles) {
      await this.addSingleInvoice(file.id);
    }

    // Check if all files are processed
    const remainingFiles = this.uploadedFiles.filter((f) => f.status === "ready");
    if (remainingFiles.length === 0) {
      this.bulkUploadStep = "complete";
      setTimeout(() => {
        this.resetUploadForm();
        this.loadData(); // Refresh the view
      }, 2000);
    }
  }

  // Auto-categorize based on vendor name
  private autoCategorizeVendor(vendorName: string): string {
    const vendor = vendorName.toLowerCase();

    // Hosting and infrastructure
    if (
      vendor.includes("digitalocean") ||
      vendor.includes("aws") ||
      vendor.includes("amazon") ||
      vendor.includes("hetzner") ||
      vendor.includes("vultr") ||
      vendor.includes("linode") ||
      vendor.includes("cloudflare") ||
      vendor.includes("vercel") ||
      vendor.includes("netlify")
    ) {
      return "hosting";
    }

    // Software and tools
    if (
      vendor.includes("github") ||
      vendor.includes("jetbrains") ||
      vendor.includes("figma") ||
      vendor.includes("adobe") ||
      vendor.includes("openai") ||
      vendor.includes("anthropic") ||
      vendor.includes("slack") ||
      vendor.includes("zoom") ||
      vendor.includes("notion") ||
      vendor.includes("linear") ||
      vendor.includes("docker")
    ) {
      return "software";
    }

    // Marketing and advertising
    if (
      vendor.includes("google ads") ||
      vendor.includes("facebook") ||
      vendor.includes("meta") ||
      vendor.includes("linkedin") ||
      vendor.includes("twitter") ||
      vendor.includes("mailchimp") ||
      vendor.includes("sendgrid") ||
      vendor.includes("stripe ads")
    ) {
      return "marketing";
    }

    // Default to uncategorized
    return "uncategorized";
  }

  private async handleAddInvoice() {
    if (!this.data || !this.gateway || !this.uploadVendor.trim() || !this.uploadAmount) return;
    const amount = parseFloat(this.uploadAmount);
    if (isNaN(amount) || amount <= 0) return;

    const vendorSlug = this.uploadVendor.trim().toLowerCase().replace(/\s+/g, "-");
    let filePath = `finance/invoices/${vendorSlug}-${this.uploadDate}.pdf`;

    // Upload the actual file if one was selected
    const fileInput = this.shadowRoot?.querySelector("#invoice-file-input") as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (file) {
      try {
        const base64 = await this.fileToBase64(file);
        const ext = file.name.split(".").pop() || "pdf";
        const destFilename = `${vendorSlug}-${this.uploadDate}.${ext}`;
        filePath = `finance/invoices/${destFilename}`;
        await this.gateway.request("agents.files.upload", {
          agentId: "main",
          filename: destFilename,
          path: "finance/invoices",
          content: base64,
        });
      } catch (err) {
        console.error("File upload failed:", err);
        this.showToast("File upload failed");
        return;
      }
    }

    // Auto-categorize if not explicitly set
    const category =
      this.uploadCategory === "other"
        ? this.autoCategorizeVendor(this.uploadVendor.trim())
        : this.uploadCategory;

    const newInvoice = {
      company: this.uploadCompany,
      vendor: this.uploadVendor.trim(),
      amount,
      currency: "EUR",
      date: this.uploadDate,
      file: filePath,
      statementLineId: null,
      category: category,
    };

    this.data = addInvoice(this.data, newInvoice);

    // Find the new invoice and mark it as newly added
    const addedInvoice = this.data.invoices[this.data.invoices.length - 1];
    this.markInvoiceAsNew(addedInvoice.id);

    await this.saveData();
    this.showToast(file ? "Invoice uploaded" : "Invoice added");
    this.resetUploadForm();
  }

  @state() private uploadProgress: {
    status: "idle" | "parsing" | "uploading" | "success" | "error";
    message?: string;
    preview?: any[];
    bankDetected?: string;
  } = { status: "idle" };

  private async handleCSVUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.data) return;

    this.uploadProgress = { status: "parsing", message: "Parsing file..." };
    this.requestUpdate();

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      let lines;

      if (ext === "xls" || ext === "xlsx") {
        // Binary Excel format — read as ArrayBuffer, parse with SheetJS
        const buffer = await file.arrayBuffer();
        lines = await parseXLS(buffer);
      } else {
        // CSV / text format
        const text = await file.text();
        lines = parseCSV(text);
      }

      if (lines.length === 0) {
        this.uploadProgress = {
          status: "error",
          message: "No valid transactions found in file. Please check the file format.",
        };
        this.requestUpdate();
        return;
      }

      // Try to detect bank name from filename
      const bankGuess = this.detectBankFromFilename(file.name);
      const finalBankName = this.uploadBank.trim() || bankGuess || "Unknown Bank";

      // Show preview first
      this.uploadProgress = {
        status: "success",
        message: `Successfully parsed ${lines.length} transactions`,
        preview: lines.slice(0, 5), // Show first 5 transactions
        bankDetected: bankGuess,
      };
      this.uploadBank = finalBankName; // Update the bank field
      this.requestUpdate();

      // Auto-proceed after 2 seconds if user doesn't cancel
      setTimeout(async () => {
        if (this.uploadProgress.status === "success") {
          await this.confirmStatementUpload(lines, finalBankName, file.name);
        }
      }, 3000);
    } catch (err) {
      console.error("Statement parse error:", err);
      this.uploadProgress = {
        status: "error",
        message: `Failed to parse file: ${err instanceof Error ? err.message : "Unknown error"}. Supported formats: CSV, XLS, XLSX`,
      };
      this.requestUpdate();
    }
  }

  private async confirmStatementUpload(lines: any[], bankName: string, fileName: string) {
    if (!this.data) return;

    this.uploadProgress = { status: "uploading", message: "Saving statement..." };
    this.requestUpdate();

    try {
      this.data = addStatement(
        this.data,
        this.uploadCompany,
        bankName,
        `finance/statements/${fileName}`,
        lines,
      );
      await this.saveData();

      this.uploadProgress = {
        status: "success",
        message: `Successfully imported ${lines.length} transactions from ${bankName}`,
      };

      this.showToast(`Imported ${lines.length} transactions`);

      // Reset after showing success
      setTimeout(() => {
        this.resetUploadForm();
      }, 2000);
    } catch (err) {
      console.error("Statement save error:", err);
      this.uploadProgress = {
        status: "error",
        message: "Failed to save statement to database",
      };
      this.requestUpdate();
    }
  }

  private cancelStatementUpload() {
    this.uploadProgress = { status: "idle" };
    this.requestUpdate();
  }

  override render() {
    if (this.loading) {
      return html`
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading finance data...</p>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="card">
          <p style="color: var(--danger)">Error: ${this.error}</p>
          <button class="btn btn-primary" @click=${this.loadData}>Retry</button>
        </div>
      `;
    }

    return html`
      <div class="container">
        ${this.renderHeader()} ${this.renderTabs()} ${this.renderActiveTab()}
      </div>
      ${this.toast ? html`<div class="toast">${this.toast}</div>` : nothing}
      ${this.showExportModal ? this.renderExportModal() : nothing}
      ${this.showInvoiceUpload ? this.renderInvoiceUploadModal() : nothing}
      ${this.showStatementUpload ? this.renderStatementUploadModal() : nothing}
      ${this.showBulkUpload ? this.renderBulkUploadModal() : nothing}
    `;
  }

  private renderHeader() {
    return html`
      <div class="header">
        <div class="title">
          <span class="icon icon-lg">${icons.dollarSign}</span>
          Finance
          ${
            this.saving
              ? html`
                  <span class="saving-indicator">
                    <span class="spinner"></span>
                    Saving...
                  </span>
                `
              : nothing
          }
        </div>
        <div class="company-selector">
          <button
            class="company-btn ${this.companyFilter === "all" ? "active" : ""}"
            @click=${() => this.setCompany("all")}
          >
            All
          </button>
          <button
            class="company-btn ${this.companyFilter === "aexy" ? "active" : ""}"
            @click=${() => this.setCompany("aexy")}
          >
            <span class="company-dot aexy"></span> Aexy
          </button>
          <button
            class="company-btn ${this.companyFilter === "carxo" ? "active" : ""}"
            @click=${() => this.setCompany("carxo")}
          >
            <span class="company-dot carxo"></span> Carxo
          </button>
        </div>
      </div>
    `;
  }

  private renderTabs() {
    if (!this.data) return nothing;

    const unmatchedCount = getUnmatchedInvoices(this.data, this.companyFilter).length;
    const allSuggestions = autoMatchSuggestions(this.data);
    const filteredSuggestions =
      this.companyFilter === "all"
        ? allSuggestions
        : allSuggestions.filter((s) => {
            const invoice = this.data!.invoices.find((i) => i.id === s.invoiceId);
            return invoice?.company === this.companyFilter;
          });
    const suggestions = filteredSuggestions.filter((s) => {
      const key = `${s.invoiceId}:${s.statementLineId}`;
      return !this.rejectedSuggestions.has(key);
    }).length;

    return html`
      <div class="tabs">
        <button class="tab ${this.activeTab === "inbox" ? "active" : ""}" @click=${() => this.setTab("inbox")}>
          <span class="icon">${icons.inbox}</span> Inbox
          ${this.emails.length ? html`<span class="badge">${this.emails.length}</span>` : nothing}
        </button>
        <button class="tab ${this.activeTab === "invoices" ? "active" : ""}" @click=${() => this.setTab("invoices")}>
          <span class="icon">${icons.fileText}</span> Invoices
        </button>
        <button class="tab ${this.activeTab === "statements" ? "active" : ""}" @click=${() => this.setTab("statements")}>
          <span class="icon">${icons.creditCard}</span> Statements
        </button>
        <button class="tab ${this.activeTab === "matching" ? "active" : ""}" @click=${() => this.setTab("matching")}>
          <span class="icon">${icons.link}</span> Matching
          ${unmatchedCount > 0 || suggestions > 0 ? html`<span class="badge">${unmatchedCount}</span>` : nothing}
        </button>
        <button class="tab ${this.activeTab === "reports" ? "active" : ""}" @click=${() => this.setTab("reports")}>
          <span class="icon">${icons.barChart}</span> Reports
        </button>
        <button class="tab ${this.activeTab === "vendors" ? "active" : ""}" @click=${() => this.setTab("vendors")}>
          <span class="icon">${icons.building}</span> Vendors
        </button>
        <button class="tab ${this.activeTab === "usage" ? "active" : ""}" @click=${() => this.setTab("usage")}>
          <span class="icon">${icons.zap}</span> Usage & Costs
        </button>
      </div>
    `;
  }

  private renderActiveTab() {
    switch (this.activeTab) {
      case "inbox":
        return this.renderInboxTab();
      case "invoices":
        return this.renderInvoicesTab();
      case "statements":
        return this.renderStatementsTab();
      case "matching":
        return this.renderMatchingTab();
      case "reports":
        return this.renderReportsTab();
      case "vendors":
        return this.renderVendorsTab();
      case "usage":
        return this.renderUsageTab();
    }
  }

  private renderInboxTab() {
    return html`
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Email Inbox</h3>
          <button class="btn btn-secondary btn-sm" @click=${this.loadData}><span class="icon">${icons.refreshCw}</span> Refresh</button>
        </div>
        ${
          this.emails.length === 0
            ? html`
                <div class="empty-state">
                  <div class="empty-state-icon"><span class="icon icon-xl">${icons.mail}</span></div>
                  <p>No invoice emails found</p>
                  <p style="font-size: 12px">Gmail integration pending...</p>
                </div>
              `
            : html`
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Attachments</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.emails.map(
                    (email) => html`
                      <tr>
                        <td>${email.from}</td>
                        <td>${email.subject}</td>
                        <td>${formatDate(email.date)}</td>
                        <td>
                          ${
                            email.hasAttachments
                              ? html`
                                  <span class="status matched"><span class="icon">${icons.paperclip}</span> Yes</span>
                                `
                              : html`
                                  <span class="status unmatched">No</span>
                                `
                          }
                        </td>
                        <td>
                          ${
                            email.hasAttachments
                              ? html`
                                  <select>
                                    <option value="">Save to...</option>
                                    <option value="aexy">Aexy</option>
                                    <option value="carxo">Carxo</option>
                                  </select>
                                `
                              : nothing
                          }
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
        }
      </div>
      <p style="color: var(--muted); text-align: center; font-size: 12px;">
        Gmail API integration pending. Showing mock data.
      </p>
    `;
  }

  private getFilteredAndSortedInvoices() {
    if (!this.data) return [];

    let invoices = getInvoices(this.data, this.companyFilter);

    // Apply filters
    if (this.invoiceFilters.category) {
      invoices = invoices.filter((inv) => inv.category === this.invoiceFilters.category);
    }

    if (this.invoiceFilters.status === "matched") {
      invoices = invoices.filter((inv) => !!inv.statementLineId);
    } else if (this.invoiceFilters.status === "unmatched") {
      invoices = invoices.filter((inv) => !inv.statementLineId);
    }

    if (this.invoiceFilters.dateStart) {
      invoices = invoices.filter((inv) => inv.date >= this.invoiceFilters.dateStart);
    }

    if (this.invoiceFilters.dateEnd) {
      invoices = invoices.filter((inv) => inv.date <= this.invoiceFilters.dateEnd);
    }

    if (this.invoiceFilters.search) {
      const search = this.invoiceFilters.search.toLowerCase();
      invoices = invoices.filter(
        (inv) =>
          inv.vendor.toLowerCase().includes(search) ||
          inv.description?.toLowerCase().includes(search),
      );
    }

    // Apply sorting
    invoices.sort((a, b) => {
      let comparison = 0;

      switch (this.invoiceSort) {
        case "date":
          comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
          break;
        case "amount":
          comparison = a.amount - b.amount;
          break;
        case "vendor":
          comparison = a.vendor.localeCompare(b.vendor);
          break;
      }

      return this.invoiceSortDirection === "desc" ? -comparison : comparison;
    });

    return invoices;
  }

  private getInvoiceSummary() {
    if (!this.data)
      return { total: 0, totalAmount: 0, matched: 0, unmatched: 0, aexyAmount: 0, carxoAmount: 0 };

    const invoices = getInvoices(this.data, this.companyFilter);
    const matched = invoices.filter((inv) => !!inv.statementLineId);
    const unmatched = invoices.filter((inv) => !inv.statementLineId);
    const aexyAmount = invoices
      .filter((inv) => inv.company === "aexy")
      .reduce((sum, inv) => sum + inv.amount, 0);
    const carxoAmount = invoices
      .filter((inv) => inv.company === "carxo")
      .reduce((sum, inv) => sum + inv.amount, 0);
    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0);

    return {
      total: invoices.length,
      totalAmount,
      matched: matched.length,
      unmatched: unmatched.length,
      aexyAmount,
      carxoAmount,
    };
  }

  private updateInvoiceFilter(field: keyof typeof this.invoiceFilters, value: string) {
    this.invoiceFilters = { ...this.invoiceFilters, [field]: value };
  }

  private updateSort(sort: "date" | "amount" | "vendor") {
    if (this.invoiceSort === sort) {
      this.invoiceSortDirection = this.invoiceSortDirection === "asc" ? "desc" : "asc";
    } else {
      this.invoiceSort = sort;
      this.invoiceSortDirection = sort === "date" ? "desc" : "asc";
    }
  }

  private toggleInvoiceSelection(invoiceId: string, event: Event) {
    event.stopPropagation();

    if (this.selectedInvoices.has(invoiceId)) {
      this.selectedInvoices.delete(invoiceId);
    } else {
      this.selectedInvoices.add(invoiceId);
    }

    this.showBulkActions = this.selectedInvoices.size > 0;
    this.requestUpdate();
  }

  private selectAllInvoices() {
    const invoices = this.getFilteredAndSortedInvoices();
    if (this.selectedInvoices.size === invoices.length) {
      this.selectedInvoices.clear();
    } else {
      this.selectedInvoices.clear();
      invoices.forEach((inv) => this.selectedInvoices.add(inv.id));
    }
    this.showBulkActions = this.selectedInvoices.size > 0;
  }

  private async bulkDeleteInvoices() {
    if (!this.data || this.selectedInvoices.size === 0) return;

    if (!confirm(`Delete ${this.selectedInvoices.size} selected invoices?`)) return;

    this.data = {
      ...this.data,
      invoices: this.data.invoices.filter((inv) => !this.selectedInvoices.has(inv.id)),
    };

    this.selectedInvoices.clear();
    this.showBulkActions = false;
    await this.saveData();
    this.showToast(`Deleted invoices`);
  }

  private async bulkAssignCategory(category: string) {
    if (!this.data || this.selectedInvoices.size === 0) return;

    this.data = {
      ...this.data,
      invoices: this.data.invoices.map((inv) =>
        this.selectedInvoices.has(inv.id) ? { ...inv, category } : inv,
      ),
    };

    this.selectedInvoices.clear();
    this.showBulkActions = false;
    await this.saveData();
    this.showToast(`Updated category for invoices`);
  }

  private renderInvoicesTab() {
    if (!this.data) return nothing;

    const invoices = this.getFilteredAndSortedInvoices();
    const summary = this.getInvoiceSummary();

    return html`
      <!-- Summary Bar -->
      <div class="summary-bar">
        <div class="summary-stat">
          <div class="summary-value">${summary.total}</div>
          <div class="summary-label">Total Invoices</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">${formatCurrency(summary.totalAmount)}</div>
          <div class="summary-label">Total Amount</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">${summary.matched}</div>
          <div class="summary-label">Matched</div>
        </div>
        <div class="summary-stat">
          <div class="summary-value">${summary.unmatched}</div>
          <div class="summary-label">Unmatched</div>
        </div>
        ${
          this.companyFilter === "all"
            ? html`
          <div class="summary-stat">
            <div class="summary-value">${formatCurrency(summary.aexyAmount)}</div>
            <div class="summary-label"><span class="company-dot aexy"></span> Aexy</div>
          </div>
          <div class="summary-stat">
            <div class="summary-value">${formatCurrency(summary.carxoAmount)}</div>
            <div class="summary-label"><span class="company-dot carxo"></span> Carxo</div>
          </div>
        `
            : nothing
        }
      </div>

      <!-- Header with Actions -->
      <div class="invoices-header">
        <h3 class="invoices-title">Invoices (${invoices.length}${invoices.length !== summary.total ? ` of ${summary.total}` : ""})</h3>
        <div class="invoices-actions">
          <button class="btn btn-secondary btn-sm" @click=${() => {
            this.showInvoiceUpload = true;
          }}>
            <span class="icon">${icons.plus}</span> Add Invoice
          </button>
          <button class="btn btn-primary btn-sm" @click=${() => this.startBulkUpload()}>
            <span class="icon">${icons.upload}</span> Upload Invoices
          </button>
        </div>
      </div>

      ${
        this.showBulkActions
          ? html`
        <!-- Bulk Actions Bar -->
        <div class="bulk-actions-bar">
          <div class="bulk-actions-info">
            <span class="icon">${icons.check}</span>
            ${this.selectedInvoices.size} invoice${this.selectedInvoices.size === 1 ? "" : "s"} selected
          </div>
          <div class="bulk-actions-buttons">
            <select class="bulk-action-select" @change=${(e: Event) => {
              const value = (e.target as HTMLSelectElement).value;
              if (value && value !== "category") {
                this.bulkAssignCategory(value);
                (e.target as HTMLSelectElement).value = "category";
              }
            }}>
              <option value="category">Assign Category...</option>
              ${this.data?.categories.map((cat) => html`<option value="${cat}">${cat}</option>`)}
            </select>
            <button class="btn btn-secondary btn-sm" @click=${this.bulkDeleteInvoices}>
              <span class="icon">${icons.trash}</span> Delete
            </button>
            <button class="btn btn-secondary btn-sm" @click=${() => {
              this.selectedInvoices.clear();
              this.showBulkActions = false;
            }}>
              Cancel
            </button>
          </div>
        </div>
      `
          : nothing
      }

      ${
        invoices.length === 0 && Object.values(this.invoiceFilters).every((f) => !f)
          ? html`
        <!-- Empty State -->
        <div class="empty-state-card">
          <div class="empty-state">
            <div class="empty-state-icon"><span class="icon icon-xl">${icons.fileText}</span></div>
            <h4>No invoices yet</h4>
            <p>Upload your first invoices to get started</p>
            <button class="btn btn-primary" @click=${() => this.startBulkUpload()}>
              <span class="icon">${icons.upload}</span> Upload Invoices
            </button>
          </div>
        </div>
      `
          : html`
        <!-- Filter and Sort Bar -->
        <div class="filter-sort-bar">
          <div class="filter-section">
            <div class="filter-group">
              <span class="filter-label">Search:</span>
              <input type="text" 
                     class="filter-input"
                     placeholder="Vendor name..."
                     .value=${this.invoiceFilters.search}
                     @input=${(e: InputEvent) => this.updateInvoiceFilter("search", (e.target as HTMLInputElement).value)} />
            </div>
            
            <div class="filter-group">
              <span class="filter-label">Category:</span>
              <select class="filter-select" 
                      .value=${this.invoiceFilters.category}
                      @change=${(e: Event) => this.updateInvoiceFilter("category", (e.target as HTMLSelectElement).value)}>
                <option value="">All</option>
                ${this.data?.categories.map((cat) => html`<option value="${cat}">${cat}</option>`)}
              </select>
            </div>
            
            <div class="filter-group">
              <span class="filter-label">Status:</span>
              <select class="filter-select"
                      .value=${this.invoiceFilters.status}
                      @change=${(e: Event) => this.updateInvoiceFilter("status", (e.target as HTMLSelectElement).value)}>
                <option value="">All</option>
                <option value="matched">Matched ✅</option>
                <option value="unmatched">Unmatched ⬜</option>
              </select>
            </div>
            
            <div class="filter-group">
              <span class="filter-label">Date:</span>
              <input type="date" 
                     class="filter-input filter-date"
                     .value=${this.invoiceFilters.dateStart}
                     @change=${(e: Event) => this.updateInvoiceFilter("dateStart", (e.target as HTMLInputElement).value)} />
              <span class="filter-to">to</span>
              <input type="date" 
                     class="filter-input filter-date"
                     .value=${this.invoiceFilters.dateEnd}
                     @change=${(e: Event) => this.updateInvoiceFilter("dateEnd", (e.target as HTMLInputElement).value)} />
            </div>
          </div>
          
          <div class="sort-section">
            <span class="filter-label">Sort:</span>
            <button class="sort-btn ${this.invoiceSort === "date" ? "active" : ""}" 
                    @click=${() => this.updateSort("date")}>
              Date ${this.invoiceSort === "date" ? (this.invoiceSortDirection === "desc" ? "↓" : "↑") : ""}
            </button>
            <button class="sort-btn ${this.invoiceSort === "amount" ? "active" : ""}" 
                    @click=${() => this.updateSort("amount")}>
              Amount ${this.invoiceSort === "amount" ? (this.invoiceSortDirection === "desc" ? "↓" : "↑") : ""}
            </button>
            <button class="sort-btn ${this.invoiceSort === "vendor" ? "active" : ""}" 
                    @click=${() => this.updateSort("vendor")}>
              Vendor ${this.invoiceSort === "vendor" ? (this.invoiceSortDirection === "desc" ? "↓" : "↑") : ""}
            </button>
          </div>
        </div>

        ${
          invoices.length === 0
            ? html`
          <div class="no-results">
            <span class="icon">${icons.filter}</span>
            <p>No invoices match your filters</p>
            <button class="btn btn-secondary btn-sm" @click=${() => {
              this.invoiceFilters = {
                category: "",
                status: "",
                dateStart: "",
                dateEnd: "",
                search: "",
              };
            }}>
              Clear Filters
            </button>
          </div>
        `
            : html`
          <!-- Invoice Grid -->
          <div class="invoice-grid-container">
            <!-- Header for bulk select -->
            <div class="invoice-grid-header">
              <label class="invoice-checkbox-label">
                <input type="checkbox"
                       class="invoice-checkbox" 
                       .checked=${this.selectedInvoices.size > 0 && this.selectedInvoices.size === invoices.length}
                       .indeterminate=${this.selectedInvoices.size > 0 && this.selectedInvoices.size < invoices.length}
                       @change=${this.selectAllInvoices} />
                <span class="checkmark"></span>
                Select All
              </label>
            </div>
            
            <div class="invoice-grid">
              ${invoices.map((invoice) => this.renderEnhancedInvoiceCard(invoice))}
            </div>
          </div>
        `
        }
      `
      }
    `;
  }

  @state() private expandedInvoices = new Set<string>();
  @state() private newlyAddedInvoices = new Set<string>();

  private toggleInvoiceDetails(invoiceId: string) {
    if (this.expandedInvoices.has(invoiceId)) {
      this.expandedInvoices.delete(invoiceId);
    } else {
      this.expandedInvoices.add(invoiceId);
    }
    this.requestUpdate();
  }

  private startEditInvoice(invoice: Invoice, event: Event) {
    event.stopPropagation();
    this.editingInvoice = { ...invoice };
  }

  private cancelEditInvoice() {
    this.editingInvoice = null;
  }

  private async saveInvoiceEdit() {
    if (!this.editingInvoice || !this.data) return;

    this.data = {
      ...this.data,
      invoices: this.data.invoices.map((inv) =>
        inv.id === this.editingInvoice!.id ? this.editingInvoice! : inv,
      ),
    };

    this.editingInvoice = null;
    await this.saveData();
    this.showToast("Invoice updated");
  }

  private async deleteInvoice(invoice: Invoice, event: Event) {
    event.stopPropagation();

    if (!confirm(`Delete invoice from ${invoice.vendor}?`)) return;

    if (!this.data) return;

    this.data = {
      ...this.data,
      invoices: this.data.invoices.filter((inv) => inv.id !== invoice.id),
    };

    await this.saveData();
    this.showToast("Invoice deleted");
  }

  private updateEditingInvoice(field: keyof Invoice, value: any) {
    if (!this.editingInvoice) return;
    this.editingInvoice = { ...this.editingInvoice, [field]: value };
  }

  private getCategoryColor(category: string | null): string {
    switch (category) {
      case "software":
        return "#8b5cf6";
      case "hosting":
        return "#3b82f6";
      case "services":
        return "#06b6d4";
      case "marketing":
        return "#f59e0b";
      case "travel":
        return "#10b981";
      case "office":
        return "#ec4899";
      case "legal":
        return "#6366f1";
      case "uncategorized":
        return "#6b7280";
      case "other":
        return "#9ca3af";
      default:
        return "#9ca3af";
    }
  }

  private getMatchedTransaction(invoice: Invoice): StatementLine | null {
    if (!invoice.statementLineId || !this.data) return null;
    return this.data.statementLines.find((line) => line.id === invoice.statementLineId) || null;
  }

  private markInvoiceAsNew(invoiceId: string) {
    this.newlyAddedInvoices.add(invoiceId);
    setTimeout(() => {
      this.newlyAddedInvoices.delete(invoiceId);
      this.requestUpdate();
    }, 3000);
  }

  private renderEnhancedInvoiceCard(invoice: Invoice) {
    const isExpanded = this.expandedInvoices.has(invoice.id);
    const isSelected = this.selectedInvoices.has(invoice.id);
    const isEditing = this.editingInvoice?.id === invoice.id;
    const isNewlyAdded = this.newlyAddedInvoices.has(invoice.id);
    const matchedTransaction = this.getMatchedTransaction(invoice);

    return html`
      <div class="enhanced-invoice-card ${isExpanded ? "expanded" : ""} ${isSelected ? "selected" : ""} ${isNewlyAdded ? "newly-added" : ""}"
           style="border-left: 4px solid ${this.getCategoryColor(invoice.category)}"
           @click=${() => this.toggleInvoiceDetails(invoice.id)}>
        
        <!-- Card Header -->
        <div class="enhanced-card-header">
          <div class="invoice-checkbox-container" @click=${(e: Event) => e.stopPropagation()}>
            <label class="invoice-checkbox-label">
              <input type="checkbox" 
                     class="invoice-checkbox"
                     .checked=${isSelected}
                     @change=${(e: Event) => this.toggleInvoiceSelection(invoice.id, e)} />
              <span class="checkmark"></span>
            </label>
          </div>
          
          <div class="enhanced-invoice-main">
            <div class="enhanced-vendor-section">
              <h4 class="enhanced-vendor-name">${invoice.vendor}</h4>
              <div class="enhanced-invoice-meta">
                <span class="enhanced-company-badge ${invoice.company}">
                  <span class="company-dot ${invoice.company}"></span>
                  ${invoice.company.toUpperCase()}
                </span>
                <span class="enhanced-category-badge" style="color: ${this.getCategoryColor(invoice.category)}">
                  ${invoice.category || "uncategorized"}
                </span>
                <span class="enhanced-date">${new Date(invoice.date).toLocaleDateString("en-GB")}</span>
              </div>
            </div>
            
            <div class="enhanced-amount-section">
              <div class="enhanced-amount">${formatCurrency(invoice.amount, invoice.currency)}</div>
              <div class="enhanced-status">
                ${
                  invoice.statementLineId
                    ? html`
                  <span class="status-badge matched">
                    <span class="icon">${icons.checkCircle}</span> Matched
                  </span>
                `
                    : html`
                  <span class="status-badge unmatched">
                    <span class="icon">${icons.clock}</span> Unmatched
                  </span>
                `
                }
              </div>
            </div>
          </div>
          
          <div class="enhanced-card-actions" @click=${(e: Event) => e.stopPropagation()}>
            <button class="btn-icon" @click=${(e: Event) => this.startEditInvoice(invoice, e)} title="Edit">
              <span class="icon">${icons.edit}</span>
            </button>
            <button class="btn-icon btn-icon-danger" @click=${(e: Event) => this.deleteInvoice(invoice, e)} title="Delete">
              <span class="icon">${icons.trash}</span>
            </button>
          </div>
        </div>

        <!-- Description -->
        ${
          invoice.description
            ? html`
          <div class="enhanced-description">
            ${invoice.description}
          </div>
        `
            : nothing
        }

        <!-- File Link -->
        <div class="enhanced-file-section">
          <a href="#" class="enhanced-file-link" @click=${(e: Event) => e.stopPropagation()}>
            <span class="icon">${icons.paperclip}</span>
            ${invoice.file.split("/").pop()}
          </a>
        </div>

        <!-- Expanded Details -->
        ${
          isExpanded
            ? html`
          <div class="enhanced-details">
            ${
              isEditing
                ? html`
              <!-- Edit Form -->
              <div class="enhanced-edit-form">
                <div class="edit-form-grid">
                  <div class="form-group">
                    <label class="form-label">Vendor</label>
                    <input class="form-input" 
                           .value=${this.editingInvoice!.vendor}
                           @input=${(e: InputEvent) => this.updateEditingInvoice("vendor", (e.target as HTMLInputElement).value)} />
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label">Amount</label>
                    <input class="form-input" 
                           type="number" 
                           step="0.01"
                           .value=${this.editingInvoice!.amount}
                           @input=${(e: InputEvent) => this.updateEditingInvoice("amount", parseFloat((e.target as HTMLInputElement).value))} />
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label">Date</label>
                    <input class="form-input" 
                           type="date"
                           .value=${this.editingInvoice!.date}
                           @change=${(e: Event) => this.updateEditingInvoice("date", (e.target as HTMLInputElement).value)} />
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label">Category</label>
                    <select class="form-input"
                            .value=${this.editingInvoice!.category}
                            @change=${(e: Event) => this.updateEditingInvoice("category", (e.target as HTMLSelectElement).value)}>
                      ${this.data?.categories.map((cat) => html`<option value="${cat}">${cat}</option>`)}
                    </select>
                  </div>
                  
                  <div class="form-group form-group-full">
                    <label class="form-label">Description</label>
                    <textarea class="form-input" 
                              rows="2"
                              .value=${this.editingInvoice!.description || ""}
                              @input=${(e: InputEvent) => this.updateEditingInvoice("description", (e.target as HTMLTextAreaElement).value)}></textarea>
                  </div>
                </div>
                
                <div class="edit-form-actions">
                  <button class="btn btn-secondary btn-sm" @click=${this.cancelEditInvoice}>
                    Cancel
                  </button>
                  <button class="btn btn-primary btn-sm" @click=${this.saveInvoiceEdit}>
                    <span class="icon">${icons.check}</span> Save
                  </button>
                </div>
              </div>
            `
                : html`
              <!-- View Details -->
              <div class="enhanced-details-grid">
                <div class="detail-item">
                  <span class="detail-label">Invoice ID:</span>
                  <span class="detail-value">${invoice.id}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Currency:</span>
                  <span class="detail-value">${invoice.currency}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Company:</span>
                  <span class="detail-value">
                    <span class="company-dot ${invoice.company}"></span>
                    ${invoice.company}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Category:</span>
                  <span class="detail-value" style="color: ${this.getCategoryColor(invoice.category)}">
                    ${invoice.category || "uncategorized"}
                  </span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">File Path:</span>
                  <span class="detail-value detail-file">${invoice.file}</span>
                </div>
                ${
                  matchedTransaction
                    ? html`
                  <div class="detail-item detail-item-full">
                    <span class="detail-label">Matched Transaction:</span>
                    <div class="matched-transaction">
                      <div class="matched-description">${matchedTransaction.description}</div>
                      <div class="matched-meta">
                        ${new Date(matchedTransaction.date).toLocaleDateString("en-GB")} • 
                        ${formatCurrency(matchedTransaction.amount)}
                      </div>
                    </div>
                  </div>
                `
                    : nothing
                }
              </div>
            `
            }
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderInvoiceCard(invoice: Invoice) {
    const isExpanded = this.expandedInvoices.has(invoice.id);

    return html`
      <div class="invoice-card ${isExpanded ? "invoice-expanded" : ""}" 
           @click=${() => this.toggleInvoiceDetails(invoice.id)}>
        <div class="invoice-card-header">
          <div>
            <div class="invoice-vendor">${invoice.vendor}</div>
            <div class="invoice-meta">
              <span><span class="company-dot ${invoice.company}"></span> ${invoice.company}</span>
              <span>•</span>
              <span>${formatDate(invoice.date)}</span>
              <span>•</span>
              <span class="category-${invoice.category || "other"}">${invoice.category || "other"}</span>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="invoice-amount">${formatCurrency(invoice.amount, invoice.currency)}</div>
            ${
              invoice.statementLineId
                ? html`<span class="status matched"><span class="icon">${icons.check}</span> Matched</span>`
                : html`<span class="status unmatched"><span class="icon">${icons.clock}</span> Unmatched</span>`
            }
          </div>
        </div>

        ${
          invoice.description
            ? html`
          <div class="invoice-description">${invoice.description}</div>
        `
            : nothing
        }

        <div class="invoice-footer">
          <a href="#" class="invoice-file" @click=${(e: Event) => e.stopPropagation()}>
            <span class="icon">${icons.paperclip}</span>
            ${invoice.file.split("/").pop()}
          </a>
          <div class="invoice-actions" @click=${(e: Event) => e.stopPropagation()}>
            <button class="btn btn-secondary btn-sm">
              <span class="icon">${icons.edit2}</span>
            </button>
            <button class="btn btn-secondary btn-sm">
              <span class="icon">${icons.trash}</span>
            </button>
          </div>
        </div>

        ${
          isExpanded
            ? html`
          <div class="invoice-details">
            <div class="invoice-details-grid">
              <div class="invoice-detail">
                <span class="invoice-detail-label">Invoice ID:</span>
                <span class="invoice-detail-value">${invoice.id}</span>
              </div>
              <div class="invoice-detail">
                <span class="invoice-detail-label">Currency:</span>
                <span class="invoice-detail-value">${invoice.currency}</span>
              </div>
              <div class="invoice-detail">
                <span class="invoice-detail-label">File Path:</span>
                <span class="invoice-detail-value">${invoice.file}</span>
              </div>
              <div class="invoice-detail">
                <span class="invoice-detail-label">Status:</span>
                <span class="invoice-detail-value">
                  ${invoice.statementLineId ? "Matched to bank transaction" : "Awaiting bank match"}
                </span>
              </div>
            </div>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderStatementsTab() {
    if (!this.data) return nothing;
    const statements = getStatements(this.data, this.companyFilter);

    return html`
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Bank Statements (${statements.length})</h3>
          <button class="btn btn-primary btn-sm" @click=${() => {
            this.showStatementUpload = true;
          }}><span class="icon">${icons.upload}</span> Upload Statement</button>
        </div>
        ${
          statements.length === 0
            ? html`
                <div class="empty-state">
                  <div class="empty-state-icon"><span class="icon icon-xl">${icons.creditCard}</span></div>
                  <p>No statements uploaded</p>
                  <p style="font-size: 13px; color: var(--muted);">Upload bank statements to see transaction summaries</p>
                </div>
              `
            : html`
              <div class="statement-list">
                ${statements.map((stmt) => this.renderStatementCard(stmt))}
              </div>
            `
        }
      </div>
    `;
  }

  @state() private expandedStatements = new Set<string>();

  private toggleStatementTransactions(statementId: string) {
    if (this.expandedStatements.has(statementId)) {
      this.expandedStatements.delete(statementId);
    } else {
      this.expandedStatements.add(statementId);
    }
    this.requestUpdate();
  }

  private renderStatementCard(statement: any) {
    if (!this.data) return nothing;

    const transactions = this.data.statementLines.filter(
      (line) => line.statementId === statement.id,
    );
    const isExpanded = this.expandedStatements.has(statement.id);

    // Calculate summary data
    const dateRange = this.calculateStatementDateRange(transactions);
    const totals = this.calculateStatementTotals(transactions);
    const bankName =
      this.detectBankFromFilename(statement.file) || statement.bank || "Unknown Bank";

    // Data quality checks
    const qualityIssues = this.checkStatementQuality(transactions);

    return html`
      <div class="statement-card ${isExpanded ? "expanded" : ""}">
        <!-- Statement Header Card -->
        <div class="statement-header" @click=${() => this.toggleStatementTransactions(statement.id)}>
          <div class="statement-header-left">
            <div class="statement-bank">${bankName}</div>
            <div class="statement-meta">
              <span class="company-dot ${statement.company}"></span>
              <span>${statement.company}</span>
              <span>•</span>
              <span>${dateRange}</span>
              <span>•</span>
              <span>${transactions.length} transactions</span>
            </div>
            ${
              qualityIssues.length > 0
                ? html`
              <div class="quality-warning">
                <span class="icon">${icons.alertTriangle}</span>
                ${qualityIssues.length} data quality issue${qualityIssues.length === 1 ? "" : "s"}
              </div>
            `
                : nothing
            }
          </div>
          
          <div class="statement-header-right">
            <div class="statement-totals">
              <div class="total-income">
                <span class="total-label">Income</span>
                <span class="total-value positive">+${formatCurrency(Math.abs(totals.income))}</span>
              </div>
              <div class="total-expenses">
                <span class="total-label">Expenses</span>
                <span class="total-value negative">${formatCurrency(totals.expenses)}</span>
              </div>
              <div class="total-net">
                <span class="total-label">Net</span>
                <span class="total-value ${totals.net >= 0 ? "positive" : "negative"}">${formatCurrency(totals.net)}</span>
              </div>
            </div>
            
            <div class="statement-actions" @click=${(e: Event) => e.stopPropagation()}>
              <button class="btn btn-secondary btn-sm" title="Re-upload">
                <span class="icon">${icons.refreshCw}</span>
              </button>
              <button class="btn btn-secondary btn-sm" title="Download">
                <span class="icon">${icons.download}</span>
              </button>
            </div>
          </div>
          
          <div class="expand-indicator">
            <span class="icon">${isExpanded ? icons.chevronUp : icons.chevronDown}</span>
          </div>
        </div>

        <!-- Expandable Transaction Table -->
        ${
          isExpanded
            ? html`
          <div class="statement-transactions">
            ${
              qualityIssues.length > 0
                ? html`
              <div class="quality-issues">
                <h4>Data Quality Issues:</h4>
                <ul>
                  ${qualityIssues.map((issue) => html`<li>${issue}</li>`)}
                </ul>
              </div>
            `
                : nothing
            }
            
            <div class="transaction-table-controls">
              <div class="table-info">
                Showing ${transactions.length} transactions
              </div>
              <div class="table-actions">
                <button class="btn btn-secondary btn-sm" @click=${() => this.sortTransactions(statement.id, "date")}>
                  <span class="icon">${icons.calendar}</span> Sort by Date
                </button>
                <button class="btn btn-secondary btn-sm" @click=${() => this.sortTransactions(statement.id, "amount")}>
                  <span class="icon">${icons.dollarSign}</span> Sort by Amount
                </button>
              </div>
            </div>
            
            <table class="transaction-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th>Balance</th>
                  <th>Category</th>
                  <th>Matched</th>
                </tr>
              </thead>
              <tbody>
                ${transactions.map((transaction) => this.renderTransactionRow(transaction))}
              </tbody>
            </table>
          </div>
        `
            : nothing
        }
      </div>
    `;
  }

  private renderTransactionRow(transaction: any) {
    if (!this.data) return nothing;

    const hasQualityIssues = this.checkTransactionQuality(transaction);
    const matchedInvoice = this.data.invoices.find((inv) => inv.id === transaction.invoiceId);
    const category = matchedInvoice?.category || "—";

    return html`
      <tr class="transaction-row ${hasQualityIssues ? "quality-issue" : ""}">
        <td class="date-cell">
          ${this.formatTransactionDate(transaction.date)}
        </td>
        <td class="description-cell">
          <div class="description-main">${this.cleanDescription(transaction.description)}</div>
          ${
            hasQualityIssues
              ? html`
            <div class="quality-flag">
              <span class="icon">${icons.alertTriangle}</span>
              Data quality issue
            </div>
          `
              : nothing
          }
        </td>
        <td class="amount-cell">
          <span class="amount ${transaction.amount >= 0 ? "positive" : "negative"}">
            ${this.formatAmount(transaction.amount)}
          </span>
        </td>
        <td class="balance-cell">
          ${transaction.balance !== undefined ? this.formatAmount(transaction.balance) : "—"}
        </td>
        <td class="category-cell">
          ${
            category !== "—"
              ? html`
            <span class="category-tag category-${category}">${category}</span>
          `
              : html`
                  <span class="category-empty">—</span>
                `
          }
        </td>
        <td class="matched-cell">
          ${
            transaction.invoiceId
              ? html`
            <span class="match-status matched" title="Matched to invoice">
              <span class="icon">${icons.check}</span>
            </span>
          `
              : transaction.amount < 0
                ? html`
            <button class="match-status unmatched" 
                    title="Click to find matching invoice"
                    @click=${() => this.jumpToMatching(transaction)}>
              <span class="icon">${icons.link}</span>
            </button>
          `
                : html`
            <span class="match-status income" title="Income transaction">
              <span class="icon">${icons.trendingUp}</span>
            </span>
          `
          }
        </td>
      </tr>
    `;
  }

  private calculateStatementDateRange(transactions: any[]): string {
    if (transactions.length === 0) return "No transactions";

    const validDates = transactions
      .map((t) => t.date)
      .filter((date) => date !== "Unknown" && date !== "—")
      .sort();

    if (validDates.length === 0) return "Unknown date range";
    if (validDates.length === 1) return this.formatDateDD_MM_YYYY(validDates[0]);

    const first = this.formatDateDD_MM_YYYY(validDates[0]);
    const last = this.formatDateDD_MM_YYYY(validDates[validDates.length - 1]);

    return `${first} → ${last}`;
  }

  private calculateStatementTotals(transactions: any[]) {
    const income = transactions.filter((t) => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);

    const expenses = transactions.filter((t) => t.amount < 0).reduce((sum, t) => sum + t.amount, 0);

    const net = income + expenses;

    return { income, expenses, net };
  }

  private checkStatementQuality(transactions: any[]): string[] {
    const issues: string[] = [];

    const unknownDates = transactions.filter((t) => t.date === "Unknown" || t.date === "—").length;
    if (unknownDates > 0) {
      issues.push(`${unknownDates} transaction${unknownDates === 1 ? "" : "s"} with unknown dates`);
    }

    const zeroAmounts = transactions.filter((t) => t.amount === 0).length;
    if (zeroAmounts > 0) {
      issues.push(`${zeroAmounts} transaction${zeroAmounts === 1 ? "" : "s"} with zero amount`);
    }

    const rawDescriptions = transactions.filter(
      (t) =>
        t.description.includes("|") || t.description.includes("  ") || t.description.trim() === "",
    ).length;
    if (rawDescriptions > 0) {
      issues.push(
        `${rawDescriptions} transaction${rawDescriptions === 1 ? "" : "s"} with poor description quality`,
      );
    }

    return issues;
  }

  private checkTransactionQuality(transaction: any): boolean {
    return (
      transaction.date === "Unknown" ||
      transaction.date === "—" ||
      transaction.amount === 0 ||
      transaction.description.includes("|") ||
      transaction.description.includes("  ") ||
      transaction.description.trim() === ""
    );
  }

  private formatTransactionDate(dateStr: string): string {
    if (dateStr === "Unknown" || dateStr === "—") {
      return html`
        <span class="date-unknown">—</span>
      `;
    }
    return this.formatDateDD_MM_YYYY(dateStr);
  }

  private formatDateDD_MM_YYYY(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const year = date.getFullYear();

      return `${day}.${month}.${year}`;
    } catch (e) {
      return dateStr;
    }
  }

  private formatAmount(amount: number): string {
    const formatted = new Intl.NumberFormat("lv-LV", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));

    return amount >= 0 ? `+${formatted}` : `${formatted}`;
  }

  private cleanDescription(description: string): string {
    if (!description) return "(no description)";

    // Clean up pipe-separated data
    let cleaned = description.replace(/\s*\|\s*/g, " - ");

    // Remove excessive whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // If still empty or too short
    if (!cleaned || cleaned.length < 3) {
      return "(no description)";
    }

    return cleaned;
  }

  private jumpToMatching(transaction: any) {
    this.selectedLine = transaction;
    this.setTab("matching");
  }

  private sortTransactions(statementId: string, sortBy: "date" | "amount") {
    if (!this.data) return;

    const statement = this.data.statements.find((s) => s.id === statementId);
    if (!statement) return;

    const transactions = this.data.statementLines.filter((l) => l.statementId === statementId);

    transactions.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        return dateB.getTime() - dateA.getTime(); // Newest first
      } else {
        return Math.abs(b.amount) - Math.abs(a.amount); // Largest amounts first
      }
    });

    // Update the statement lines order in the data
    const otherLines = this.data.statementLines.filter((l) => l.statementId !== statementId);
    this.data.statementLines = [...otherLines, ...transactions];

    this.requestUpdate();
  }

  private renderMatchingTab() {
    if (!this.data) return nothing;

    const unmatchedInvoices = getUnmatchedInvoices(this.data, this.companyFilter);
    const unmatchedLines = getUnmatchedStatementLines(this.data, this.companyFilter);

    // Get smart suggestions
    const allSuggestions = autoMatchSuggestions(this.data);
    let suggestions = allSuggestions;

    // Filter by company if needed
    if (this.companyFilter !== "all") {
      suggestions = allSuggestions.filter((s) => {
        const invoice = this.data!.invoices.find((i) => i.id === s.invoiceId);
        return invoice?.company === this.companyFilter;
      });
    }

    // Filter out rejected suggestions
    suggestions = suggestions.filter((s) => {
      const key = `${s.invoiceId}:${s.statementLineId}`;
      return !this.rejectedSuggestions.has(key);
    });

    // Get the actual invoice and line objects for each suggestion
    const suggestionDetails = suggestions.map((s) => {
      const invoice = this.data!.invoices.find((i) => i.id === s.invoiceId)!;
      const line = this.data!.statementLines.find((l) => l.id === s.statementLineId)!;
      return { suggestion: s, invoice, line };
    });

    return html`
      ${
        suggestionDetails.length > 0
          ? html`
            <div class="card suggestions">
              <h3 class="card-title" style="margin-bottom: 16px;">Smart Match Suggestions (${suggestionDetails.length})</h3>
              ${suggestionDetails.map(
                ({ suggestion, invoice, line }) => html`
                  <div class="suggestion-item">
                    <div class="suggestion-content">
                      <div style="min-width: 200px;">
                        <strong>${invoice.vendor}</strong>
                        <div class="amount">${formatCurrency(invoice.amount)}</div>
                        <div style="font-size: 11px; color: var(--muted);">
                          ${formatDate(invoice.date)} • <span class="company-dot ${invoice.company}"></span> ${invoice.company}
                        </div>
                      </div>
                      <div class="suggestion-arrow">→</div>
                      <div style="min-width: 250px;">
                        <strong>${line.description}</strong>
                        <div class="amount negative">${formatCurrency(line.amount)}</div>
                        <div style="font-size: 11px; color: var(--muted);">${formatDate(line.date)}</div>
                      </div>
                      <div style="min-width: 150px; font-size: 12px;">
                        <div style="margin-bottom: 4px; font-weight: 500; color: var(--text-strong);">
                          ${suggestion.confidence}% confidence
                        </div>
                        <div style="color: var(--muted);">
                          ${suggestion.reasons.join(", ")}
                        </div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                      <div style="text-align: center;">
                        <div class="confidence-bar" style="width: 50px;">
                          <div class="confidence-fill" style="width: ${suggestion.confidence}%"></div>
                        </div>
                        <div style="font-size: 10px; color: var(--muted); margin-top: 2px;">
                          ${suggestion.confidence}%
                        </div>
                      </div>
                      <button class="btn btn-success btn-sm" @click=${() => this.approveSuggestion(suggestion)}>
                        <span class="icon">${icons.check}</span> Approve
                      </button>
                      <button class="btn btn-secondary btn-sm" @click=${() => this.rejectSuggestion(suggestion)}>
                        <span class="icon">${icons.x}</span> Reject
                      </button>
                    </div>
                  </div>
                `,
              )}
            </div>
          `
          : nothing
      }

      <!-- Already Matched Pairs -->
      ${(() => {
        const matchedInvoices = getMatchedInvoices(this.data!, this.companyFilter);
        return matchedInvoices.length > 0
          ? html`
          <div class="card" style="margin-bottom: 20px;">
            <h3 class="card-title" style="margin-bottom: 16px;">Already Matched (${matchedInvoices.length})</h3>
            <div style="max-height: 200px; overflow-y: auto;">
              ${matchedInvoices.slice(0, 10).map((invoice) => {
                const line = this.data!.statementLines.find(
                  (l) => l.id === invoice.statementLineId,
                );
                return line
                  ? html`
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border);">
                    <div>
                      <strong>${invoice.vendor}</strong> (${formatCurrency(invoice.amount)})
                    </div>
                    <div class="suggestion-arrow">↔</div>
                    <div>
                      <strong>${line.description}</strong> (${formatCurrency(line.amount)})
                    </div>
                    <span class="status matched">
                      <span class="icon">${icons.check}</span> Matched
                    </span>
                  </div>
                `
                  : nothing;
              })}
              ${
                matchedInvoices.length > 10
                  ? html`
                <div style="text-align: center; padding: 8px; color: var(--muted); font-size: 12px;">
                  and ${matchedInvoices.length - 10} more...
                </div>
              `
                  : nothing
              }
            </div>
          </div>
        `
          : nothing;
      })()}

      <div class="matching-container">
        <div class="match-list">
          <div class="match-list-header">Unmatched Invoices (${unmatchedInvoices.length})</div>
          ${
            unmatchedInvoices.length === 0
              ? html`
                  <div class="empty-state" style="padding: 30px">
                    <div class="empty-state-icon"><span class="icon icon-xl">${icons.checkCircle}</span></div>
                    <p>All invoices matched!</p>
                  </div>
                `
              : unmatchedInvoices.map(
                  (inv) => html`
                  <div
                    class="match-item ${this.selectedInvoice?.id === inv.id ? "selected" : ""}"
                    @click=${() => this.selectInvoice(inv)}
                  >
                    <div class="match-item-header">
                      <span class="match-item-vendor">${inv.vendor}</span>
                      <span class="match-item-amount">${formatCurrency(inv.amount)}</span>
                    </div>
                    <div class="match-item-meta">
                      ${formatDate(inv.date)} · <span class="company-dot ${inv.company}"></span> ${inv.company}
                    </div>
                  </div>
                `,
                )
          }
        </div>

        <div class="match-list">
          <div class="match-list-header">Unmatched Lines (${unmatchedLines.length})</div>
          ${
            unmatchedLines.length === 0
              ? html`
                  <div class="empty-state" style="padding: 30px">
                    <div class="empty-state-icon"><span class="icon icon-xl">${icons.checkCircle}</span></div>
                    <p>All lines matched!</p>
                  </div>
                `
              : unmatchedLines.map(
                  (line) => html`
                  <div
                    class="match-item ${this.selectedLine?.id === line.id ? "selected" : ""}"
                    @click=${() => this.selectLine(line)}
                  >
                    <div class="match-item-header">
                      <span class="match-item-vendor">${line.description}</span>
                      <span class="match-item-amount amount negative">${formatCurrency(line.amount)}</span>
                    </div>
                    <div class="match-item-meta">${formatDate(line.date)}</div>
                  </div>
                `,
                )
          }
        </div>
      </div>

      ${
        this.selectedInvoice && this.selectedLine
          ? html`
            <div class="card" style="margin-top: 20px; text-align: center;">
              <p>
                Match <strong>${this.selectedInvoice.vendor}</strong> (${formatCurrency(this.selectedInvoice.amount)})
                with <strong>${this.selectedLine.description}</strong> (${formatCurrency(this.selectedLine.amount)})?
              </p>
              <div style="display: flex; justify-content: center; gap: 12px; margin-top: 16px;">
                <button class="btn btn-success" @click=${this.tryMatch}><span class="icon">${icons.check}</span> Confirm Match</button>
                <button
                  class="btn btn-secondary"
                  @click=${() => {
                    this.selectedInvoice = null;
                    this.selectedLine = null;
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          `
          : nothing
      }
    `;
  }

  private renderReportsTab() {
    if (!this.data) return nothing;

    const invoices = getMatchedInvoices(this.data, this.companyFilter);
    const byCategory = getSpendingByCategory(
      this.data,
      this.companyFilter,
      this.dateRange.start,
      this.dateRange.end,
    );
    const byMonth = getSpendingByMonth(this.data, this.companyFilter);
    const byVendor = getSpendingByVendor(
      this.data,
      this.companyFilter,
      this.dateRange.start,
      this.dateRange.end,
    );

    const totalSpending = Object.values(byCategory).reduce((a, b) => a + b, 0);
    const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
    const monthEntries = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0]));
    const maxMonthSpend = Math.max(...Object.values(byMonth), 1);

    return html`
      <div class="card-header" style="margin-bottom: 20px;">
        <div class="date-range">
          <span style="color: var(--muted); font-size: 13px;">Date Range:</span>
          <input
            type="date"
            class="date-input"
            .value=${this.dateRange.start}
            @change=${(e: Event) =>
              (this.dateRange = { ...this.dateRange, start: (e.target as HTMLInputElement).value })}
          />
          <span style="color: var(--muted);">to</span>
          <input
            type="date"
            class="date-input"
            .value=${this.dateRange.end}
            @change=${(e: Event) =>
              (this.dateRange = { ...this.dateRange, end: (e.target as HTMLInputElement).value })}
          />
        </div>
        <button class="btn btn-primary" @click=${() => (this.showExportModal = true)}><span class="icon">${icons.download}</span> Export</button>
      </div>

      <div class="report-grid">
        <div class="stat-card">
          <div class="stat-label">Matched Invoices</div>
          <div class="stat-value">${invoices.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Spending</div>
          <div class="stat-value">${formatCurrency(totalSpending)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Top Category</div>
          <div class="stat-value" style="font-size: 20px;">${categoryEntries[0]?.[0] || "N/A"}</div>
        </div>
      </div>

      ${
        monthEntries.length > 0
          ? html`
            <div class="card">
              <h3 class="card-title" style="margin-bottom: 16px;">Spending by Month</h3>
              <div class="chart-container">
                ${monthEntries.map(
                  ([month, amount]) => html`
                    <div
                      class="chart-bar"
                      style="height: ${(amount / maxMonthSpend) * 100}%"
                      data-label="${month}"
                      title="${formatCurrency(amount)}"
                    ></div>
                  `,
                )}
              </div>
            </div>
          `
          : nothing
      }

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="card">
          <h3 class="card-title" style="margin-bottom: 16px;">By Category</h3>
          ${categoryEntries.map(
            ([cat, amount]) => html`
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <span class="category-${cat}">${cat}</span>
                <span class="amount">${formatCurrency(amount)}</span>
              </div>
            `,
          )}
        </div>

        <div class="card">
          <h3 class="card-title" style="margin-bottom: 16px;">Top Vendors</h3>
          ${byVendor.slice(0, 8).map(
            ({ vendor, total, count }) => html`
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border);">
                <span>
                  ${vendor}
                  <span style="color: var(--muted); font-size: 11px;">(${count})</span>
                </span>
                <span class="amount">${formatCurrency(total)}</span>
              </div>
            `,
          )}
        </div>
      </div>
    `;
  }

  private renderUsageTab() {
    const today = new Date().toISOString().split("T")[0];
    const todayData = this.costUsageSummary?.daily.find((d) => d.date === today) || {
      date: today,
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      totalCost: 0,
      missingCostEntries: 0,
    };

    const weeklyTotal = this.costUsageSummary?.totals || todayData;
    const dailyData = this.costUsageSummary?.daily || [];

    // Calculate max cost for chart scaling
    const maxDailyCost = Math.max(...dailyData.map((d) => d.totalCost), 1);

    if (this.usageLoading) {
      return html`
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="margin-bottom: 16px;"><span class="icon icon-xl">${icons.loader}</span></div>
          <p>Loading usage data...</p>
        </div>
      `;
    }

    return html`
      <div class="report-grid" style="margin-bottom: 24px;">
        <div class="stat-card ${getCostColorClass(todayData.totalCost)}">
          <div class="stat-label">Today's Cost</div>
          <div class="stat-value">${formatCost(todayData.totalCost)}</div>
          <div class="stat-sub">${formatTokens(todayData.totalTokens)} tokens</div>
        </div>
        <div class="stat-card ${getCostColorClass(weeklyTotal.totalCost)}">
          <div class="stat-label">Week Total</div>
          <div class="stat-value">${formatCost(weeklyTotal.totalCost)}</div>
          <div class="stat-sub">${formatTokens(weeklyTotal.totalTokens)} tokens</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Providers</div>
          <div class="stat-value">${this.usageSummary?.providers?.length || 0}</div>
          <div class="stat-sub">API connections</div>
        </div>
      </div>

      ${
        dailyData.length > 0
          ? html`
        <div class="card" style="margin-bottom: 24px;">
          <h3 class="card-title" style="margin-bottom: 16px;">Daily Cost (Last 7 Days)</h3>
          <div class="chart-container">
            ${dailyData.map(
              (day) => html`
              <div class="chart-bar-wrapper">
                <div
                  class="chart-bar cost-${getCostColorClass(day.totalCost)}"
                  style="height: ${(day.totalCost / maxDailyCost) * 100}%"
                  title="${day.date}: ${formatCost(day.totalCost)}"
                ></div>
                <div class="chart-label">${new Date(day.date).toLocaleDateString("en-US", { weekday: "short" })}</div>
              </div>
            `,
            )}
          </div>
        </div>
      `
          : nothing
      }

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div class="card">
          <h3 class="card-title" style="margin-bottom: 16px;">Token Usage Breakdown</h3>
          <div style="display: grid; gap: 12px;">
            <div style="display: flex; justify-content: space-between;">
              <span>Input tokens:</span>
              <span class="amount">${formatTokens(weeklyTotal.input)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Output tokens:</span>
              <span class="amount">${formatTokens(weeklyTotal.output)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Cache reads:</span>
              <span class="amount">${formatTokens(weeklyTotal.cacheRead)}</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>Cache writes:</span>
              <span class="amount">${formatTokens(weeklyTotal.cacheWrite)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; padding-top: 8px; border-top: 1px solid var(--border); font-weight: 500;">
              <span>Total tokens:</span>
              <span class="amount">${formatTokens(weeklyTotal.totalTokens)}</span>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title" style="margin-bottom: 16px;">Provider Status</h3>
          ${
            this.usageSummary?.providers?.length
              ? this.usageSummary.providers.map(
                  (provider) => html`
            <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-weight: 500;">${provider.displayName}</span>
                ${provider.plan ? html`<span style="font-size: 11px; color: var(--muted);">${provider.plan}</span>` : nothing}
              </div>
              ${
                provider.error
                  ? html`
                <div style="color: var(--error); font-size: 12px;">${provider.error}</div>
              `
                  : provider.windows.map(
                      (window) => html`
                <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--muted);">
                  <span>${window.label}:</span>
                  <span class="${window.usedPercent > 80 ? "cost-high" : window.usedPercent > 50 ? "cost-medium" : "cost-low"}">
                    ${window.usedPercent.toFixed(1)}% used
                  </span>
                </div>
              `,
                    )
              }
            </div>
          `,
                )
              : html`
                  <p style="color: var(--muted)">No provider data available</p>
                `
          }
        </div>
      </div>

      <div style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center;">
        <button class="btn btn-secondary" @click=${() => this.loadUsageData()}>
          <span class="icon">${icons.refreshCw}</span> Refresh
        </button>
        <div style="font-size: 11px; color: var(--muted);">
          Last updated: ${this.costUsageSummary ? new Date(this.costUsageSummary.updatedAt).toLocaleString() : "Never"}
        </div>
      </div>
    `;
  }

  private renderExportModal() {
    return html`
      <div class="modal-backdrop" @click=${() => (this.showExportModal = false)}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Export to Accountant</h3>
            <button class="modal-close" @click=${() => (this.showExportModal = false)}>×</button>
          </div>

          <div class="form-group">
            <label class="form-label">Date Range</label>
            <div class="date-range">
              <input type="date" class="form-input" .value=${this.dateRange.start} style="width: auto;" />
              <span>to</span>
              <input type="date" class="form-input" .value=${this.dateRange.end} style="width: auto;" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Export includes:</label>
            <ul style="color: var(--muted); font-size: 13px; margin: 8px 0; padding-left: 20px;">
              <li>All matched invoices (PDFs)</li>
              <li>Bank statements (CSV)</li>
              <li>Summary report</li>
            </ul>
          </div>

          <div class="form-group">
            <label class="form-label">Send to (optional)</label>
            <input type="email" class="form-input" placeholder="accountant@example.com" />
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
            <button class="btn btn-secondary" @click=${() => (this.showExportModal = false)}>Cancel</button>
            <button class="btn btn-primary" @click=${this.handleExport}><span class="icon">${icons.download}</span> Download ZIP</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderInvoiceUploadModal() {
    return html`
      <div class="modal-backdrop" @click=${() => this.resetUploadForm()}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Add Invoice</h3>
            <button class="modal-close" @click=${() => this.resetUploadForm()}>×</button>
          </div>
          <div class="form-group">
            <label class="form-label">Invoice File (PDF)</label>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" id="invoice-file-input" />
          </div>
          <div class="form-group">
            <label class="form-label">Company</label>
            <select class="form-input" .value=${this.uploadCompany}
              @change=${(e: Event) => {
                this.uploadCompany = (e.target as HTMLSelectElement).value as "aexy" | "carxo";
              }}>
              <option value="aexy">Aexy</option>
              <option value="carxo">Carxo</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Vendor</label>
            <input class="form-input" placeholder="e.g. DigitalOcean" .value=${this.uploadVendor}
              @input=${(e: InputEvent) => {
                this.uploadVendor = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div class="form-group">
            <label class="form-label">Amount (EUR)</label>
            <input class="form-input" type="number" step="0.01" min="0" placeholder="0.00" .value=${this.uploadAmount}
              @input=${(e: InputEvent) => {
                this.uploadAmount = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input class="form-input" type="date" .value=${this.uploadDate}
              @change=${(e: Event) => {
                this.uploadDate = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div class="form-group">
            <label class="form-label">Category</label>
            <select class="form-input" .value=${this.uploadCategory}
              @change=${(e: Event) => {
                this.uploadCategory = (e.target as HTMLSelectElement).value;
              }}>
              ${this.data?.categories.map((c) => html`<option value=${c}>${c}</option>`) ?? nothing}
            </select>
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Cancel</button>
            <button class="btn btn-primary" @click=${() => this.handleAddInvoice()}
              ?disabled=${!this.uploadVendor.trim() || !this.uploadAmount}>Add Invoice</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderStatementUploadModal() {
    return html`
      <div class="modal-backdrop" @click=${() => this.resetUploadForm()}>
        <div class="modal" style="min-width: 500px;" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Upload Bank Statement</h3>
            <button class="modal-close" @click=${() => this.resetUploadForm()}>×</button>
          </div>
          
          ${
            this.uploadProgress.status === "idle"
              ? html`
            <div class="form-group">
              <label class="form-label">Company</label>
              <select class="form-input" .value=${this.uploadCompany}
                @change=${(e: Event) => {
                  this.uploadCompany = (e.target as HTMLSelectElement).value as "aexy" | "carxo";
                }}>
                <option value="aexy">Aexy</option>
                <option value="carxo">Carxo</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Bank Name (optional)</label>
              <input class="form-input" 
                     placeholder="Auto-detected from filename" 
                     .value=${this.uploadBank}
                     @input=${(e: InputEvent) => {
                       this.uploadBank = (e.target as HTMLInputElement).value;
                     }} />
              <div style="font-size: 11px; color: var(--muted); margin-top: 4px;">
                Supports: Citadele, Swedbank, SEB, Luminor, Revolut, Wise
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Statement File</label>
              <p style="font-size: 12px; color: var(--muted); margin: 4px 0 8px;">
                Supports CSV, XLS, XLSX. Auto-detects columns and handles various bank formats.
              </p>
              <input type="file" 
                     accept=".csv,.xls,.xlsx" 
                     @change=${(e: Event) => this.handleCSVUpload(e)} />
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
              <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Cancel</button>
            </div>
          `
              : nothing
          }

          ${
            this.uploadProgress.status === "parsing"
              ? html`
                  <div class="upload-status">
                    <div class="status-icon">
                      <span class="spinner"></span>
                    </div>
                    <div class="status-message">
                      <strong>Parsing file...</strong>
                      <p>Reading transactions and detecting format</p>
                    </div>
                  </div>
                `
              : nothing
          }

          ${
            this.uploadProgress.status === "success" && this.uploadProgress.preview
              ? html`
            <div class="upload-status success">
              <div class="status-icon">
                <span class="icon" style="color: var(--ok);">${icons.check}</span>
              </div>
              <div class="status-message">
                <strong>${this.uploadProgress.message}</strong>
                ${
                  this.uploadProgress.bankDetected
                    ? html`
                  <p>Detected bank: <strong>${this.uploadProgress.bankDetected}</strong></p>
                `
                    : nothing
                }
              </div>
            </div>

            <div class="preview-section">
              <h4>Transaction Preview (first 5):</h4>
              <table class="preview-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${this.uploadProgress.preview.map(
                    (transaction) => html`
                    <tr>
                      <td>${this.formatTransactionDate(transaction.date)}</td>
                      <td>${this.cleanDescription(transaction.description)}</td>
                      <td class="amount ${transaction.amount >= 0 ? "positive" : "negative"}">
                        ${this.formatAmount(transaction.amount)}
                      </td>
                    </tr>
                  `,
                  )}
                </tbody>
              </table>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
              <button class="btn btn-secondary" @click=${() => this.cancelStatementUpload()}>Cancel</button>
              <button class="btn btn-primary" 
                      @click=${() =>
                        this.confirmStatementUpload(
                          this.uploadProgress.preview || [],
                          this.uploadBank,
                          "uploaded-file.csv",
                        )}>
                <span class="icon">${icons.check}</span> Confirm Upload
              </button>
            </div>
          `
              : nothing
          }

          ${
            this.uploadProgress.status === "uploading"
              ? html`
                  <div class="upload-status">
                    <div class="status-icon">
                      <span class="spinner"></span>
                    </div>
                    <div class="status-message">
                      <strong>Saving statement...</strong>
                      <p>Adding transactions to your finance database</p>
                    </div>
                  </div>
                `
              : nothing
          }

          ${
            this.uploadProgress.status === "error"
              ? html`
            <div class="upload-status error">
              <div class="status-icon">
                <span class="icon" style="color: var(--danger);">${icons.x}</span>
              </div>
              <div class="status-message">
                <strong>Upload Failed</strong>
                <p>${this.uploadProgress.message}</p>
              </div>
            </div>

            <div class="error-help">
              <h4>Troubleshooting:</h4>
              <ul>
                <li>Ensure the file has a header row with columns like Date, Description, Amount</li>
                <li>Check that dates are in DD.MM.YYYY, YYYY-MM-DD, or DD/MM/YYYY format</li>
                <li>Amounts should be numeric (negative for expenses, positive for income)</li>
                <li>For Citadele statements, the pipe-separated format is automatically handled</li>
              </ul>
            </div>

            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
              <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Close</button>
              <button class="btn btn-primary" @click=${() => {
                this.uploadProgress = { status: "idle" };
                this.requestUpdate();
              }}>
                <span class="icon">${icons.refreshCw}</span> Try Again
              </button>
            </div>
          `
              : nothing
          }
        </div>
      </div>
    `;
  }

  private handleExport() {
    this.showToast("Export prepared");
    this.showExportModal = false;
  }

  private renderBulkUploadModal() {
    return html`
      <div class="modal-backdrop" @click=${() => this.resetUploadForm()}>
        <div class="modal" style="min-width: 600px; max-width: 90vw;" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Upload Invoices</h3>
            <button class="modal-close" @click=${() => this.resetUploadForm()}>×</button>
          </div>

          <div class="step-indicator">
            <div class="step ${this.bulkUploadStep === "upload" ? "active" : this.uploadedFiles.length > 0 ? "completed" : ""}">
              1. Upload Files
            </div>
            <div class="step ${this.bulkUploadStep === "review" ? "active" : this.uploadedFiles.some((f) => f.status === "added") ? "completed" : ""}">
              2. Review & Edit
            </div>
            <div class="step ${this.bulkUploadStep === "complete" ? "active" : ""}">
              3. Complete
            </div>
          </div>

          ${this.renderBulkUploadStep()}
        </div>
      </div>
    `;
  }

  private renderBulkUploadStep() {
    switch (this.bulkUploadStep) {
      case "upload":
        return this.renderUploadStep();
      case "review":
        return this.renderReviewStep();
      case "complete":
        return this.renderCompleteStep();
    }
  }

  private renderUploadStep() {
    return html`
      <div class="form-group">
        <label class="form-label">Company</label>
        <select class="form-input" .value=${this.uploadCompany}
          @change=${(e: Event) => {
            this.uploadCompany = (e.target as HTMLSelectElement).value as "aexy" | "carxo";
          }}>
          <option value="aexy">Aexy</option>
          <option value="carxo">Carxo</option>
        </select>
      </div>

      <div class="upload-zone ${this.dragActive ? "drag-active" : ""}"
           @dragover=${this.handleDragOver}
           @dragleave=${this.handleDragLeave}
           @drop=${this.handleDrop}
           @click=${() => this.shadowRoot?.querySelector("#bulk-file-input")?.click()}>
        <div class="upload-zone-icon">
          <span class="icon icon-xl">${icons.upload}</span>
        </div>
        <div class="upload-zone-text">Drop invoice files here or click to browse</div>
        <div class="upload-zone-subtitle">Upload multiple invoices at once</div>
        <div class="upload-zone-formats">Supports: PDF, JPG, PNG, WebP</div>
        
        <input type="file" 
               id="bulk-file-input" 
               multiple 
               accept=".pdf,.jpg,.jpeg,.png,.webp"
               style="display: none;"
               @change=${this.handleFileSelect} />
      </div>

      ${
        this.uploadedFiles.length > 0
          ? html`
        <div class="file-list">
          <h4 style="margin-bottom: 16px;">Uploaded Files (${this.uploadedFiles.length})</h4>
          ${this.uploadedFiles.map(
            (file) => html`
            <div class="file-item">
              <div class="file-preview">
                ${
                  file.previewUrl
                    ? html`<img src="${file.previewUrl}" alt="${file.file.name}" />`
                    : html`<span class="icon">${icons.fileText}</span>`
                }
              </div>
              <div class="file-info">
                <div class="file-name">${file.file.name}</div>
                <div class="file-status">
                  ${
                    file.status === "uploading"
                      ? html`
                          <span class="spinner" style="width: 12px; height: 12px"></span>
                          <span class="status-parsing">Uploading...</span>
                        `
                      : file.status === "parsing"
                        ? html`
                            <span class="spinner" style="width: 12px; height: 12px"></span>
                            <span class="status-parsing">Parsing...</span>
                          `
                        : file.status === "ready"
                          ? html`
                    <span class="icon">${icons.check}</span>
                    <span class="status-ready">Ready for review</span>
                  `
                          : file.status === "added"
                            ? html`
                    <span class="icon">${icons.checkCircle}</span>
                    <span class="status-added">Added</span>
                  `
                            : html`
                    <span class="icon">${icons.x}</span>
                    <span class="status-error">${file.error || "Error"}</span>
                  `
                  }
                </div>
              </div>
              <div class="file-actions">
                <button class="btn btn-secondary btn-sm" @click=${() => this.removeFile(file.id)}>
                  <span class="icon">${icons.trash}</span>
                </button>
              </div>
            </div>
          `,
          )}
        </div>
      `
          : nothing
      }

      <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px;">
        <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Cancel</button>
        <button class="btn btn-primary" 
                ?disabled=${this.uploadedFiles.filter((f) => f.status === "ready").length === 0}
                @click=${() => (this.bulkUploadStep = "review")}>
          Review Files (${this.uploadedFiles.filter((f) => f.status === "ready").length})
        </button>
      </div>
    `;
  }

  private renderReviewStep() {
    const readyFiles = this.uploadedFiles.filter(
      (f) => f.status === "ready" || f.status === "added",
    );

    return html`
      <div class="review-container">
        ${readyFiles.map(
          (file) => html`
          <div class="review-item">
            <div class="review-header">
              <div class="review-preview">
                ${
                  file.previewUrl
                    ? html`<img src="${file.previewUrl}" alt="${file.file.name}" />`
                    : html`<span class="icon">${icons.fileText}</span>`
                }
              </div>
              <div style="flex: 1;">
                <div class="review-filename">${file.file.name}</div>
                <div class="review-extracted">
                  Extracted: ${file.parsedInvoice?.vendor || "Unknown"} • ${file.parsedInvoice?.date || "Unknown date"}
                </div>
              </div>
              <div>
                ${
                  file.status === "added"
                    ? html`
                  <span class="status added"><span class="icon">${icons.checkCircle}</span> Added</span>
                `
                    : html`
                  <span class="status ready"><span class="icon">${icons.clock}</span> Ready</span>
                `
                }
              </div>
            </div>
            
            ${
              file.parsedInvoice && file.status !== "added"
                ? html`
              <div class="review-form">
                <div class="form-group">
                  <label class="form-label">Vendor Name</label>
                  <input class="form-input" 
                         .value=${file.parsedInvoice.vendor}
                         @input=${(e: InputEvent) => this.updateFileInvoice(file.id, "vendor", (e.target as HTMLInputElement).value)} />
                </div>
                <div class="form-group">
                  <label class="form-label">Amount (EUR)</label>
                  <input class="form-input" 
                         type="number" 
                         step="0.01" 
                         min="0"
                         .value=${file.parsedInvoice.amount}
                         @input=${(e: InputEvent) => this.updateFileInvoice(file.id, "amount", parseFloat((e.target as HTMLInputElement).value) || 0)} />
                </div>
                <div class="form-group">
                  <label class="form-label">Currency</label>
                  <select class="form-input" 
                          .value=${file.parsedInvoice.currency}
                          @change=${(e: Event) => this.updateFileInvoice(file.id, "currency", (e.target as HTMLSelectElement).value)}>
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Date</label>
                  <input class="form-input" 
                         type="date" 
                         .value=${file.parsedInvoice.date}
                         @change=${(e: Event) => this.updateFileInvoice(file.id, "date", (e.target as HTMLInputElement).value)} />
                </div>
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <select class="form-input" 
                          .value=${file.parsedInvoice.category}
                          @change=${(e: Event) => this.updateFileInvoice(file.id, "category", (e.target as HTMLSelectElement).value)}>
                    ${this.data?.categories.map((cat) => html`<option value=${cat}>${cat}</option>`)}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Description (optional)</label>
                  <textarea class="form-input" 
                            placeholder="Additional notes..."
                            rows="2"
                            .value=${file.parsedInvoice.description || ""}
                            @input=${(e: InputEvent) => this.updateFileInvoice(file.id, "description", (e.target as HTMLTextAreaElement).value)}></textarea>
                </div>
              </div>
              
              <div class="review-actions">
                <button class="btn btn-secondary btn-sm" @click=${() => this.removeFile(file.id)}>
                  <span class="icon">${icons.trash}</span> Remove
                </button>
                <button class="btn btn-primary btn-sm" 
                        ?disabled=${!file.parsedInvoice.vendor || !file.parsedInvoice.amount}
                        @click=${() => this.addSingleInvoice(file.id)}>
                  <span class="icon">${icons.plus}</span> Add Invoice
                </button>
              </div>
            `
                : nothing
            }
          </div>
        `,
        )}
      </div>

      <div style="display: flex; gap: 12px; justify-content: space-between; margin-top: 24px;">
        <button class="btn btn-secondary" @click=${() => (this.bulkUploadStep = "upload")}>
          <span class="icon">${icons.chevronLeft}</span> Back
        </button>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Cancel</button>
          <button class="btn btn-primary" 
                  ?disabled=${readyFiles.filter((f) => f.status === "ready" && f.parsedInvoice?.vendor && f.parsedInvoice?.amount).length === 0}
                  @click=${() => this.addAllInvoices()}>
            <span class="icon">${icons.check}</span> Add All 
            (${readyFiles.filter((f) => f.status === "ready" && f.parsedInvoice?.vendor && f.parsedInvoice?.amount).length})
          </button>
        </div>
      </div>
    `;
  }

  private renderCompleteStep() {
    const addedCount = this.uploadedFiles.filter((f) => f.status === "added").length;

    return html`
      <div style="text-align: center; padding: 40px 20px;">
        <div style="color: var(--ok); font-size: 48px; margin-bottom: 16px;">
          <span class="icon icon-xl">${icons.checkCircle}</span>
        </div>
        <h3 style="margin-bottom: 8px;">Upload Complete!</h3>
        <p style="color: var(--muted); margin-bottom: 24px;">
          Successfully added ${addedCount} invoice${addedCount === 1 ? "" : "s"} to your finance system.
        </p>
        
        <div style="display: flex; gap: 12px; justify-content: center;">
          <button class="btn btn-secondary" @click=${() => this.startBulkUpload()}>
            Upload More
          </button>
          <button class="btn btn-primary" @click=${() => this.resetUploadForm()}>
            <span class="icon">${icons.check}</span> Done
          </button>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "finance-view": FinanceView;
  }
}
