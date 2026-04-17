import { createBrowserRouter, Navigate } from "react-router";
import { WireframesLayout } from "./App";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { BudgetsPage } from "./pages/BudgetsPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { CategoriesPage } from "./pages/CategoriesPage";
import { SettingsUsers } from "./pages/SettingsUsers";
import { SettingsProfile } from "./pages/SettingsProfile";
import { SettingsLayout } from "./pages/SettingsLayout";
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
      {
        path: "/settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <Navigate to="/settings/profile" replace /> },
          {
            path: "profile",
            element: <SettingsProfile />,
          },
          {
            element: <AdminRoute />,
            children: [
              {
                path: "users",
                element: <SettingsUsers />,
              },
            ],
          },
        ],
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
