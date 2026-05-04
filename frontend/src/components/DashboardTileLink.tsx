import { Link } from "react-router";
import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardTileLinkProps {
  to: string;
  ariaLabel: string;
  /** Extra classes for the outer Link (e.g., column span overrides). */
  linkClassName?: string;
  /** Extra classes for the inner Card. */
  cardClassName?: string;
  children: ReactNode;
}

const LINK_BASE =
  "group block rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
const LINK_SPAN_DEFAULT = "col-span-1 sm:col-span-2 lg:col-span-3";
const CARD_HOVER =
  "cursor-pointer transition-all duration-200 group-hover:border-primary/50 group-hover:bg-accent/5 group-hover:shadow-md";

export function DashboardTileLink({
  to,
  ariaLabel,
  linkClassName,
  cardClassName,
  children,
}: DashboardTileLinkProps) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className={cn(LINK_BASE, linkClassName ?? LINK_SPAN_DEFAULT)}
    >
      <Card className={cn(CARD_HOVER, cardClassName)}>{children}</Card>
    </Link>
  );
}
