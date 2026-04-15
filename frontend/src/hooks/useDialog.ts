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
    if (isOpen) {
      dialogRef.current?.showModal();
    } else {
      dialogRef.current?.close();
    }
  }, [isOpen]);

  return dialogRef;
}
