import { Navigate, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";

export function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user || user.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
