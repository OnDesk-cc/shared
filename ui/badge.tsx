/**
 * El `Badge` de shadcn es la píldora de `Tag` (`components/tag.tsx`) desde el
 * 2026-10-06: la misma clase `.sk-tag`, sin borde, con la palabra en la voz del
 * cielo. Las variantes de shadcn se traducen a un tono:
 *
 *   default / secondary / outline / ghost / link   neutral
 *   destructive                                     danger
 *
 * `secondary` era una píldora de tinta sólida que tapaba el texto de al lado
 * (los filtros de tickets de Pulse); ahora es neutra como las demás. Para un
 * tono distinto, `tone` manda sobre la variante.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"
import type { TagTone } from "../components/tag"

const badgeVariants = cva("sk-tag", {
  variants: {
    variant: {
      default: "",
      secondary: "",
      destructive: "",
      outline: "",
      ghost: "",
      link: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

const VARIANT_TONE: Record<string, TagTone> = {
  default: "neutral",
  secondary: "neutral",
  destructive: "danger",
  outline: "neutral",
  ghost: "neutral",
  link: "neutral",
}

function Badge({
  className,
  variant = "default",
  tone,
  size = "sm",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean; tone?: TagTone; size?: "sm" | "md" }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      data-tone={tone ?? VARIANT_TONE[variant ?? "default"]}
      data-size={size}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
