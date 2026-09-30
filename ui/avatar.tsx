/**
 * La cara de alguien es su monograma: su foto, o sus iniciales en el corte
 * condensado, dentro de un cuadrado con el trazo del mundo. Cuadrado siempre;
 * lo único redondo del mapa es el anillo del intercambiador.
 */
import * as React from "react"
import { Avatar as AvatarPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Avatar({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root> & {
  size?: "default" | "sm" | "lg"
}) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      data-size={size}
      className={cn(
        "monogram group/avatar relative flex size-8 shrink-0 select-none data-[size=lg]:size-10 data-[size=sm]:size-6",
        className
      )}
      {...props}
    />
  )
}

function AvatarImage({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      {...props}
    />
  )
}

function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        "flex size-full items-center justify-center text-[0.8rem] uppercase group-data-[size=sm]/avatar:text-[0.65rem] group-data-[size=lg]/avatar:text-[0.95rem]",
        className
      )}
      {...props}
    />
  )
}

/** Una marca en la esquina del monograma: un cuadrado de tinta con el borde de papel. */
function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn(
        "absolute -right-1 -bottom-1 z-10 inline-flex items-center justify-center border-2 border-(--paper) bg-(--ink) text-(--paper) select-none",
        "group-data-[size=sm]/avatar:size-2.5 group-data-[size=sm]/avatar:[&>svg]:hidden",
        "group-data-[size=default]/avatar:size-3 group-data-[size=default]/avatar:[&>svg]:size-2",
        "group-data-[size=lg]/avatar:size-3.5 group-data-[size=lg]/avatar:[&>svg]:size-2",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group"
      className={cn(
        "group/avatar-group flex -space-x-1.5 *:data-[slot=avatar]:outline-2 *:data-[slot=avatar]:outline-(--paper)",
        className
      )}
      {...props}
    />
  )
}

function AvatarGroupCount({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="avatar-group-count"
      className={cn(
        "monogram t-cond relative flex size-8 shrink-0 items-center justify-center text-[0.8rem] font-bold outline-2 outline-(--paper) group-has-data-[size=lg]/avatar-group:size-10 group-has-data-[size=sm]/avatar-group:size-6 [&>svg]:size-4",
        className
      )}
      {...props}
    />
  )
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
  AvatarBadge,
  AvatarGroup,
  AvatarGroupCount,
}
