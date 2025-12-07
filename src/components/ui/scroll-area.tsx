"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * ScrollArea component - simple CSS overflow-based scroll area
 * No Radix dependency
 */
interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal" | "both";
}

function ScrollArea({
  className,
  children,
  orientation = "vertical",
  ...props
}: ScrollAreaProps) {
  return (
    <div
      data-slot="scroll-area"
      className={cn(
        "relative",
        orientation === "vertical" && "overflow-y-auto overflow-x-hidden",
        orientation === "horizontal" && "overflow-x-auto overflow-y-hidden",
        orientation === "both" && "overflow-auto",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ScrollBar(_ignore: ScrollBarProps) {
  // This is a placeholder for API compatibility
  // Modern browsers handle scrollbar styling via CSS
  return null;
}

export { ScrollArea, ScrollBar };
