import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("common.loading", "Loading...")}</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
