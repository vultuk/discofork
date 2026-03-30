import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center rounded-sm px-2 py-1 text-[10px] font-medium tracking-[0.16em] uppercase", {
  variants: {
    variant: {
      default: "border border-border bg-card text-card-foreground",
      muted: "border border-border bg-muted text-muted-foreground",
      success: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      warning: "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
