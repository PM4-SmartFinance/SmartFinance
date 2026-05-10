import { type ComponentProps } from "react";
import { cn } from "@/lib/utils";

const baseClasses =
  "w-full rounded border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(baseClasses, className)} {...props} />;
}
