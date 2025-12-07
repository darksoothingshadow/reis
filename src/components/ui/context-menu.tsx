"use client";

import * as React from "react";
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react";
import { cn } from "./utils";

/**
 * ContextMenu component using daisyUI menu
 * Note: Context menus are tricky in Shadow DOM - this is a simplified implementation
 */

interface ContextMenuContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  position: { x: number; y: number };
  setPosition: (pos: { x: number; y: number }) => void;
}

const ContextMenuContext = React.createContext<ContextMenuContextValue | null>(null);

interface ContextMenuProps {
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function ContextMenu({ onOpenChange, children }: ContextMenuProps) {
  const [open, setOpenState] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });

  const setOpen = (val: boolean) => {
    setOpenState(val);
    onOpenChange?.(val);
  };

  return (
    <ContextMenuContext.Provider value={{ open, setOpen, position, setPosition }}>
      <div data-slot="context-menu" className="relative inline-block">
        {children}
      </div>
    </ContextMenuContext.Provider>
  );
}

interface ContextMenuTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean;
}

function ContextMenuTrigger({ className, children, ...props }: ContextMenuTriggerProps) {
  const context = React.useContext(ContextMenuContext);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    context?.setPosition({ x: e.clientX, y: e.clientY });
    context?.setOpen(true);
  };

  return (
    <div
      data-slot="context-menu-trigger"
      className={className}
      onContextMenu={handleContextMenu}
      {...props}
    >
      {children}
    </div>
  );
}

function ContextMenuGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="context-menu-group" {...props}>{children}</div>;
}

function ContextMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function ContextMenuSub({ children }: { children: React.ReactNode }) {
  return <div data-slot="context-menu-sub" className="relative">{children}</div>;
}

function ContextMenuRadioGroup({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="context-menu-radio-group" role="group" {...props}>{children}</div>;
}

interface ContextMenuSubTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

function ContextMenuSubTrigger({ className, inset, children, ...props }: ContextMenuSubTriggerProps) {
  return (
    <div
      data-slot="context-menu-sub-trigger"
      className={cn(
        "flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm hover:bg-base-200",
        inset && "pl-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </div>
  );
}

function ContextMenuSubContent({ className, children, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      data-slot="context-menu-sub-content"
      className={cn("menu bg-base-100 rounded-box z-50 min-w-[8rem] shadow-lg", className)}
      {...props}
    >
      {children}
    </ul>
  );
}

type ContextMenuContentProps = React.HTMLAttributes<HTMLUListElement>;

function ContextMenuContent({ className, children, ...props }: ContextMenuContentProps) {
  const context = React.useContext(ContextMenuContext);

  React.useEffect(() => {
    const handleClickOutside = () => context?.setOpen(false);
    if (context?.open) {
      document.addEventListener("click", handleClickOutside);
      document.addEventListener("contextmenu", handleClickOutside);
    }
    return () => {
      document.removeEventListener("click", handleClickOutside);
      document.removeEventListener("contextmenu", handleClickOutside);
    };
  }, [context]);

  if (!context?.open) return null;

  return (
    <ul
      data-slot="context-menu-content"
      className={cn(
        "menu bg-base-100 rounded-box fixed z-50 min-w-[8rem] p-1 shadow-lg border",
        className
      )}
      style={{ left: context.position.x, top: context.position.y }}
      {...props}
    >
      {children}
    </ul>
  );
}

interface ContextMenuItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  inset?: boolean;
  variant?: "default" | "destructive";
}

function ContextMenuItem({ className, inset, variant = "default", children, ...props }: ContextMenuItemProps) {
  return (
    <li
      data-slot="context-menu-item"
      className={cn(
        variant === "destructive" && "text-error",
        className
      )}
      {...props}
    >
      <a className={cn(inset && "pl-8")}>{children}</a>
    </li>
  );
}

interface ContextMenuCheckboxItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
}

function ContextMenuCheckboxItem({ className, checked, children, ...props }: ContextMenuCheckboxItemProps) {
  return (
    <li data-slot="context-menu-checkbox-item" className={className} {...props}>
      <a className="flex items-center gap-2">
        <span className="w-4">{checked && <CheckIcon className="size-4" />}</span>
        {children}
      </a>
    </li>
  );
}

interface ContextMenuRadioItemProps extends React.LiHTMLAttributes<HTMLLIElement> {
  checked?: boolean;
}

function ContextMenuRadioItem({ className, checked, children, ...props }: ContextMenuRadioItemProps) {
  return (
    <li data-slot="context-menu-radio-item" className={className} {...props}>
      <a className="flex items-center gap-2">
        <span className="w-4">{checked && <CircleIcon className="size-2 fill-current" />}</span>
        {children}
      </a>
    </li>
  );
}

interface ContextMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

function ContextMenuLabel({ className, inset, ...props }: ContextMenuLabelProps) {
  return (
    <div
      data-slot="context-menu-label"
      className={cn("px-2 py-1.5 text-sm font-medium", inset && "pl-8", className)}
      {...props}
    />
  );
}

function ContextMenuSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="context-menu-separator" className={cn("divider my-1", className)} {...props} />;
}

function ContextMenuShortcut({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="context-menu-shortcut"
      className={cn("ml-auto text-xs text-base-content/50", className)}
      {...props}
    />
  );
}

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
