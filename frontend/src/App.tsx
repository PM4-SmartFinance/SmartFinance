import { NavLink, Outlet } from "react-router";
import "./wireframes/wireframe.css";

const VIEWS = [
  { path: "/wireframes/login", label: "Login" },
  { path: "/wireframes/dashboard", label: "Dashboard" },
  { path: "/wireframes/transactions", label: "Transactions" },
  { path: "/wireframes/reports", label: "Reports" },
  { path: "/wireframes/budgets", label: "Budgets" },
];

export function WireframesLayout() {
  return (
    <>
      <div className="wf-app-nav">
        <span>⬡ SmartFinance — Wireframes</span>
        {VIEWS.map(({ path, label }) => (
          <NavLink key={path} to={path} className={({ isActive }) => (isActive ? "active" : "")}>
            {label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </>
  );
}
