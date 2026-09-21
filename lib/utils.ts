/**
 * `cn` — juntar clases de Tailwind sin que se peleen entre ellas.
 *
 * `clsx` resuelve los condicionales y los arrays; `twMerge` es lo que de verdad
 * importa: de dos utilidades del mismo eje (`p-2` y `p-4`, `text-xs` y
 * `text-sm`) se queda con la última. Sin eso, un componente que recibe
 * `className` desde fuera no puede sobrescribir su propio estilo — ganaría la
 * que el CSS ponga después, que no es la que escribió quien llama.
 *
 * Es el módulo más importado de todo el paquete: lo usan los diez SPA. Por eso
 * no tiene nada más dentro, y no debería tenerlo.
 */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
