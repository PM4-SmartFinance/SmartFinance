import { NavLink, Outlet } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { BackToDashboardLink } from "../components/BackToDashboardLink";
import { UserMenu } from "../components/UserMenu";
import { User, Users, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

export function SettingsLayout() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const navLinkClasses = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground ${
      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
    }`;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              {t("settings.heading", "Settings")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("settings.description", "Manage your account and platform settings.")}
            </p>
            <BackToDashboardLink className="mt-4" />
          </div>
          <UserMenu />
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <aside className="w-full md:w-64 md:shrink-0">
            <nav className="flex flex-row overflow-x-auto md:flex-col gap-2 pb-2 md:pb-0">
              <NavLink to="/settings/profile" className={navLinkClasses}>
                <User className="size-4" />
                {t("settings.nav.profile", "Profile")}
              </NavLink>

              <NavLink to="/settings/accounts" className={navLinkClasses}>
                <Wallet className="size-4" />
                {t("settings.nav.accounts", "Accounts")}
              </NavLink>

              {user?.role === "ADMIN" && (
                <NavLink to="/settings/users" className={navLinkClasses}>
                  <Users className="size-4" />
                  {t("settings.nav.userManagement", "User Management")}
                </NavLink>
              )}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </main>
  );
}
