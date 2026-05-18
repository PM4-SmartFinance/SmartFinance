import { Menu } from "@base-ui/react/menu";
import { Sun, Moon, Monitor, LogOut, Check, Globe } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useLogout } from "../hooks/useLogout";
import { useAppStore, isTheme } from "../store/appStore";
import type { Theme } from "../store/appStore";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { useTranslation } from "react-i18next";

const THEME_OPTIONS: { value: Theme; translationKey: string; label: string; Icon: typeof Sun }[] = [
  { value: "light", translationKey: "components.userMenu.themes.light", label: "Light", Icon: Sun },
  { value: "dark", translationKey: "components.userMenu.themes.dark", label: "Dark", Icon: Moon },
  {
    value: "system",
    translationKey: "components.userMenu.themes.system",
    label: "System",
    Icon: Monitor,
  },
];

// Labels are the language's own native name and are intentionally not
// translated — a French speaker scanning the menu still recognises "Deutsch".
const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "it", label: "Italiano" },
  { value: "rm", label: "Rumantsch" },
];

export function UserMenu() {
  const { user } = useAuth();
  const { mutate: logout, isPending } = useLogout();
  const { t, i18n } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  if (!user) return null;

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <Menu.Root>
      <Menu.Trigger
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        aria-label={t("components.userMenu.ariaLabel", "User menu")}
      >
        <Avatar className="size-8 cursor-pointer hover:opacity-80 transition-opacity">
          <AvatarFallback className="text-xs font-medium">{initials}</AvatarFallback>
        </Avatar>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8}>
          <Menu.Popup className="z-50 min-w-48 rounded-lg border border-border bg-popover py-1 shadow-md text-sm text-popover-foreground origin-(--transform-origin) data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 transition-[opacity,transform]">
            <div className="px-3 py-2 text-xs text-muted-foreground truncate border-b border-border mb-1">
              {user.email}
            </div>

            <div className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
              {t("components.userMenu.theme", "Theme")}
            </div>

            <Menu.RadioGroup
              value={theme}
              onValueChange={(v) => {
                if (isTheme(v)) setTheme(v);
              }}
            >
              {THEME_OPTIONS.map(({ value, translationKey, label, Icon }) => (
                <Menu.RadioItem
                  key={value}
                  value={value}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-sm cursor-default outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <Icon className="size-3.5 shrink-0" />
                  {t(translationKey, label)}
                  <Menu.RadioItemIndicator className="ml-auto">
                    <Check className="size-3.5" />
                  </Menu.RadioItemIndicator>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>

            <Menu.Separator className="my-1 h-px bg-border mx-1" />

            <div className="px-3 pt-1 pb-0.5 text-xs font-medium text-muted-foreground">
              {t("components.userMenu.language", "Language")}
            </div>
            <Menu.RadioGroup
              value={i18n.resolvedLanguage || "en"}
              onValueChange={(v) => {
                i18n.changeLanguage(v).catch((err) => {
                  console.error(`[i18n] failed to switch language to "${v}":`, err);
                });
              }}
            >
              {LANGUAGE_OPTIONS.map(({ value, label }) => (
                <Menu.RadioItem
                  key={value}
                  value={value}
                  className="flex items-center gap-2 px-3 py-1.5 mx-1 rounded-sm cursor-default outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <Globe className="size-3.5 shrink-0" />
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
              {isPending
                ? t("components.userMenu.signingOut", "Signing out…")
                : t("components.userMenu.signOut", "Sign out")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
