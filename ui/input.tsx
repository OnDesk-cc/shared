/** El campo del mundo: el trazo de 3px sobre papel, la única tinta clara al enfocar. */
import * as React from "react"

import { cn } from "../lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "field min-w-0 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-bold",
        className
      )}
      {...props}
    />
  )
}

export { Input }
