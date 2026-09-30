/**
 * El interruptor: una vía cuadrada con el trazo del mundo y un mando de tinta
 * que la cruza; encendido, la vía se entinta y el mando pasa a papel. El estado
 * se lee por la posición y la inversión, no por un color.
 */
import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "../lib/utils"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn("switch-track peer shrink-0 outline-none", className)}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="switch-thumb pointer-events-none"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
