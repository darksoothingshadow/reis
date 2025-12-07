"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Tooltip component using daisyUI tooltip
 * No portals - works in Shadow DOM
 */

interface TooltipProviderProps {
  children: React.ReactNode;
  delayDuration?: number;
  skipDelayDuration?: number;
  disableHoverableContent?: boolean;
}

function TooltipProvider({ children }: TooltipProviderProps) {
  return <>{children}</>;
}

interface TooltipProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  delayDuration?: number;
  children: React.ReactNode;
}

function Tooltip({ children }: TooltipProps) {
  return <>{children}</>;
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function TooltipTrigger({ className, children, ...props }: TooltipTriggerProps) {
  // The tooltip trigger wraps the TooltipContent
  return (
    <div
      data-slot="tooltip-trigger"
      className={cn("inline-block", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  sideOffset?: number;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

function TooltipContent({
  className,
  children,
  side = "top",
  ...props
}: TooltipContentProps) {
  const positionClasses = {
    top: "tooltip-top",
    bottom: "tooltip-bottom",
    left: "tooltip-left",
    right: "tooltip-right",
  };

  // For daisyUI tooltip, parent needs tooltip class and data-tip
  // This is a simplified implementation
  return (
    <div
      data-slot="tooltip-content"
      className={cn(
        "tooltip",
        positionClasses[side],
        className
      )}
      data-tip={typeof children === 'string' ? children : undefined}
      {...props}
    >
      {typeof children !== 'string' && children}
    </div>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
