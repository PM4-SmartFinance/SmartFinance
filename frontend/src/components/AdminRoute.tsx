import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { useTranslation } from "react-i18next";

export function AdminRoute() {
  const { user, isLoading } = useAuth();
  const { t } = useTranslation();

  if (isLoading) {
    return <div>{t("common.loading", "Loading...")}</div>;
  }

  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
