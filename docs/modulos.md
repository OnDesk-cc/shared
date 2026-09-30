# Módulos — @ondesk/shared

## La frontera

```
  ┌─────────────────────────────┐   ┌──────────────────────────┐
  │  NAVEGADOR                  │   │  PAGES FUNCTIONS         │
  │  ui/  lib/  hooks/          │   │  worker/                 │
  │  components/  calls/        │   │                          │
  │  presence/                  │   │  @cloudflare/workers-    │
  │  asume el DOM               │   │  types                   │
  └─────────────────────────────┘   └──────────────────────────┘
            tsconfig.ui.json              tsconfig.worker.json
                        ✗ nunca cruzar ✗
```

Los dos universos de tipos declaran los mismos nombres globales con formas
distintas. Importar de un lado al otro compila en tu cabeza y en ningún otro
sitio.

## Qué hay en cada carpeta

| Carpeta | Corre en | Qué |
|---|---|---|
| `ui/` | navegador | primitivos de shadcn/ui (`button`, `dialog`, `sidebar`…) más `sonner`, tematizado por `components/theme-provider` |
| `lib/` | navegador | `cn()`; `crud-api` / `crud-hooks` — el cliente genérico de list/create/update/delete y sus hooks de TanStack Query; `initials` |
| `hooks/` | navegador | `useIsMobile()` |
| `components/` | navegador | `theme-provider` (el que escribe la clase `dark`, montado por todas las apps), `confirm-delete-modal`, `form-modal`, `console` |
| `calls/` | navegador | `ringer-lease` — **un solo tono por navegador entre todos los productos**; `ring-tone` — el reproductor |
| `presence/` | navegador | `status` — el vocabulario de presencia que renderizan los seis (`STATUS_META`, `presenceLabel`, `lastSeenShort`); `presence-dot` |
| `worker/` | Pages Functions | ver abajo — **es la parte crítica** |

## `worker/` — lo que de verdad importa

| Módulo | Qué resuelve |
|---|---|
| **`middleware`** | **`createMiddleware(product)` → los cuatro guards de ruta.** El middleware de autenticación de los seis productos |
| `sso` | sesión de plataforma y verificación de webhook — **el lado de los productos, nunca el de ondesk** |
| `mirror` | las escrituras del espejo del control plane, idénticas en los seis |
| `response` | `jsonOk` / `jsonError` |
| `cookies` | lectura de la cookie de sesión |
| `jwt` | firma HS256 y tickets con audiencia |
| `email` | `createEmailer(brand)` y los helpers de plantilla |
| `api` | el núcleo de la API con token bearer (`/api/v1` de cada producto) |

### `createMiddleware` en una frase

Cada producto tiene un `functions/_lib/middleware.ts` de diez líneas que declara
su `Env`, su unión de permisos, su nombre de producto y su resolutor de permisos.
Todo lo demás —verificar la cookie, comprobar la membresía, comprobar el derecho
de uso, devolver 402— **está aquí, una sola vez**.

