/**
 * Wireframe: Transactions Page
 *
 * Layout: Top banner nav + filter bar + full-width transactions table with pagination.
 * Mobile: Filters stack vertically; table scrolls horizontally.
 *
 * Future components (Mantine): AppShell › Select › TextInput › DatePickerInput ›
 *   Button › Table › Pagination › Badge
 */

const TRANSACTIONS = [
  {
    date: "09.03.2026",
    desc: "Migros",
    category: "Groceries",
    account: "Checking",
    amount: "-CHF 58.40",
    positive: false,
  },
  {
    date: "08.03.2026",
    desc: "SBB Halbtax",
    category: "Transport",
    account: "Checking",
    amount: "-CHF 24.00",
    positive: false,
  },
  {
    date: "07.03.2026",
    desc: "Salary — Acme AG",
    category: "Income",
    account: "Checking",
    amount: "+CHF 3,200.00",
    positive: true,
  },
  {
    date: "06.03.2026",
    desc: "Netflix",
    category: "Entertainment",
    account: "Savings",
    amount: "-CHF 12.90",
    positive: false,
  },
  {
    date: "05.03.2026",
    desc: "Coop Bau+Hobby",
    category: "Household",
    account: "Checking",
    amount: "-CHF 34.50",
    positive: false,
  },
  {
    date: "04.03.2026",
    desc: "ZHAW Mensa",
    category: "Food & Drink",
    account: "Checking",
    amount: "-CHF 9.20",
    positive: false,
  },
  {
    date: "03.03.2026",
    desc: "Amazon.de",
    category: "Shopping",
    account: "Credit Card",
    amount: "-CHF 42.00",
    positive: false,
  },
  {
    date: "02.03.2026",
    desc: "Gym Membership",
    category: "Health",
    account: "Checking",
    amount: "-CHF 55.00",
    positive: false,
  },
];

export default function TransactionsWireframe() {
  return (
    <div className="wf-page">
      <nav className="wf-topnav">
        <span className="wf-topnav-logo">◈ SmartFinance</span>
        <div className="wf-topnav-links">
          {["Dashboard", "Transactions", "Reports", "Budgets"].map((l, i) => (
            <span key={l} className={`wf-topnav-link${i === 1 ? " active" : ""}`}>
              {l}
            </span>
          ))}
        </div>
        <span className="wf-topnav-profile">👤 User</span>
      </nav>

      <div className="wf-dashboard-layout">
        <main className="wf-main-content">
          <p className="wf-section-title">Transactions</p>

          {/* ── Filter bar ── */}
          <div className="wf-panel" style={{ marginBottom: 16 }}>
            <div className="wf-widget-title">Filters</div>
            <div className="wf-filter-bar">
              <div className="wf-filter-field">
                <label>Search</label>
                <div className="wf-input">description or amount…</div>
              </div>
              <div className="wf-filter-field">
                <label>Category</label>
                <div className="wf-input wf-select">All categories ▾</div>
              </div>
              <div className="wf-filter-field">
                <label>Account</label>
                <div className="wf-input wf-select">All accounts ▾</div>
              </div>
              <div className="wf-filter-field">
                <label>Date from</label>
                <div className="wf-input">01.03.2026</div>
              </div>
              <div className="wf-filter-field">
                <label>Date to</label>
                <div className="wf-input">31.03.2026</div>
              </div>
              <div className="wf-filter-actions">
                <div className="wf-btn wf-btn-sm">[ Apply ]</div>
                <div className="wf-btn wf-btn-sm wf-btn-outline">[ Reset ]</div>
              </div>
            </div>
          </div>

          {/* ── Transactions table ── */}
          <div className="wf-panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 12,
              }}
            >
              <div className="wf-widget-title" style={{ marginBottom: 0 }}>
                Results <span className="wf-badge">8 transactions</span>
              </div>
              <div className="wf-btn wf-btn-sm">[ + Import CSV ]</div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="wf-table">
                <thead>
                  <tr>
                    <th>Date ↕</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Account</th>
                    <th>Amount ↕</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {TRANSACTIONS.map(({ date, desc, category, account, amount, positive }) => (
                    <tr key={`${date}-${desc}`}>
                      <td>{date}</td>
                      <td>{desc}</td>
                      <td>
                        <span className="wf-category-pill">{category}</span>
                      </td>
                      <td>{account}</td>
                      <td className={positive ? "wf-amount-positive" : "wf-amount-negative"}>
                        {amount}
                      </td>
                      <td>
                        <span className="wf-action-link">Edit</span>
                        {" · "}
                        <span className="wf-action-link wf-action-delete">Delete</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="wf-pagination">
              <span className="wf-page-btn">‹ Prev</span>
              <span className="wf-page-btn wf-page-btn-active">1</span>
              <span className="wf-page-btn">2</span>
              <span className="wf-page-btn">3</span>
              <span className="wf-page-btn">Next ›</span>
              <span className="wf-page-info">Showing 1–8 of 24</span>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
