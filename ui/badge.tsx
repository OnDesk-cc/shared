/**
 * El sello: un estado impreso en una caja con el trazo del mundo. Sólido para
 * lo que está en marcha, en contorno para lo que espera o es un hecho, en rojo
 * para lo que se paró. Las variantes de shadcn se traducen así:
 *
 *   default / outline / ghost / link   contorno
 *   secondary                          sólido (lo que está en marcha)
 *   destructive                        rojo de error
 *
 * Un color de estado (verde para «resuelto», ámbar para «pendiente») no existe
 * en el mundo: el estado es la palabra.
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"

const badgeVariants = cva("stamp [&>svg]:size-3 [&>svg]:pointer-events-none", {
  variants: {
    variant: {
      default: "",
      secondary: "stamp--solid",
      destructive: "stamp--alert",
      outline: "",
      ghost: "",
      link: "",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
