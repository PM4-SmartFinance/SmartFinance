/**
 * Wireframe: Main Dashboard
 *
 * Desktop: Top banner nav + main content grid.
 * Tablet (641–1024px): 2-column widget grid.
 * Mobile (≤640px): Top banner wraps; widgets stack in 1-column cards.
 *
 * Widget placement:
 *   Row 1 — Balance summary  |  Expense overview   (2-col grid)
 *   Row 2 — Monthly spending chart                 (full width)
 *   Row 3 — Recent transactions table              (full width)
 *   Row 4 — Budget progress bars                   (full width)
 *
 * Future React components (Mantine):
 *   AppShell › Navbar › NavLink › Grid › Card › Text › Table › Progress › Badge
 */

const CHART_BARS = [40, 65, 45, 80, 55, 70, 50, 60, 75, 48, 85, 62];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const TRANSACTIONS = [
  {
    date: "01.03.2026",
    desc: "Migros",
    category: "Groceries",
    amount: "-CHF 58.40",
    positive: false,
  },
  {
    date: "28.02.2026",
    desc: "SBB Halbtax",
    category: "Transport",
    amount: "-CHF 24.00",
    positive: false,
  },
  {
    date: "27.02.2026",
    desc: "Salary — Acme AG",
    category: "Income",
    amount: "+CHF 3,200.00",
    positive: true,
  },
  {
    date: "26.02.2026",
    desc: "Netflix",
    category: "Entertainment",
    amount: "-CHF 12.90",
    positive: false,
  },
  {
    date: "25.02.2026",
    desc: "Coop Bau+Hobby",
    category: "Household",
    amount: "-CHF 34.50",
    positive: false,
  },
];

const BUDGETS = [
  { label: "Groceries", used: 72, current: "CHF 360", budget: "CHF 500" },
  { label: "Transport", used: 45, current: "CHF 90", budget: "CHF 200" },
  { label: "Entertainment", used: 90, current: "CHF 135", budget: "CHF 150" },
  { label: "Household", used: 34, current: "CHF 68", budget: "CHF 200" },
];

const NAV_LINKS = ["Dashboard", "Transactions", "Reports", "Budgets"];

export default function DashboardWireframe() {
  return (
    <div className="wf-page">
      {/* ── Primary top nav ── */}
      <nav className="wf-topnav">
        <span className="wf-topnav-logo">◈ SmartFinance</span>
        <div className="wf-topnav-links">
          {NAV_LINKS.map((link, i) => (
            <span key={link} className={`wf-topnav-link${i === 0 ? " active" : ""}`}>
              {link}
            </span>
          ))}
        </div>
        <span className="wf-topnav-profile">👤 User</span>
      </nav>

      <div className="wf-dashboard-layout">
        <main className="wf-main-content">
          <p className="wf-section-title">
            Dashboard
            <span className="wf-badge">Desktop: 2-col grid</span>
            <span className="wf-badge">Mobile: 1-col stack</span>
          </p>

          {/* ── Row 1: Summary widgets (2-column grid) ── */}
          <div className="wf-widget-grid">
            <div className="wf-widget">
              <div className="wf-widget-title">Account Balance</div>
              <div className="wf-widget-value">CHF 4,230</div>
              <div className="wf-widget-sub">Across all accounts</div>
            </div>
            <div className="wf-widget">
              <div className="wf-widget-title">Monthly Expenses</div>
              <div className="wf-widget-value">CHF 1,875</div>
              <div className="wf-widget-sub">↑ 12 % vs last month</div>
            </div>
          </div>

          {/* ── Row 2: Monthly spending chart (full width) ── */}
          <div className="wf-panel">
            <div className="wf-widget-title">Monthly Spending Chart</div>
            <div className="wf-chart-area">
              <div className="wf-chart-bars">
                {CHART_BARS.map((h, i) => (
                  <div key={`chart-bar-${i}`} className="wf-chart-bar" style={{ height: h }} />
                ))}
              </div>
              <div className="wf-chart-x-label">
                {MONTHS.map((m) => (
                  <span key={m} style={{ marginRight: 9, fontSize: 9 }}>
                    {m}
                  </span>
                ))}
              </div>
              <span>Bar chart — monthly expenses over 12 months</span>
            </div>
          </div>

          {/* ── Row 3: Recent transactions table (full width) ── */}
          <div className="wf-panel">
            <div className="wf-widget-title">Recent Transactions</div>
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {TRANSACTIONS.map(({ date, desc, category, amount, positive }) => (
                  <tr key={`${date}-${desc}`}>
                    <td>{date}</td>
                    <td>{desc}</td>
                    <td>{category}</td>
                    <td className={positive ? "wf-amount-positive" : "wf-amount-negative"}>
                      {amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Row 4: Budget progress (full width) ── */}
          <div className="wf-panel">
            <div className="wf-widget-title">Budget Progress</div>
            {BUDGETS.map(({ label, used, current, budget }) => (
              <div key={label} className="wf-budget-row">
                <div className="wf-budget-meta">
                  <span>{label}</span>
                  <span>
                    {current} / {budget}
                  </span>
                </div>
                <div className="wf-budget-track">
                  <div
                    className="wf-budget-fill"
                    style={{
                      width: `${used}%`,
                      background: used >= 85 ? "#c62828" : used >= 70 ? "#ef6c00" : "#546e7a",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
