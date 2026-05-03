import { useDialog } from "../../hooks/useDialog";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

const SIZE_CLASSES = {
  sm: "max-w-sm",
  md: "max-w-md",
} as const;

export function Dialog({ isOpen, onClose, size = "md", className, children }: DialogProps) {
  const dialogRef = useDialog(isOpen);

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-lg p-0 shadow-lg backdrop:bg-black/50",
        SIZE_CLASSES[size],
      )}
      onClose={onClose}
    >
      <div className={cn("rounded-lg bg-background p-6 shadow-lg", className)}>{children}</div>
    </dialog>
  );
}
