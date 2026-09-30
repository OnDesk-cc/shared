/* eslint-disable react-refresh/only-export-components */
/**
 * El mundo del mapa se lee a la luz del día: no hay tema oscuro en el sitio, en
 * la puerta, en las consolas ni en los seis productos (decidido el 2026-09-29).
 *
 * Este proveedor sobrevive sólo para que una app que aún lo monte siga
 * compilando. No lee `localStorage`, no escucha al sistema y borra la clase
 * `dark` que un navegador pudiera conservar de antes; `useTheme` devuelve
 * siempre «light» y un `setTheme` que no hace nada.
 */
import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
  disableTransitionOnChange?: boolean
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const LIGHT: ThemeProviderState = { theme: "light", setTheme: () => {} }

const ThemeProviderContext = React.createContext<ThemeProviderState>(LIGHT)

export function ThemeProvider({ children }: ThemeProviderProps) {
  React.useEffect(() => {
    const root = document.documentElement
    root.classList.remove("dark")
    root.classList.add("light")
  }, [])

  return (
    <ThemeProviderContext.Provider value={LIGHT}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => React.useContext(ThemeProviderContext)
