import { useEffect, useRef } from "react";

/**
 * Hook to manage HTML dialog element open/close state.
 *
 * Handles calling showModal/close on the dialog element based on the isOpen prop.
 *
 * @param isOpen - Whether the dialog should be open
 * @returns A ref to attach to the dialog element
 */
export function useDialog(isOpen: boolean) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      if (isOpen && import.meta.env.DEV) {
        console.warn(
          "useDialog: dialogRef is not attached to a <dialog> element. Pass the returned ref to the <dialog> element.",
        );
      }
      return;
    }
    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  return dialogRef;
}
