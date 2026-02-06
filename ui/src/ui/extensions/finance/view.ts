/**
 * Finance View - Bookkeeping Dashboard
 * Manages invoices, bank statements, matching, and reports
 */

import { LitElement, html, css, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import type { GatewayBrowserClient } from "../../gateway.js";
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
  getSpendingByCategory,
  getSpendingByMonth,
  getSpendingByVendor,
  getInboxEmails,
  formatCurrency,
  formatDate,
  type FinanceData,
  type Invoice,
  type StatementLine,
  type Email,
  type CompanyFilter,
} from "./controller.js";

type TabType = "inbox" | "invoices" | "statements" | "matching" | "reports";

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
  @state() private dateRange = {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  };

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
      padding: 8px 16px;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--muted);
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s;
    }

    .company-btn:hover {
      border-color: var(--border-hover);
      color: var(--text);
    }

    .company-btn.active {
      background: var(--accent);
      border-color: var(--accent);
      color: white;
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
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .tab:hover {
      background: var(--surface);
      color: var(--text);
    }

    .tab.active {
      background: var(--surface);
      color: var(--accent);
    }

    .tab .badge {
      background: var(--danger);
      color: white;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }

    /* Cards */
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
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
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .status.matched {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .status.unmatched {
      background: rgba(234, 179, 8, 0.15);
      color: #eab308;
    }

    .status.income {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .status.expense {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    /* Buttons */
    .btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn-primary {
      background: var(--accent);
      color: white;
    }

    .btn-primary:hover {
      opacity: 0.9;
    }

    .btn-secondary {
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg);
    }

    .btn-success {
      background: #22c55e;
      color: white;
    }

    .btn-success:hover {
      background: #16a34a;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
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
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
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
      background: rgba(59, 130, 246, 0.1);
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
      align-items: center;
      justify-content: space-between;
      padding: 16px;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 8px;
      margin-bottom: 12px;
    }

    .suggestion-content {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }

    .suggestion-arrow {
      color: var(--accent);
      font-size: 18px;
    }

    .confidence-bar {
      width: 60px;
      height: 6px;
      background: var(--border);
      border-radius: 3px;
      overflow: hidden;
    }

    .confidence-fill {
      height: 100%;
      background: #22c55e;
      border-radius: 3px;
    }

    /* Reports */
    .report-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
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
      border-radius: 6px;
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
      color: #22c55e;
    }

    .amount.negative {
      color: #ef4444;
    }

    /* Select */
    select {
      padding: 6px 10px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
    }

    select:focus {
      outline: none;
      border-color: var(--accent);
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      padding: 14px 20px;
      background: #22c55e;
      color: white;
      border-radius: 8px;
      font-weight: 500;
      font-size: 14px;
      animation: slideIn 0.3s ease;
      z-index: 1000;
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
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
      min-width: 400px;
      max-width: 90vw;
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
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      color: var(--muted);
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      border-radius: 6px;
      font-size: 14px;
    }

    .form-input:focus {
      outline: none;
      border-color: var(--accent);
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
    } catch (e) {
      this.error = e instanceof Error ? e.message : "Failed to load data";
      console.error("Finance load error:", e);
    } finally {
      this.loading = false;
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
    this.showToast(`✓ Matched ${this.selectedInvoice.vendor}`);
    this.selectedInvoice = null;
    this.selectedLine = null;
    await this.saveData();
  }

  private async confirmSuggestion(invoiceId: string, lineId: string) {
    if (!this.data) return;
    this.data = matchInvoiceToLine(this.data, invoiceId, lineId);
    this.showToast("✓ Match confirmed");
    await this.saveData();
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
    `;
  }

  private renderHeader() {
    return html`
      <div class="header">
        <div class="title">
          <span>💰</span>
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
            🔵 Aexy
          </button>
          <button
            class="company-btn ${this.companyFilter === "carxo" ? "active" : ""}"
            @click=${() => this.setCompany("carxo")}
          >
            🟣 Carxo
          </button>
        </div>
      </div>
    `;
  }

  private renderTabs() {
    if (!this.data) return nothing;

    const unmatchedCount = getUnmatchedInvoices(this.data, this.companyFilter).length;
    const suggestions = suggestMatches(this.data, this.companyFilter).length;

    return html`
      <div class="tabs">
        <button class="tab ${this.activeTab === "inbox" ? "active" : ""}" @click=${() => this.setTab("inbox")}>
          📥 Inbox
          ${this.emails.length ? html`<span class="badge">${this.emails.length}</span>` : nothing}
        </button>
        <button class="tab ${this.activeTab === "invoices" ? "active" : ""}" @click=${() => this.setTab("invoices")}>
          📄 Invoices
        </button>
        <button class="tab ${this.activeTab === "statements" ? "active" : ""}" @click=${() => this.setTab("statements")}>
          🏦 Statements
        </button>
        <button class="tab ${this.activeTab === "matching" ? "active" : ""}" @click=${() => this.setTab("matching")}>
          🔗 Matching
          ${unmatchedCount > 0 || suggestions > 0 ? html`<span class="badge">${unmatchedCount}</span>` : nothing}
        </button>
        <button class="tab ${this.activeTab === "reports" ? "active" : ""}" @click=${() => this.setTab("reports")}>
          📊 Reports
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
    }
  }

  private renderInboxTab() {
    return html`
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📥 Email Inbox</h3>
          <button class="btn btn-secondary btn-sm" @click=${this.loadData}>🔄 Refresh</button>
        </div>
        ${
          this.emails.length === 0
            ? html`
                <div class="empty-state">
                  <div class="empty-state-icon">📭</div>
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
                                  <span class="status matched">📎 Yes</span>
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
        ⚠️ Gmail API integration pending. Showing mock data.
      </p>
    `;
  }

  private renderInvoicesTab() {
    if (!this.data) return nothing;
    const invoices = getInvoices(this.data, this.companyFilter);

    return html`
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">📄 All Invoices (${invoices.length})</h3>
          <button class="btn btn-primary btn-sm">⬆️ Upload</button>
        </div>
        ${
          invoices.length === 0
            ? html`
                <div class="empty-state">
                  <div class="empty-state-icon">📄</div>
                  <p>No invoices yet</p>
                </div>
              `
            : html`
              <table>
                <thead>
                  <tr>
                    <th>Vendor</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Company</th>
                  </tr>
                </thead>
                <tbody>
                  ${invoices.map(
                    (inv) => html`
                      <tr>
                        <td>
                          <strong>${inv.vendor}</strong>
                          <div style="font-size: 11px; color: var(--muted);">${inv.file.split("/").pop()}</div>
                        </td>
                        <td class="amount">${formatCurrency(inv.amount, inv.currency)}</td>
                        <td>${formatDate(inv.date)}</td>
                        <td>
                          <span class="category-${inv.category || "other"}">${inv.category || "—"}</span>
                        </td>
                        <td>
                          ${
                            inv.statementLineId
                              ? html`
                                  <span class="status matched">✓ Matched</span>
                                `
                              : html`
                                  <span class="status unmatched">⏳ Unmatched</span>
                                `
                          }
                        </td>
                        <td style="font-size: 12px;">
                          ${inv.company === "aexy" ? "🔵" : "🟣"} ${inv.company}
                        </td>
                      </tr>
                    `,
                  )}
                </tbody>
              </table>
            `
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
          <h3 class="card-title">🏦 Bank Statements (${statements.length})</h3>
          <button class="btn btn-primary btn-sm">⬆️ Upload CSV</button>
        </div>
        ${
          statements.length === 0
            ? html`
                <div class="empty-state">
                  <div class="empty-state-icon">🏦</div>
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
                        <td>${stmt.company === "aexy" ? "🔵" : "🟣"} ${stmt.company}</td>
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
              <h3 class="card-title" style="margin-bottom: 16px;">📋 Transactions (${lines.length})</h3>
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
                                  <span class="status matched">✓ Matched</span>
                                `
                              : line.amount > 0
                                ? html`
                                    <span class="status income">💰 Income</span>
                                  `
                                : html`
                                    <span class="status unmatched">⏳ Unmatched</span>
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
    const suggestions = suggestMatches(this.data, this.companyFilter);

    return html`
      ${
        suggestions.length > 0
          ? html`
            <div class="card suggestions">
              <h3 class="card-title" style="margin-bottom: 16px;">💡 Suggested Matches (${suggestions.length})</h3>
              ${suggestions.map(
                ({ invoice, line, confidence }) => html`
                  <div class="suggestion-item">
                    <div class="suggestion-content">
                      <div>
                        <strong>${invoice.vendor}</strong>
                        <div class="amount">${formatCurrency(invoice.amount)}</div>
                        <div style="font-size: 11px; color: var(--muted);">${formatDate(invoice.date)}</div>
                      </div>
                      <div class="suggestion-arrow">→</div>
                      <div>
                        <strong>${line.description}</strong>
                        <div class="amount negative">${formatCurrency(line.amount)}</div>
                        <div style="font-size: 11px; color: var(--muted);">${formatDate(line.date)}</div>
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 16px;">
                      <div style="text-align: center;">
                        <div class="confidence-bar">
                          <div class="confidence-fill" style="width: ${confidence * 100}%"></div>
                        </div>
                        <div style="font-size: 10px; color: var(--muted); margin-top: 4px;">
                          ${Math.round(confidence * 100)}%
                        </div>
                      </div>
                      <button class="btn btn-success btn-sm" @click=${() => this.confirmSuggestion(invoice.id, line.id)}>
                        ✓ Confirm
                      </button>
                    </div>
                  </div>
                `,
              )}
            </div>
          `
          : nothing
      }

      <div class="matching-container">
        <div class="match-list">
          <div class="match-list-header">📄 Unmatched Invoices (${unmatchedInvoices.length})</div>
          ${
            unmatchedInvoices.length === 0
              ? html`
                  <div class="empty-state" style="padding: 30px">
                    <div class="empty-state-icon">✅</div>
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
                      ${formatDate(inv.date)} • ${inv.company === "aexy" ? "🔵" : "🟣"} ${inv.company}
                    </div>
                  </div>
                `,
                )
          }
        </div>

        <div class="match-list">
          <div class="match-list-header">🏦 Unmatched Lines (${unmatchedLines.length})</div>
          ${
            unmatchedLines.length === 0
              ? html`
                  <div class="empty-state" style="padding: 30px">
                    <div class="empty-state-icon">✅</div>
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
                <button class="btn btn-success" @click=${this.tryMatch}>✓ Confirm Match</button>
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
        <button class="btn btn-primary" @click=${() => (this.showExportModal = true)}>📤 Export</button>
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
              <h3 class="card-title" style="margin-bottom: 16px;">📊 Spending by Month</h3>
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
          <h3 class="card-title" style="margin-bottom: 16px;">📈 By Category</h3>
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
          <h3 class="card-title" style="margin-bottom: 16px;">🏢 Top Vendors</h3>
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

  private renderExportModal() {
    return html`
      <div class="modal-backdrop" @click=${() => (this.showExportModal = false)}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h3 class="modal-title">📤 Export to Accountant</h3>
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
            <button class="btn btn-primary" @click=${this.handleExport}>📤 Download ZIP</button>
          </div>
        </div>
      </div>
    `;
  }

  private handleExport() {
    this.showToast("📦 Export prepared!");
    this.showExportModal = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "finance-view": FinanceView;
  }
}
