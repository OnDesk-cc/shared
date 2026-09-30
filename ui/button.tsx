/**
 * El billete: la única forma de botón del mundo del mapa (ver
 * `styles/site.css`, «billetes y botones»). La API de shadcn se conserva para
 * que las seis apps sigan compilando; cada variante y cada tamaño se traducen a
 * las clases del billete, y el CSS del mundo, que va sin capa, gana a cualquier
 * utilidad que una pantalla vieja ponga en `className`.
 *
 *   default      billete macizo con talón (la acción primaria)
 *   outline      billete de contorno (la secundaria)
 *   secondary    billete de contorno sobre la única tinta clara
 *   ghost        billete de contorno (el mundo no tiene botones sin forma)
 *   destructive  billete con el trazo en rojo de error: lo irreversible
 *   link         un enlace subrayado, sin forma de billete
 *
 *   xs / sm      2.25rem: barras de herramientas y filas
 *   default      2.5rem: el billete pequeño del mundo
 *   lg / xl      3.25rem: el billete entero
 *   icon-*       el billete cuadrado para un glifo solo
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
        // La acción primaria es el billete macizo con su talón, como en el resto
        // del mundo: un formulario, una página o el riel tienen una y se reconoce
        // por la perforación.
        default: "ticket--solid ticket--stub",
        destructive: "ticket--danger",
        outline: "",
        secondary: "bg-(--paper-2)",
        // Un glifo solo va en un billete cuadrado con su trazo, en todas las
        // apps igual: el mundo no tiene botones sin forma.
        ghost: "",
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
