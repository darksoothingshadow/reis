"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * Sheet component using daisyUI drawer
 * Uses native HTML dialog + drawer for Shadow DOM compatibility
 */

interface SheetContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = React.createContext<SheetContextValue | null>(null);

interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function Sheet({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: SheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled
    ? (val: boolean) => onOpenChange?.(val)
    : (val: boolean) => {
      setUncontrolledOpen(val);
      onOpenChange?.(val);
    };

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      <div data-slot="sheet">{children}</div>
    </SheetContext.Provider>
  );
}

interface SheetTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function SheetTrigger({ className, children, asChild, onClick, ...props }: SheetTriggerProps) {
  const context = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context?.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      "data-slot": "sheet-trigger",
    });
  }

  return (
    <button
      type="button"
      data-slot="sheet-trigger"
      className={cn("btn", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function SheetClose({ className, children, asChild, onClick, ...props }: SheetCloseProps) {
  const context = React.useContext(SheetContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context?.setOpen(false);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      "data-slot": "sheet-close",
    });
  }

  return (
    <button
      type="button"
      data-slot="sheet-close"
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: "top" | "right" | "bottom" | "left";
}

function SheetContent({ className, children, side = "right", ...props }: SheetContentProps) {
  const context = React.useContext(SheetContext);
  const contentRef = React.useRef<HTMLDivElement>(null);

  // Handle escape key
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") context?.setOpen(false);
    };
    if (context?.open) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [context]);

  if (!context?.open) return null;

  const sideClasses = {
    right: "inset-y-0 right-0 h-full w-3/4 sm:max-w-sm border-l animate-in slide-in-from-right",
    left: "inset-y-0 left-0 h-full w-3/4 sm:max-w-sm border-r animate-in slide-in-from-left",
    top: "inset-x-0 top-0 h-auto border-b animate-in slide-in-from-top",
    bottom: "inset-x-0 bottom-0 h-auto border-t animate-in slide-in-from-bottom",
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0"
        onClick={() => context.setOpen(false)}
      />
      {/* Content */}
      <div
        ref={contentRef}
        data-slot="sheet-content"
        className={cn(
          "bg-base-100 fixed z-50 flex flex-col gap-4 shadow-lg",
          sideClasses[side],
          className
        )}
        {...props}
      >
        {children}
        <button
          type="button"
          className="absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100"
          onClick={() => context.setOpen(false)}
        >
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
    </>
  );
}

function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      data-slot="sheet-title"
      className={cn("text-foreground font-semibold", className)}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="sheet-description"
      className={cn("text-base-content/70 text-sm", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
