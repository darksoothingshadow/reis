"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * Select component using native HTML select with daisyUI styling
 * Restructured to collect SelectItems and render them properly
 */

interface SelectContextValue {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  items: Array<{ value: string; label: React.ReactNode; disabled?: boolean }>;
  registerItem: (value: string, label: React.ReactNode, disabled?: boolean) => void;
  unregisterItem: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextValue | null>(null);

interface SelectProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function Select({
  value: controlledValue,
  defaultValue = "",
  onValueChange,
  // onOpenChange,
  children,
  disabled = false,
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [items, setItems] = React.useState<Array<{ value: string; label: React.ReactNode; disabled?: boolean }>>([]);

  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;
  const handleValueChange = (val: string) => {
    if (!isControlled) {
      setUncontrolledValue(val);
    }
    onValueChange?.(val);
  };

  const registerItem = React.useCallback((itemValue: string, label: React.ReactNode, itemDisabled?: boolean) => {
    setItems(prev => {
      if (prev.some(item => item.value === itemValue)) return prev;
      return [...prev, { value: itemValue, label, disabled: itemDisabled }];
    });
  }, []);

  const unregisterItem = React.useCallback((itemValue: string) => {
    setItems(prev => prev.filter(item => item.value !== itemValue));
  }, []);

  return (
    <SelectContext.Provider value={{ value, onValueChange: handleValueChange, disabled, items, registerItem, unregisterItem }}>
      <div data-slot="select" className="relative inline-block w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
}

function SelectGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectValue({ placeholder }: { placeholder?: string }) {
  const context = React.useContext(SelectContext);
  const selectedItem = context?.items.find(item => item.value === context.value);

  return (
    <span className={cn("block truncate", !selectedItem && "text-base-content/50")}>
      {selectedItem ? selectedItem.label : placeholder}
    </span>
  );
}

interface SelectTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg";
}

function SelectTrigger({
  className,
  size,
  children,
  ...props
}: SelectTriggerProps) {
  const context = React.useContext(SelectContext);
  const selectRef = React.useRef<HTMLSelectElement>(null);

  const sizeClasses = {
    xs: "h-6 text-xs",
    sm: "h-8 text-sm",
    md: "h-10 text-sm",
    lg: "h-12 text-base",
  };

  const handleClick = () => {
    selectRef.current?.focus();
    selectRef.current?.click();
  };

  return (
    <div className="relative">
      {/* Visual trigger button */}
      <div
        data-slot="select-trigger"
        className={cn(
          "flex items-center justify-between gap-2 rounded-md border border-base-300 bg-base-100 px-3 py-2 cursor-pointer",
          "focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary",
          size && sizeClasses[size],
          context?.disabled && "opacity-50 cursor-not-allowed",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        {children}
        <ChevronDownIcon className="size-4 opacity-50 shrink-0" />
      </div>

      {/* Native select (invisible, handles interaction) */}
      <select
        ref={selectRef}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        value={context?.value || ""}
        onChange={(e) => context?.onValueChange(e.target.value)}
        disabled={context?.disabled}
      >
        <option value="" disabled></option>
        {context?.items.map((item) => (
          <option key={item.value} value={item.value} disabled={item.disabled}>
            {typeof item.label === 'string' ? item.label : item.value}
          </option>
        ))}
      </select>
    </div>
  );
}

// SelectContent - registers items but doesn't render dropdown (native select handles it)
function SelectContent({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function SelectLabel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="select-label"
      className={cn("px-2 py-1.5 text-sm font-medium", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface SelectItemProps {
  value: string;
  disabled?: boolean;
  textValue?: string;
  children: React.ReactNode;
  className?: string;
}

function SelectItem({
  value,
  disabled = false,
  textValue,
  children,
}: SelectItemProps) {
  const context = React.useContext(SelectContext);

  React.useEffect(() => {
    context?.registerItem(value, textValue || children, disabled);
    return () => context?.unregisterItem(value);
  }, [value, textValue, children, disabled, context]);

  // Don't render anything - the native select handles display
  return null;
}

// function SelectSeparator({ className }: { className?: string }) {
function SelectSeparator() {
  return null; // Not supported in native select
}

function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