Los cuatro guards que devuelve: `withAuth`, `withWorkspace`, `withPermission`,
`withWritePermission`. Qué prueba cada uno está en
[`ondesk/docs/arquitectura.md`](../../ondesk/docs/arquitectura.md#los-guards).

## Importar por ruta, sin barril

```ts
import { Button } from "@ondesk/shared/ui/button";
import { cn }     from "@ondesk/shared/lib/utils";
import { jsonOk } from "@ondesk/shared/worker/response";
```

**No hay campo `exports` a propósito**: con `moduleResolution: "bundler"` una
importación de subruta resuelve directo al archivo `.ts`/`.tsx`, y así cada
archivo nuevo es importable sin tocar `package.json`.

## El inventario

<!-- BEGIN generated:modules -->
<!-- No edites aquí: lo reescribe `npm run docs`. -->

Módulos de las carpetas publicadas (50), con la primera línea de su comentario de cabecera.

| Archivo | Qué hace |
| --- | --- |
| [`calls/ring-tone.tsx`](../calls/ring-tone.tsx) | Los dos tonos de llamada. |
| [`calls/ringer-lease.ts`](../calls/ringer-lease.ts) | Un solo tono de llamada por navegador, por muchas pestañas de OnDesk que haya abiertas. |
| [`components/confirm-delete-modal.tsx`](../components/confirm-delete-modal.tsx) | «¿Seguro?» antes de un borrado, igual en los seis productos. |
| [`components/console-kit.tsx`](../components/console-kit.tsx) | Las piezas de los paneles, en el vocabulario del mapa. |
| [`components/console.tsx`](../components/console.tsx) | Las piezas de página que las seis apps ya usaban (`PageHeader`, `StatGrid`, `StatTile`, `PanelHeader`, `EmptyState`, `ConsoleTag`), redibujadas en el mundo del mapa de… |
| [`components/form-modal.tsx`](../components/form-modal.tsx) | El envoltorio de cualquier formulario en diálogo: título, descripción y hueco. |
| [`components/map.tsx`](../components/map.tsx) | Las piezas pequeñas del mapa que llevan los seis productos: la banda de seis líneas y el cierre de seis tramos. |
| [`components/product-shell.tsx`](../components/product-shell.tsx) | El marco de un producto en el mundo del mapa de red: las piezas de la franja de ruta que son iguales en las seis apps y no saben nada del router ni de los contextos de… |
| [`components/theme-provider.tsx`](../components/theme-provider.tsx) | El mundo del mapa se lee a la luz del día: no hay tema oscuro en el sitio, en la puerta, en las consolas ni en los seis productos (decidido el 2026-09-29). |
| [`hooks/map.ts`](../hooks/map.ts) | Los hooks de las piezas de consola (`components/console-kit.tsx`), iguales que en `ondesk/src/features/frontend/hooks.ts`: el reloj del horario, el aviso que se apaga… |
| [`lib/crud-api.ts`](../lib/crud-api.ts) | El cliente CRUD que se repetía en cada feature, escrito una vez. |
| [`lib/crud-hooks.ts`](../lib/crud-hooks.ts) | Los hooks de React Query que van encima de `crud-api.ts`. |
| [`lib/initials.ts`](../lib/initials.ts) | Dos letras en lugar de alguien que todavía no tiene avatar. |
| [`lib/lines.ts`](../lib/lines.ts) | Las seis líneas del mapa de red, tal como las conocen los seis productos. |
| [`lib/use-copy.ts`](../lib/use-copy.ts) | Copiar, hecho una sola vez para todo el proyecto: la misma implementación que partners y developers, la que usa `CopyTicket` en `console.tsx`. |
| [`lib/utils.ts`](../lib/utils.ts) | `cn` — juntar clases de Tailwind sin que se peleen entre ellas. |
| [`presence/presence-dot.tsx`](../presence/presence-dot.tsx) | La presencia como anillo del intercambiador, con el mismo significado en las siete apps que la pintan: relleno es Online, con punto Busy, vacío Away, y apagado al 45 %… |
| [`presence/status.ts`](../presence/status.ts) | El vocabulario de presencia. |
| [`ui/alert-dialog.tsx`](../ui/alert-dialog.tsx) | El diálogo de consecuencias: el mismo papel que `Dialog`, pero no se cierra al pulsar fuera y el foco empieza en «Cancel», el lado que no hace nada. |
| [`ui/avatar.tsx`](../ui/avatar.tsx) | La cara de alguien es su monograma: su foto, o sus iniciales en el corte condensado, dentro de un cuadrado con el trazo del mundo. |
| [`ui/badge.tsx`](../ui/badge.tsx) | El sello: un estado impreso en una caja con el trazo del mundo. |
| [`ui/button.tsx`](../ui/button.tsx) | El billete: la única forma de botón del mundo del mapa (ver `styles/site.css`, «billetes y botones»). |
| [`ui/card.tsx`](../ui/card.tsx) | En el mundo del mapa no hay tarjetas: hay paradas. |
| [`ui/checkbox.tsx`](../ui/checkbox.tsx) | La casilla del mundo: un cuadrado con el trazo de 3px que se llena de tinta. |
| [`ui/command.tsx`](../ui/command.tsx) | La paleta de órdenes sobre cmdk: el campo de búsqueda cerrado por el filete grueso, los grupos con rótulo de andén y las filas del panel de papel. |
| [`ui/dialog.tsx`](../ui/dialog.tsx) | El diálogo de papel sobre Radix: el trazo de 3px sobre papel, la única penumbra del mundo detrás (tinta al 70 %), una cabecera cerrada por el filete grueso, el aspa… |
| [`ui/dropdown-menu.tsx`](../ui/dropdown-menu.tsx) | El menú de acciones sobre Radix: un panel de papel con el trazo del mundo (`menu-paper`, en `styles/product.css`), filas en negrita que se tintan al pasar, rótulos de… |
| [`ui/hover-card.tsx`](../ui/hover-card.tsx) | La ficha que se abre al pasar el ratón: el mismo panel de papel que un popover. |
| [`ui/input.tsx`](../ui/input.tsx) | El campo del mundo: el trazo de 3px sobre papel, la única tinta clara al enfocar. |
| [`ui/label.tsx`](../ui/label.tsx) | El rótulo de un campo: el rótulo de andén, en bloque, con medio renglón debajo. |
| [`ui/popover.tsx`](../ui/popover.tsx) | Un panel de papel con contenido, anclado a lo que lo abre; sin radio ni sombra. |
| [`ui/progress.tsx`](../ui/progress.tsx) | Una vía con el trazo del mundo que se rellena de tinta hasta donde llega el valor. |
| [`ui/select.tsx`](../ui/select.tsx) | El desplegable sobre Radix: el disparador es un campo del mundo con su chevrón, y las opciones un panel de papel con filas en negrita. |
| [`ui/separator.tsx`](../ui/separator.tsx) | El filete fino del mundo, en horizontal o en vertical. |
| [`ui/sheet.tsx`](../ui/sheet.tsx) | La hoja lateral: un pliego de papel que entra desde un borde de la pantalla, con el trazo del mundo en el canto que da a la página y la penumbra detrás. |
| [`ui/skeleton.tsx`](../ui/skeleton.tsx) | El hueco de carga: la forma de lo que viene, en la única tinta clara, quieto. |
| [`ui/sonner.tsx`](../ui/sonner.tsx) | Las notificaciones: un billete de papel con el trazo del mundo, sin sombra ni radio (el estilo va en `styles/site.css`, `[data-sonner-toast]`). |
| [`ui/switch.tsx`](../ui/switch.tsx) | El interruptor: una vía cuadrada con el trazo del mundo y un mando de tinta que la cruza; encendido, la vía se entinta y el mando pasa a papel. |
| [`ui/table.tsx`](../ui/table.tsx) | Una lista es una tabla de tarifas (`.fare`, en `styles/site.css`): el corte condensado con cifras tabulares, las cabeceras como rótulos de andén cerradas por el filete… |
| [`ui/tabs.tsx`](../ui/tabs.tsx) | Las pestañas son el riel de páginas del mundo: los destinos en negrita sobre un filete fino, el actual en tinta con la barra de 3px en el color de la línea que se viaja. |
| [`ui/textarea.tsx`](../ui/textarea.tsx) | El campo de varias líneas, con el trazo del mundo; lo mide su `rows`. |
| [`ui/tooltip.tsx`](../ui/tooltip.tsx) | La nota al pie de un control: tinta sobre papel, en el corte condensado, sin flecha ni radio. |
| [`worker/api.ts`](../worker/api.ts) | El lado de la Developer Platform en un producto: rutas a las que llama una aplicación de terceros con un bearer token, en nombre de una persona. |
| [`worker/cookies.ts`](../worker/cookies.ts) | Lectura de cookies, y nada más. |
| [`worker/email.ts`](../worker/email.ts) | Email transaccional para las notificaciones de un producto. |
| [`worker/jwt.ts`](../worker/jwt.ts) | Firma HS256 y verificación con audiencia, sobre Web Crypto. |
| [`worker/middleware.ts`](../worker/middleware.ts) | El middleware de autenticación y de workspace con el que cada producto satélite envuelve sus rutas. |
| [`worker/mirror.ts`](../worker/mirror.ts) | El espejo del estado de OnDesk — las escrituras que cada producto hace de forma idéntica. |
| [`worker/response.ts`](../worker/response.ts) | Las tres respuestas JSON que devuelve cualquier handler de Pages Functions. |
| [`worker/sso.ts`](../worker/sso.ts) | Verificación de los tokens de plataforma del control plane de OnDesk. |

<!-- END generated:modules -->

## Configuración

<!-- BEGIN generated:config -->
<!-- No edites aquí: lo reescribe `npm run docs`. -->

_Sin `wrangler.toml`: este proyecto no se despliega por su cuenta._

### Bindings

_Nada que listar._

### Variables (`[vars]`, públicas)

_Nada que listar._

### Secretos

_Ninguno declarado en `wrangler.toml` ni en `.dev.vars.example`._

### Cron

_Sin cron propio._

### Scripts de npm

| Script | Comando |
| --- | --- |
| `npm run typecheck` | `tsc -p tsconfig.ui.json --noEmit && tsc -p tsconfig.worker.json --noEmit` |
| `npm run docs` | `node scripts/gen-docs.mjs` |
| `npm run docs:check` | `node scripts/gen-docs.mjs --check` |
| `npm run docs:gaps` | `node scripts/gen-docs.mjs --gaps` |

<!-- END generated:config -->
