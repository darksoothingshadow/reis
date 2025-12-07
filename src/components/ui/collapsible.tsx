"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Collapsible component using daisyUI collapse
 * Uses native HTML details/summary for accessibility
 */

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null);

interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  className,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = isControlled
    ? (onOpenChange ?? (() => { }))
    : (val: boolean) => {
      setUncontrolledOpen(val);
      onOpenChange?.(val);
    };

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      <div
        data-slot="collapsible"
        data-state={open ? "open" : "closed"}
        className={cn("collapse", open && "collapse-open", className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
}

function CollapsibleTrigger({
  className,
  children,
  asChild,
  onClick,
  ...props
}: CollapsibleTriggerProps) {
  const context = React.useContext(CollapsibleContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e);
    context?.onOpenChange(!context.open);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
      "data-slot": "collapsible-trigger",
    });
  }

  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      className={cn("collapse-title", className)}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

type CollapsibleContentProps = React.HTMLAttributes<HTMLDivElement>;

function CollapsibleContent({ className, children, ...props }: CollapsibleContentProps) {
  const context = React.useContext(CollapsibleContext);

  if (!context?.open) return null;

  return (
    <div
      data-slot="collapsible-content"
      className={cn("collapse-content", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
