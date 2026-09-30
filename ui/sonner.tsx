/**
 * Las notificaciones: un billete de papel con el trazo del mundo, sin sombra ni
 * radio (el estilo va en `styles/site.css`, `[data-sonner-toast]`). Sólo claro:
 * el mundo no tiene tema oscuro, así que aquí no hay tema que leer.
 */
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--paper)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--ink)",
          "--border-radius": "0",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
