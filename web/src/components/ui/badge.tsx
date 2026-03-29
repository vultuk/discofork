import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-[0.18em] uppercase", {
  variants: {
    variant: {
      default: "bg-primary/12 text-primary",
      muted: "bg-foreground/6 text-muted-foreground",
      success: "bg-emerald-500/12 text-emerald-300",
      warning: "bg-amber-500/12 text-amber-300",
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
