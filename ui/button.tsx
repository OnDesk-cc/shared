/**
 * El botón. Escribe el vocabulario del billete (`ticket`, ver `styles/site.css`)
 * y el bloque de productos de `styles/product.css` lo pinta en el mundo «Clear
 * Sky» desde el 2026-10-04: una píldora. La API de shadcn se conserva para que
 * las seis apps sigan compilando, y el CSS, que va sin capa, gana a cualquier
 * utilidad que una pantalla vieja ponga en `className`.
 *
 *   default      píldora azul marino (la acción primaria)
 *   outline      píldora blanca con filete (la secundaria)
 *   secondary    píldora de niebla
 *   ghost        sin forma hasta que se pasa por encima: los glifos de una barra
 *   destructive  píldora roja clara: lo irreversible
 *   link         un enlace subrayado en el acento
 *
 *   xs / sm      30px: barras de herramientas y filas
 *   default      34px
 *   lg / xl      40px
 *   icon-*       la píldora redonda para un glifo solo
 */
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "../lib/utils"

const buttonVariants = cva(
  "ticket group shrink-0 whitespace-nowrap [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // La acción primaria: una por formulario, página o barra.
        default: "ticket--solid ticket--stub",
        destructive: "ticket--danger",
        outline: "",
        secondary: "ticket--secondary",
        ghost: "ticket--ghost",
        link: "ticket--link",
      },
      size: {
        default: "ticket--sm",
        xs: "ticket--xs",
        sm: "ticket--xs",
        lg: "",
        xl: "",
        icon: "ticket--glyph",
        "icon-xs": "ticket--glyph ticket--xs",
        "icon-sm": "ticket--glyph",
        "icon-lg": "ticket--glyph ticket--lg",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
