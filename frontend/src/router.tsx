import { createBrowserRouter, Navigate } from "react-router";
import { WireframesLayout } from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import LoginWireframe from "./wireframes/LoginWireframe";
import DashboardWireframe from "./wireframes/DashboardWireframe";
import TransactionsWireframe from "./wireframes/TransactionsWireframe";
import ReportsWireframe from "./wireframes/ReportsWireframe";
import BudgetsWireframe from "./wireframes/BudgetsWireframe";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/",
        element: <DashboardPage />,
      },
      {
        path: "/budgets",
        element: <BudgetsPage />,
      },
      {
        path: "/transactions",
        element: <TransactionsPage />,
      },
      {
        path: "/categories",
        element: <CategoriesPage />,
      },
    ],
  },
  {
    path: "/wireframes",
    element: <WireframesLayout />,
    children: [
      { index: true, element: <Navigate to="/wireframes/login" replace /> },
      { path: "login", element: <LoginWireframe /> },
      { path: "dashboard", element: <DashboardWireframe /> },
      { path: "transactions", element: <TransactionsWireframe /> },
      { path: "reports", element: <ReportsWireframe /> },
      { path: "budgets", element: <BudgetsWireframe /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
