/**
 * Wireframe: Budgets Page
 *
 * Layout: Top banner nav + summary widgets + budget cards grid with progress bars +
 *         create-budget form panel.
 * Desktop: 2-column budget card grid.
 * Mobile: Budget cards stack to 1 column.
 *
 * Future components (Mantine): AppShell › Card › Progress › Badge ›
 *   TextInput › Select › NumberInput › Button › Modal
 */

const BUDGETS = [
  { name: "Groceries", limit: 500, spent: 360, category: "Groceries", period: "Monthly" },
  { name: "Transport", limit: 200, spent: 90, category: "Transport", period: "Monthly" },
  { name: "Entertainment", limit: 150, spent: 135, category: "Entertainment", period: "Monthly" },
  { name: "Household", limit: 200, spent: 68, category: "Household", period: "Monthly" },
  { name: "Health", limit: 120, spent: 55, category: "Health", period: "Monthly" },
  { name: "Shopping", limit: 300, spent: 420, category: "Shopping", period: "Monthly" },
];

function statusColor(pct: number) {
  if (pct > 100) return "#c62828";
  if (pct >= 85) return "#ef6c00";
  return "#2e7d32";
}

function statusLabel(pct: number) {
  if (pct > 100) return "Over budget";
  if (pct >= 85) return "Near limit";
  return "On track";
}

export function BudgetsWireframe() {
  const over = BUDGETS.filter((b) => b.spent > b.limit).length;
  const onTrack = BUDGETS.filter((b) => b.spent / b.limit < 0.85).length;

  return (
    <div className="wf-page">
      <nav className="wf-topnav">
        <span className="wf-topnav-logo">◈ SmartFinance</span>
        <div className="wf-topnav-links">
          {["Dashboard", "Transactions", "Reports", "Budgets"].map((l, i) => (
            <span key={l} className={`wf-topnav-link${i === 3 ? " active" : ""}`}>
              {l}
            </span>
          ))}
        </div>
        <span className="wf-topnav-profile">👤 User</span>
      </nav>

      <div className="wf-dashboard-layout">
        <main className="wf-main-content">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <p className="wf-section-title" style={{ margin: 0 }}>
              Budgets — March 2026
            </p>
            <div className="wf-btn wf-btn-sm">[ + New Budget ]</div>
          </div>

          {/* ── Summary row ── */}
          <div className="wf-widget-grid" style={{ marginBottom: 16 }}>
            <div className="wf-widget">
              <div className="wf-widget-title">Total Budgeted</div>
              <div className="wf-widget-value">CHF 1,470</div>
              <div className="wf-widget-sub">Across {BUDGETS.length} budgets</div>
            </div>
            <div className="wf-widget">
              <div className="wf-widget-title">Status</div>
              <div className="wf-widget-value" style={{ fontSize: 20 }}>
                <span style={{ color: "#2e7d32" }}>{onTrack} on track</span>
                {"  "}
                <span style={{ color: "#c62828" }}>{over} over</span>
              </div>
              <div className="wf-widget-sub">This period</div>
            </div>
          </div>

          {/* ── Budget cards grid ── */}
          <div className="wf-widget-grid">
            {BUDGETS.map(({ name, limit, spent, category, period }) => {
              const pct = Math.round((spent / limit) * 100);
              const color = statusColor(pct);
              return (
                <div key={name} className="wf-widget" style={{ minHeight: "auto" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      marginBottom: 8,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "bold", fontSize: 13 }}>{name}</div>
                      <div style={{ fontSize: 10, color: "#9e9e9e" }}>
                        {category} · {period}
                      </div>
                    </div>
                    <span
                      className="wf-category-pill"
                      style={{ background: color, color: "#fff", fontSize: 10 }}
                    >
                      {statusLabel(pct)}
                    </span>
                  </div>

                  <div className="wf-budget-meta">
                    <span>CHF {spent.toLocaleString()} spent</span>
                    <span>CHF {limit.toLocaleString()} limit</span>
                  </div>
                  <div className="wf-budget-track">
                    <div
                      className="wf-budget-fill"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: color,
                      }}
                    />
                  </div>
                  <div style={{ fontSize: 10, color, marginTop: 4, textAlign: "right" }}>
                    {pct}% used
                  </div>

                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <span className="wf-action-link" style={{ fontSize: 11 }}>
                      Edit
                    </span>
                    <span className="wf-action-link wf-action-delete" style={{ fontSize: 11 }}>
                      Delete
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Create / Edit budget form (collapsed panel) ── */}
          <div className="wf-panel" style={{ marginTop: 16 }}>
            <div className="wf-widget-title">[ + New Budget Form ]</div>
            <div className="wf-filter-bar">
              <div className="wf-filter-field">
                <label>Budget Name</label>
                <div className="wf-input">e.g. Groceries</div>
              </div>
              <div className="wf-filter-field">
                <label>Category</label>
                <div className="wf-input wf-select">Select category ▾</div>
              </div>
              <div className="wf-filter-field">
                <label>Limit (CHF)</label>
                <div className="wf-input">500</div>
              </div>
              <div className="wf-filter-field">
                <label>Period</label>
                <div className="wf-input wf-select">Monthly ▾</div>
              </div>
              <div className="wf-filter-actions">
                <div className="wf-btn wf-btn-sm">[ Save ]</div>
                <div className="wf-btn wf-btn-sm wf-btn-outline">[ Cancel ]</div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
