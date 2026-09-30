/** El campo de varias líneas, con el trazo del mundo; lo mide su `rows`. */
import * as React from "react"

import { cn } from "../lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn("field field-sizing-content min-h-16", className)}
      {...props}
    />
  )
}

export { Textarea }
