"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * Accordion component using React state
 * API compatible with Radix Accordion
 */

interface AccordionContextValue {
  type: "single" | "multiple";
  value: string | string[];
  onValueChange: (value: string | string[]) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

interface AccordionItemContextValue {
  value: string;
  isOpen: boolean;
}

const AccordionItemContext = React.createContext<AccordionItemContextValue | null>(null);

interface AccordionProps extends React.HTMLAttributes<HTMLDivElement> {
  type?: "single" | "multiple";
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: any) => void;  // flexible to accept string or string[]
  collapsible?: boolean;
}

function Accordion({
  type = "single",
  value: controlledValue,
  defaultValue,
  onValueChange,
  className,
  children,
  ...props
}: AccordionProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | string[]>(
    defaultValue ?? (type === "multiple" ? [] : "")
  );

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const handleValueChange = isControlled
    ? (onValueChange ?? (() => { }))
    : (val: string | string[]) => {
      setUncontrolledValue(val);
      onValueChange?.(val);
    };

  return (
    <AccordionContext.Provider value={{ type, value, onValueChange: handleValueChange }}>
      <div data-slot="accordion" className={cn("divide-y", className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

interface AccordionItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

function AccordionItem({ value, className, children, ...props }: AccordionItemProps) {
  const context = React.useContext(AccordionContext);

  const isOpen = context?.type === "multiple"
    ? (context.value as string[]).includes(value)
    : context?.value === value;

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div
        data-slot="accordion-item"
        data-value={value}
        data-state={isOpen ? "open" : "closed"}
        className={cn("border-b last:border-b-0", className)}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

// AccordionHeader - wrapper for trigger (for Radix API compatibility)
function AccordionHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div data-slot="accordion-header" className={cn("flex", className)} {...props}>
      {children}
    </div>
  );
}

interface AccordionTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  showChevron?: boolean;
}

function AccordionTrigger({ className, children, showChevron = false, ...props }: AccordionTriggerProps) {
  const context = React.useContext(AccordionContext);
  const itemContext = React.useContext(AccordionItemContext);

  const handleClick = () => {
    if (!context || !itemContext) return;

    if (context.type === "multiple") {
      const currentValue = context.value as string[];
      const newValue = itemContext.isOpen
        ? currentValue.filter(v => v !== itemContext.value)
        : [...currentValue, itemContext.value];
      context.onValueChange(newValue);
    } else {
      context.onValueChange(itemContext.isOpen ? "" : itemContext.value);
    }
  };

  return (
    <button
      type="button"
      data-slot="accordion-trigger"
      data-state={itemContext?.isOpen ? "open" : "closed"}
      aria-expanded={itemContext?.isOpen}
      className={cn(
        "flex flex-1 w-full items-start justify-between gap-4 py-4 text-left text-sm font-medium transition-all [&[data-state=open]>svg]:rotate-180",
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
      {showChevron && (
        <ChevronDownIcon className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200" />
      )}
    </button>
  );
}

type AccordionContentProps = React.HTMLAttributes<HTMLDivElement>;

function AccordionContent({ className, children, ...props }: AccordionContentProps) {
  const itemContext = React.useContext(AccordionItemContext);

  if (!itemContext?.isOpen) return null;

  return (
    <div
      data-slot="accordion-content"
      data-state={itemContext.isOpen ? "open" : "closed"}
      className="overflow-hidden text-sm animate-in fade-in-0 slide-in-from-top-1"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </div>
  );
}

export { Accordion, AccordionItem, AccordionHeader, AccordionTrigger, AccordionContent };
