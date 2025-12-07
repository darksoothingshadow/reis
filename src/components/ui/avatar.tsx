"use client";

import * as React from "react";
import { cn } from "./utils";

/**
 * Avatar component using daisyUI avatar classes
 */
interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg";
}

function Avatar({ className, size, children, ...props }: AvatarProps) {
  const sizeClasses = {
    xs: "w-6",
    sm: "w-8",
    md: "w-10",
    lg: "w-16",
  };

  return (
    <div
      data-slot="avatar"
      className={cn("avatar", className)}
      {...props}
    >
      <div className={cn(
        "rounded-full overflow-hidden",
        size && sizeClasses[size],
        !size && "w-10"
      )}>
        {children}
      </div>
    </div>
  );
}

type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

function AvatarImage({ className, alt = "", ...props }: AvatarImageProps) {
  const [hasError, setHasError] = React.useState(false);

  if (hasError) return null;

  return (
    <img
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      alt={alt}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  delayMs?: number;
}

function AvatarFallback({ className, children, ...props }: AvatarFallbackProps) {
  return (
    <div
      data-slot="avatar-fallback"
      className={cn(
        "bg-base-200 flex size-full items-center justify-center rounded-full text-sm font-medium",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { Avatar, AvatarImage, AvatarFallback };
