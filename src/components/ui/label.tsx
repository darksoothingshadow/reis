"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Label component - pure HTML label element
 * No Radix dependency
 */
type LabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

function Label({ className, ...props }: LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "label text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Label };
