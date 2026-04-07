import { Separator } from "@base-ui/react/separator";

import { cn } from "@/lib/utils";

function SeparatorLine({ className, orientation = "horizontal", ...props }: Separator.Props) {
  return (
    <Separator
      data-slot="separator"
      orientation={orientation}
      className={cn(
        "shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-stretch",
        className,
      )}
      {...props}
    />
  );
}

export { SeparatorLine };
