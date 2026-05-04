import { cn } from "@/lib/utils";

interface SortableColumnHeaderProps<C extends string> {
  column: C;
  label: string;
  sortBy: C;
  sortOrder: "asc" | "desc";
  onSort: (column: C) => void;
  /** Cell alignment. "right" right-aligns the button (e.g., for amount columns). */
  align?: "left" | "right";
  /** Extra classes for the `<th>`. */
  className?: string;
}

export function SortableColumnHeader<C extends string>({
  column,
  label,
  sortBy,
  sortOrder,
  onSort,
  align = "left",
  className,
}: SortableColumnHeaderProps<C>) {
  const isActive = sortBy === column;
  return (
    <th
      scope="col"
      className={cn("px-6 py-3", align === "right" ? "text-right" : "text-left", className)}
    >
      <button
        onClick={() => onSort(column)}
        className={cn(
          "flex items-center gap-2 font-semibold text-foreground hover:text-foreground/80",
          align === "right" && "ml-auto justify-end",
        )}
      >
        {label}
        {isActive && <span aria-hidden="true">{sortOrder === "asc" ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}
