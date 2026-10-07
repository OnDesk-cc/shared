/**
 * Una lista es una tabla (`.fare`): en el cielo, filetes finos y la cabecera en
 * voz pequeña (el bloque de consolas de `styles/sky.css`). Una fila que es un
 * enlace o un botón (`interactive`, o cualquiera con `onClick`) toma la niebla
 * al pasar y no se levanta; la elegida (`data-state="selected"`,
 * `data-selected`) se queda en esa niebla. Para una tabla de página entera con
 * su vacío y su paginador, `DataTable` de `components/data-table`.
 */
import * as React from "react"

import { cn } from "../lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("fare caption-bottom", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn(className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("font-medium", className)}
      {...props}
    />
  )
}

function TableRow({
  className,
  interactive,
  ...props
}: React.ComponentProps<"tr"> & {
  /** La fila lleva a algún sitio: cursor de mano y niebla al pasar. Por defecto, si tiene `onClick`. */
  interactive?: boolean
}) {
  const link = interactive ?? Boolean(props.onClick)
  return (
    <tr
      data-slot="table-row"
      className={cn(
        link && "is-link cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--sk-accent)",
        "data-[state=selected]:bg-(--sk-ground) data-[selected=true]:bg-(--sk-ground)",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-[0.875rem] text-(--sk-ink-2)", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
