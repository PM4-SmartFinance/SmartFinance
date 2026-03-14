import { useState } from "react";
import LoginWireframe from "./wireframes/LoginWireframe";
import DashboardWireframe from "./wireframes/DashboardWireframe";
import TransactionsWireframe from "./wireframes/TransactionsWireframe";
import ReportsWireframe from "./wireframes/ReportsWireframe";
import BudgetsWireframe from "./wireframes/BudgetsWireframe";
import "./wireframes/wireframe.css";

type View = "login" | "dashboard" | "transactions" | "reports" | "budgets";

const VIEWS: { id: View; label: string }[] = [
  { id: "login", label: "Login" },
  { id: "dashboard", label: "Dashboard" },
  { id: "transactions", label: "Transactions" },
  { id: "reports", label: "Reports" },
  { id: "budgets", label: "Budgets" },
];

export default function App() {
  const [view, setView] = useState<View>("login");

  return (
    <>
      <div className="wf-app-nav">
        <span>⬡ SmartFinance — Wireframes</span>
        {VIEWS.map(({ id, label }) => (
          <button key={id} className={view === id ? "active" : ""} onClick={() => setView(id)}>
            {label}
          </button>
        ))}
      </div>
      {view === "login" && <LoginWireframe />}
      {view === "dashboard" && <DashboardWireframe />}
      {view === "transactions" && <TransactionsWireframe />}
      {view === "reports" && <ReportsWireframe />}
      {view === "budgets" && <BudgetsWireframe />}
    </>
  );
}
