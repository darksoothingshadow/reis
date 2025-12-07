"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * HoverCard component - CSS-based hover reveal
 * No portals, works in Shadow DOM
 */

interface HoverCardProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  openDelay?: number;
  closeDelay?: number;
  children: React.ReactNode;
}

function HoverCard({ children }: HoverCardProps) {
  return (
    <div data-slot="hover-card" className="relative inline-block group">
      {children}
    </div>
  );
}

interface HoverCardTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function HoverCardTrigger({ className, children, ...props }: HoverCardTriggerProps) {
  return (
    <div
      data-slot="hover-card-trigger"
      className={cn("inline-block", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface HoverCardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

function HoverCardContent({
  className,
  children,
  align = "center",
  ...props
}: HoverCardContentProps) {
  return (
    <div
      data-slot="hover-card-content"
      className={cn(
        "absolute z-50 hidden group-hover:block",
        "mt-2 w-64 rounded-md border bg-base-100 p-4 shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
