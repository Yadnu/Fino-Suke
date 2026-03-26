"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  children,
  className,
  title,
  description,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <DialogPrimitive.Content
        className={cn(
          "fixed right-0 top-0 h-full w-full max-w-md z-50",
          "bg-surface border-l border-border shadow-card-hover",
          "p-6 overflow-y-auto",
          "data-[state=open]:animate-slide-in-right",
          "focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            {title && (
              <DialogPrimitive.Title className="font-display text-lg font-bold text-foreground">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted mt-1">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="text-muted hover:text-foreground transition-colors ml-4">
            <X className="w-5 h-5" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
