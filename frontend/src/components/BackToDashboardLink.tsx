import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";

interface BackToDashboardLinkProps {
  className?: string;
}

const BASE_CLASS =
  "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground";

export function BackToDashboardLink({ className }: BackToDashboardLinkProps) {
  return (
    <Link to="/" className={className ? `${BASE_CLASS} ${className}` : BASE_CLASS}>
      <ArrowLeft className="size-4" />
      Back to Dashboard
    </Link>
  );
}
