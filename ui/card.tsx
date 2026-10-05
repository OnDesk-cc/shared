/**
 * La tarjeta del mundo «Clear Sky» (2026-10-04): blanca, radio de 18px, la
 * elevación en sombra y nunca en borde. El relleno se reparte como en shadcn
 * (la tarjeta lleva el vertical, cada parte el horizontal), porque así están
 * escritas las pantallas de las seis apps: `Card className="py-0 gap-0"` con un
 * `CardContent className="p-0"` deja una tabla a ras de la tarjeta, y
 * `CardContent className="p-4"` le da su propio relleno.
 */
import * as React from "react"

import { cn } from "../lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "flex min-w-0 flex-col gap-5 overflow-hidden rounded-[18px] bg-white py-5 text-(--sk-ink) shadow-(--sk-shadow-1)",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto]",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("text-[1rem] font-medium leading-snug tracking-[-0.015em] text-(--sk-ink)", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("max-w-[72ch] text-[0.875rem] leading-relaxed text-(--sk-ink-3)", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("min-w-0 px-5", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center gap-3 border-t border-(--sk-hair) px-5 pt-4", className)}
      {...props}
    />
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
}
