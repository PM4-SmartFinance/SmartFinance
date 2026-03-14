/**
 * Wireframe: Reports Page
 *
 * Layout: Top banner nav + date range selector + 2-column chart grid + category table.
 * Mobile: Charts stack to 1 column.
 *
 * Future components (Mantine): AppShell › SegmentedControl › DateRangePicker ›
 *   Card › RingChart › BarChart › Table
 */

const CATEGORY_BREAKDOWN = [
  { category: "Groceries", amount: "CHF 360.00", pct: 19, color: "#546e7a" },
  { category: "Transport", amount: "CHF 240.00", pct: 13, color: "#607d8b" },
  { category: "Entertainment", amount: "CHF 135.00", pct: 7, color: "#78909c" },
  { category: "Household", amount: "CHF 290.00", pct: 15, color: "#90a4ae" },
  { category: "Health", amount: "CHF 110.00", pct: 6, color: "#b0bec5" },
  { category: "Shopping", amount: "CHF 420.00", pct: 22, color: "#455a64" },
  { category: "Food & Drink", amount: "CHF 180.00", pct: 9, color: "#37474f" },
  { category: "Other", amount: "CHF 140.00", pct: 8, color: "#cfd8dc" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const INCOME_BARS = [3200, 3200, 3350, 3200, 3200, 3200, 3400, 3200, 3200, 3200, 3350, 3200];
const EXPENSE_BARS = [1640, 1810, 1520, 1970, 1430, 1890, 1750, 1600, 1820, 1680, 1940, 1580];

export default function ReportsWireframe() {
  const maxVal = Math.max(...INCOME_BARS, ...EXPENSE_BARS);

  return (
    <div className="wf-page">
      <nav className="wf-topnav">
        <span className="wf-topnav-logo">◈ SmartFinance</span>
        <div className="wf-topnav-links">
          {["Dashboard", "Transactions", "Reports", "Budgets"].map((l, i) => (
            <span key={l} className={`wf-topnav-link${i === 2 ? " active" : ""}`}>
              {l}
            </span>
          ))}
        </div>
        <span className="wf-topnav-profile">👤 User</span>
      </nav>

      <div className="wf-dashboard-layout">
        <main className="wf-main-content">
          <p className="wf-section-title">Reports</p>

          {/* ── Period selector ── */}
          <div className="wf-panel" style={{ marginBottom: 16 }}>
            <div className="wf-filter-bar">
              <div className="wf-filter-field">
                <label>Period</label>
                <div className="wf-segmented">
                  {["This month", "Last 3 months", "Last 6 months", "This year", "Custom"].map(
                    (p, i) => (
                      <span key={p} className={`wf-seg-item${i === 3 ? " active" : ""}`}>
                        {p}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Chart row ── */}
          <div className="wf-widget-grid" style={{ marginBottom: 16 }}>
            {/* Income vs Expenses bar chart */}
            <div className="wf-panel" style={{ margin: 0 }}>
              <div className="wf-widget-title">Income vs Expenses — 2026</div>
              <div className="wf-chart-area" style={{ height: 180 }}>
                <div className="wf-chart-bars" style={{ height: 100, gap: 4 }}>
                  {MONTHS.map((m, i) => (
                    <div
                      key={m}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <div
                        className="wf-chart-bar"
                        style={{
                          height: Math.round(((INCOME_BARS[i] ?? 0) / maxVal) * 90),
                          background: "#546e7a",
                          width: 10,
                        }}
                      />
                      <div
                        className="wf-chart-bar"
                        style={{
                          height: Math.round(((EXPENSE_BARS[i] ?? 0) / maxVal) * 90),
                          background: "#c62828",
                          width: 10,
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="wf-chart-x-label">
                  {MONTHS.map((m) => (
                    <span key={m} style={{ marginRight: 5, fontSize: 8 }}>
                      {m}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: "#9e9e9e", display: "flex", gap: 16 }}>
                  <span>
                    <span style={{ color: "#546e7a" }}>■</span> Income
                  </span>
                  <span>
                    <span style={{ color: "#c62828" }}>■</span> Expenses
                  </span>
                </div>
              </div>
            </div>

            {/* Spending by category donut */}
            <div className="wf-panel" style={{ margin: 0 }}>
              <div className="wf-widget-title">Spending by Category</div>
              <div className="wf-chart-area" style={{ height: 180 }}>
                {/* Simulated donut via conic-gradient */}
                <div className="wf-donut" />
                <span style={{ fontSize: 11 }}>Donut / Ring chart — category split</span>
              </div>
            </div>
          </div>

          {/* ── Category breakdown table ── */}
          <div className="wf-panel">
            <div className="wf-widget-title">Category Breakdown</div>
            <table className="wf-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Total Spent</th>
                  <th>% of Expenses</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {CATEGORY_BREAKDOWN.map(({ category, amount, pct, color }) => (
                  <tr key={category}>
                    <td>
                      <span
                        className="wf-category-pill"
                        style={{ background: color, color: "#fff" }}
                      >
                        {category}
                      </span>
                    </td>
                    <td className="wf-amount-negative">{amount}</td>
                    <td>{pct}%</td>
                    <td>
                      <div
                        style={{ height: 8, background: "#eee", borderRadius: 4, width: "100%" }}
                      >
                        <div
                          style={{
                            height: "100%",
                            width: `${pct * 4}%`,
                            background: color,
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  );
}
