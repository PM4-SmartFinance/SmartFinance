import { useEffect } from "react";
import { Menu } from "@base-ui/react/menu";
import { Sun, Moon, Monitor, LogOut, Check } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLogout } from "../hooks/useLogout";
import { useAppStore } from "../store/appStore";
import type { Theme } from "../store/appStore";
import { Avatar, AvatarFallback } from "./ui/avatar";

const THEME_OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
];

export function UserMenu() {
  const { user } = useAuth();
  const { mutate: logout, isPending } = useLogout();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.classList.toggle("dark", e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";

  return (
    <Menu.Root>
      <Menu.Trigger
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label="User menu"
      >
        <Avatar className="size-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <Menu.Popup className="z-50 min-w-48 rounded-lg border border-border bg-popover py-1 shadow-md text-sm text-popover-foreground origin-(--transform-origin) data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-[opacity,transform]">
            {user?.email && (
              <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border mb-1">
                {user.email}
              </div>
            )}

            <div className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">Theme</div>

            <Menu.RadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
              {THEME_OPTIONS.map(({ value, label, Icon }) => (
                <Menu.RadioItem
                  key={value}
                  value={value}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-sm cursor-default outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                  <Menu.RadioItemIndicator className="ml-auto">
                    <Check className="size-3.5" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>

            <Menu.Separator className="my-1 h-px bg-border mx-1" />

            <Menu.Item
              className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-sm cursor-default outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={isPending}
              onClick={() => logout()}
            >
              <LogOut className="size-3.5 shrink-0" />
              {isPending ? "Signing out…" : "Sign out"}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
