import { NavLink, Outlet, Link } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { User, Users, ArrowLeft } from "lucide-react";

export function SettingsLayout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and platform settings.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Link>
        </header>

        <div className="flex flex-col gap-6 md:flex-row md:gap-8">
          <aside className="w-full md:w-64 md:shrink-0">
            <nav className="flex flex-row overflow-x-auto md:flex-col gap-2 pb-2 md:pb-0">
              <NavLink
                to="/settings/profile"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground ${
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  }`
                }
              >
                <User className="size-4" />
                Profile
              </NavLink>

              {user?.role === "ADMIN" && (
                <NavLink
                  to="/settings/users"
                  className={({ isActive }) =>
                    `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground ${
                      isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                    }`
                  }
                >
                  <Users className="size-4" />
                  User Management
                </NavLink>
              )}
            </nav>
          </aside>

          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
