/**
 * Finance View - Bookkeeping Dashboard
 * Manages invoices, bank statements, matching, and reports
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayBrowserClient } from "../../gateway.js";
import { icons } from "../../icons.js";
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
  type FinanceData,
  type Invoice,
  type StatementLine,
  type Email,
  type CompanyFilter,
  type MatchSuggestion,
  type UsageSummary,
  type CostUsageSummary,
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

type TabType = "inbox" | "invoices" | "statements" | "matching" | "reports" | "usage";

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

  static override styles = css`
    :host {
      display: block;
      height: 100%;
      background: var(--bg);
      color: var(--text);
      padding: 20px;
      overflow: auto;
      font-family: var(--font-body);
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

    /* Improved invoice cards */
    .invoice-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
    }

    .invoice-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 16px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .invoice-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md);
      border-color: var(--border-strong);
    }

    .invoice-card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 12px;
    }

    .invoice-vendor {
      font-weight: 600;
      font-size: 16px;
      color: var(--text-strong);
      margin-bottom: 4px;
    }

    .invoice-amount {
      font-family: var(--font-mono);
      font-weight: 700;
      font-size: 18px;
      color: var(--text-strong);
    }

    .invoice-meta {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 12px;
    }

    .invoice-description {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 12px;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .invoice-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .invoice-file {
      font-size: 11px;
      color: var(--muted);
      text-decoration: none;
    }

    .invoice-file:hover {
      color: var(--accent);
    }

    .invoice-actions {
      display: flex;
      gap: 4px;
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
      color: var(--text);
    }
  `;

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
          category: "other",
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

    this.data = addInvoice(this.data, {
      company: this.uploadCompany,
      vendor: this.uploadVendor.trim(),
      amount,
      currency: "EUR",
      date: this.uploadDate,
      file: filePath,
      statementLineId: null,
      category: this.uploadCategory,
    });
    await this.saveData();
    this.showToast(file ? "Invoice uploaded" : "Invoice added");
    this.resetUploadForm();
  }

  private async handleCSVUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.data) return;

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
        this.showToast("No valid transactions found in file");
        return;
      }

      // Try to detect bank name from filename
      const bankGuess = this.detectBankFromFilename(file.name);

      this.data = addStatement(
        this.data,
        this.uploadCompany,
        this.uploadBank.trim() || bankGuess || "Unknown",
        `finance/statements/${file.name}`,
        lines,
      );
      await this.saveData();
      this.showToast(`Imported ${lines.length} transactions`);
      this.resetUploadForm();
    } catch (err) {
      console.error("Statement parse error:", err);
      this.showToast("Failed to parse file. Supported: CSV, XLS, XLSX");
    }
    input.value = "";
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
        <button class="tab ${this.activeTab === "usage" ? "active" : ""}" @click=${() => this.setTab("usage")}>
          <span class="icon">${icons.activity}</span> Usage & Costs
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

  private renderInvoicesTab() {
    if (!this.data) return nothing;
    const invoices = getInvoices(this.data, this.companyFilter);

    return html`
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">All Invoices (${invoices.length})</h3>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary btn-sm" @click=${() => {
              this.showInvoiceUpload = true;
            }}>
              <span class="icon">${icons.plus}</span> Add Single
            </button>
            <button class="btn btn-primary btn-sm" @click=${() => this.startBulkUpload()}>
              <span class="icon">${icons.upload}</span> Upload Invoices
            </button>
          </div>
        </div>
        
        ${
          invoices.length === 0
            ? html`
              <div class="empty-state">
                <div class="empty-state-icon"><span class="icon icon-xl">${icons.fileText}</span></div>
                <p>No invoices yet</p>
                <p style="font-size: 12px; color: var(--muted);">Upload your first invoices to get started</p>
              </div>
            `
            : html`
              <div class="filter-bar">
                <div class="filter-group">
                  <span class="filter-label">Category:</span>
                  <select class="filter-select">
                    <option value="">All categories</option>
                    ${this.data?.categories.map((cat) => html`<option value=${cat}>${cat}</option>`)}
                  </select>
                </div>
                <div class="filter-group">
                  <span class="filter-label">Status:</span>
                  <select class="filter-select">
                    <option value="">All invoices</option>
                    <option value="matched">Matched</option>
                    <option value="unmatched">Unmatched</option>
                  </select>
                </div>
                <div class="filter-group">
                  <span class="filter-label">Date range:</span>
                  <input type="date" class="filter-select" />
                  <span style="color: var(--muted);">to</span>
                  <input type="date" class="filter-select" />
                </div>
              </div>
              
              <div class="invoice-grid">
                ${invoices.map((inv) => this.renderInvoiceCard(inv))}
              </div>
            `
        }
      </div>
    `;
  }

  @state() private expandedInvoices = new Set<string>();

  private toggleInvoiceDetails(invoiceId: string) {
    if (this.expandedInvoices.has(invoiceId)) {
      this.expandedInvoices.delete(invoiceId);
    } else {
      this.expandedInvoices.add(invoiceId);
    }
    this.requestUpdate();
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
    const lines = getStatementLines(this.data, this.companyFilter);

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
                </div>
              `
            : html`
              <table>
                <thead>
                  <tr>
                    <th>Bank</th>
                    <th>Company</th>
                    <th>File</th>
                    <th>Uploaded</th>
                    <th>Lines</th>
                  </tr>
                </thead>
                <tbody>
                  ${statements.map(
                    (stmt) => html`
                      <tr>
                        <td><strong>${stmt.bank}</strong></td>
                        <td><span class="company-dot ${stmt.company}"></span> ${stmt.company}</td>
                        <td style="font-size: 12px; color: var(--muted);">${stmt.file.split("/").pop()}</td>
                        <td>${formatDate(stmt.uploadedAt)}</td>
                        <td>${lines.filter((l) => l.statementId === stmt.id).length}</td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
        }
      </div>

      ${
        lines.length > 0
          ? html`
            <div class="card">
              <h3 class="card-title" style="margin-bottom: 16px;">Transactions (${lines.length})</h3>
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${lines.slice(0, 15).map(
                    (line) => html`
                      <tr>
                        <td>${formatDate(line.date)}</td>
                        <td>${line.description}</td>
                        <td class="amount ${line.amount >= 0 ? "positive" : "negative"}">
                          ${line.amount >= 0 ? "+" : ""}${formatCurrency(line.amount)}
                        </td>
                        <td>
                          ${
                            line.invoiceId
                              ? html`
                                  <span class="status matched"><span class="icon">${icons.check}</span> Matched</span>
                                `
                              : line.amount > 0
                                ? html`
                                    <span class="status income">Income</span>
                                  `
                                : html`
                                    <span class="status unmatched"><span class="icon">${icons.clock}</span> Unmatched</span>
                                  `
                          }
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            </div>
          `
          : nothing
      }
    `;
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
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">Upload Bank Statement</h3>
            <button class="modal-close" @click=${() => this.resetUploadForm()}>×</button>
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
            <label class="form-label">Bank</label>
            <input class="form-input" placeholder="e.g. Swedbank" .value=${this.uploadBank}
              @input=${(e: InputEvent) => {
                this.uploadBank = (e.target as HTMLInputElement).value;
              }} />
          </div>
          <div class="form-group">
            <label class="form-label">CSV File</label>
            <p style="font-size: 12px; color: var(--muted); margin: 4px 0 8px;">Expected format: Date, Description, Amount (one header row)</p>
            <input type="file" accept=".csv,.xls,.xlsx" @change=${(e: Event) => this.handleCSVUpload(e)} />
          </div>
          <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
            <button class="btn btn-secondary" @click=${() => this.resetUploadForm()}>Cancel</button>
          </div>
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
          <span class="icon">${icons.arrowLeft}</span> Back
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
