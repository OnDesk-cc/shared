/**
 * ¿Estamos en una pantalla estrecha? El corte es 768 px (`md` de Tailwind).
 *
 * Existe porque hay decisiones que NO se pueden tomar con una media query: el
 * sidebar de `ui/sidebar.tsx` no cambia de estilo en móvil, cambia de
 * componente — se convierte en un `Sheet` que se abre por encima. Eso hay que
 * decidirlo en JavaScript.
 *
 * El primer render devuelve `false` (el estado arranca `undefined` y sale por
 * `!!isMobile`), y el valor real llega en el efecto. Es decir: en móvil hay un
 * frame de escritorio antes de corregirse. Se aguanta porque el único consumidor
 * es el sidebar, que en móvil arranca cerrado.
 *
 * Hoy sólo lo usa `ui/sidebar.tsx`, y a través de él los seis productos. Los
 * cuatro paneles (ondesk, admin, developers, partners) no lo importan: el
 * tratamiento responsive de admin se hizo con `useScrollRow` y `TwoPane`, que
 * viven en admin y no aquí.
 */
import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}
