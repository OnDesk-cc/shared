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
| `components/` | navegador | `theme-provider` (el que escribe la clase `dark`, montado por todas las apps), `confirm-delete-modal`, `form-modal`, `console`, `topbar`, y Nova: `nova` (el marco, las filas, el campo y las sugerencias), `nova-chat` (la hoja, sobre Nova central; la única desde v1.17.0), `nova-chat-tools` (la línea de una lectura en curso y la tarjeta de aprobación de una acción, v1.19.0), `nova-mark` |
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
| **`nova-tools`** | **`createNovaTools` + `defineTool` + `defineAction`: las herramientas y las acciones que un producto publica a Nova central** (token RS256 por llamada, membresía de `access`, parámetros de `json-schema`). Una acción (fase 2) corre en dos tiempos según el `mode` firmado en el token: `preview` devuelve la tarjeta de aprobación sin escribir y `commit` escribe |
| `nova-contract` | los tipos del contrato Nova ↔ producto (manifiesto, respuesta, claims con `mode`, candidatos y feed de la búsqueda, la tarjeta de una acción `NovaActionPreview`, el saldo de créditos `NovaUsage` y la parte de datos `data-nova-preview` de la tarjeta, `NovaPreviewData`), sin dependencias de runtime: los importan los productos, el Worker de Nova y la hoja |
| `nova-search` | la búsqueda semántica de Nova (fase 1b): el corte del texto en trozos (`chunkText`), el extracto, cómo elige un producto los candidatos legibles y cómo pagina su bandeja `nova_outbox` sin perder ningún objeto |
| `access` | `checkWorkspaceAccess`: membresía + derecho vivo en una consulta (la usan `middleware` y `nova-tools`) |
| `rs256` | verificación RS256 contra un JWKS remoto (el de Nova) |
| `json-schema` | el subconjunto de JSON Schema de los parámetros de herramientas y su validador |

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

Módulos de las carpetas publicadas (79), con la primera línea de su comentario de cabecera.

| Archivo | Qué hace |
| --- | --- |
| [`calls/ring-tone.tsx`](../calls/ring-tone.tsx) | Los dos tonos de llamada. |
| [`calls/ringer-lease.ts`](../calls/ringer-lease.ts) | Un solo tono de llamada por navegador, por muchas pestañas de OnDesk que haya abiertas. |
| [`components/callout.tsx`](../components/callout.tsx) | El aviso (2026-10-06): lo que una pantalla tiene que decir antes de lo demás o al lado de ello — que una acción queda auditada, que nadie más puede ver un proyecto… |
| [`components/confirm-delete-modal.tsx`](../components/confirm-delete-modal.tsx) | «¿Seguro?» antes de un borrado, igual en los seis productos. |
| [`components/console-kit.tsx`](../components/console-kit.tsx) | Las piezas de los paneles, en el mundo «Clear Sky» (2026-10-04). |
| [`components/console.tsx`](../components/console.tsx) | Las piezas de página que las seis apps ya usaban (`PageHeader`, `StatGrid`, `StatTile`, `PanelHeader`, `EmptyState`, `ConsoleTag`), en el mundo «Clear Sky» desde el… |
| [`components/data-table.tsx`](../components/data-table.tsx) | La tabla de una página (2026-10-06): auditoría, avisos, listas de elementos. |
| [`components/form-modal.tsx`](../components/form-modal.tsx) | El envoltorio de cualquier formulario en diálogo: título, descripción y hueco. |
| [`components/map.tsx`](../components/map.tsx) | Las piezas pequeñas del mapa que llevan los seis productos: la banda de seis líneas y el cierre de seis tramos. |
| [`components/nova-chat-parts.ts`](../components/nova-chat-parts.ts) | Las piezas sin React de la hoja de Nova central (components/nova-chat.tsx), aparte para poder probarlas con node:test. |
| [`components/nova-chat-tools.tsx`](../components/nova-chat-tools.tsx) | Las llamadas a herramientas en la hoja de Nova (fase 2, 2026-10-08). |
| [`components/nova-chat.test.ts`](../components/nova-chat.test.ts) | — |
| [`components/nova-chat.tsx`](../components/nova-chat.tsx) | Nova central en el navegador (2026-10-07; el panel acoplado, 2026-10-08). |
| [`components/nova-dock-state.test.ts`](../components/nova-dock-state.test.ts) | — |
| [`components/nova-dock-state.ts`](../components/nova-dock-state.ts) | Las piezas sin React del panel acoplado de Nova (components/nova-dock.tsx), aparte para probarlas con node:test. |
| [`components/nova-dock.tsx`](../components/nova-dock.tsx) | El panel acoplado de Nova (2026-10-08). |
| [`components/nova-history.tsx`](../components/nova-history.tsx) | El historial del panel de Nova (2026-10-08): las conversaciones de esta persona en este workspace, de cualquier app o de la consola, por día. |
| [`components/nova-mark.tsx`](../components/nova-mark.tsx) | La marca de Nova (2026-10-06): una estrella de cuatro puntas rellena con los seis colores de las apps, porque Nova es la que ve las seis, y un brillo blanco en el centro. |
| [`components/nova-panel.tsx`](../components/nova-panel.tsx) | El panel de Nova (2026-10-08). |
| [`components/nova.tsx`](../components/nova.tsx) | Nova, la hoja del asistente, una sola para los seis productos (2026-10-06). |
| [`components/product-shell.tsx`](../components/product-shell.tsx) | El marco de un producto en el mundo «Clear Sky» (2026-10-04): la forma de la consola de ondesk, para que pasar de la consola a una app, o de una app a otra, se sienta… |
| [`components/segmented.tsx`](../components/segmented.tsx) | El conmutador (2026-10-06): dos a cinco maneras de ver lo mismo (Board \| List, All \| Unread, Reply \| Internal note, los días de una semana). |
| [`components/sky.tsx`](../components/sky.tsx) | La marca y la baldosa de app del mundo «Clear Sky», para los seis productos. |
| [`components/tag.tsx`](../components/tag.tsx) | La píldora de un dato (2026-10-06): el tipo de un elemento, un permiso, un estado, una prioridad. |
| [`components/theme-provider.tsx`](../components/theme-provider.tsx) | El mundo del mapa se lee a la luz del día: no hay tema oscuro en el sitio, en la puerta, en las consolas ni en los seis productos (decidido el 2026-09-29). |
| [`components/topbar.tsx`](../components/topbar.tsx) | Las piezas de la barra superior de un producto (2026-10-06): el buscador, la campana, la ayuda y el botón de glifo sobre el que van. |
| [`hooks/map.ts`](../hooks/map.ts) | Los hooks de las piezas de consola (`components/console-kit.tsx`), iguales que en `ondesk/src/features/frontend/hooks.ts`: el reloj del horario, el aviso que se apaga… |
| [`lib/crud-api.ts`](../lib/crud-api.ts) | El cliente CRUD que se repetía en cada feature, escrito una vez. |
| [`lib/crud-hooks.ts`](../lib/crud-hooks.ts) | Los hooks de React Query que van encima de `crud-api.ts`. |
| [`lib/initials.ts`](../lib/initials.ts) | Dos letras en lugar de alguien que todavía no tiene avatar. |
| [`lib/lines.ts`](../lib/lines.ts) | Las seis líneas del mapa de red, tal como las conocen los seis productos. |
| [`lib/nova-star.ts`](../lib/nova-star.ts) | La geometría de la estrella de Nova (2026-10-06): su silueta, los seis colores de las apps en el orden en que los recorre el degradado cónico, y las cuñas que dibujan… |
| [`lib/use-copy.ts`](../lib/use-copy.ts) | Copiar, hecho una sola vez para todo el proyecto: la misma implementación que partners y developers, la que usa `CopyTicket` en `console.tsx`. |
| [`lib/utils.ts`](../lib/utils.ts) | `cn` — juntar clases de Tailwind sin que se peleen entre ellas. |
| [`presence/presence-dot.tsx`](../presence/presence-dot.tsx) | La presencia como anillo del intercambiador, con el mismo significado en las siete apps que la pintan: relleno es Online, con punto Busy, vacío Away, y apagado al 45 %… |
| [`presence/status.ts`](../presence/status.ts) | El vocabulario de presencia. |
| [`ui/alert-dialog.tsx`](../ui/alert-dialog.tsx) | El diálogo de consecuencias: el mismo papel que `Dialog`, pero no se cierra al pulsar fuera y el foco empieza en «Cancel», el lado que no hace nada. |
| [`ui/avatar.tsx`](../ui/avatar.tsx) | La cara de alguien es su monograma: su foto, o sus iniciales en el corte condensado, dentro de un cuadrado con el trazo del mundo. |
| [`ui/badge.tsx`](../ui/badge.tsx) | El `Badge` de shadcn es la píldora de `Tag` (`components/tag.tsx`) desde el 2026-10-06: la misma clase `.sk-tag`, sin borde, con la palabra en la voz del cielo. |
| [`ui/button.tsx`](../ui/button.tsx) | El botón. |
| [`ui/card.tsx`](../ui/card.tsx) | La tarjeta del mundo «Clear Sky» (2026-10-04): blanca, radio de 18px, la elevación en sombra y nunca en borde. |
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
| [`ui/table.tsx`](../ui/table.tsx) | Una lista es una tabla (`.fare`): en el cielo, filetes finos y la cabecera en voz pequeña (el bloque de consolas de `styles/sky.css`). |
| [`ui/tabs.tsx`](../ui/tabs.tsx) | Las pestañas son el riel de páginas del mundo: los destinos en negrita sobre un filete fino, el actual en tinta con la barra de 3px en el color de la línea que se viaja. |
| [`ui/textarea.tsx`](../ui/textarea.tsx) | El campo de varias líneas, con el trazo del mundo; lo mide su `rows`. |
| [`ui/tooltip.tsx`](../ui/tooltip.tsx) | La nota al pie de un control: tinta sobre papel, en el corte condensado, sin flecha ni radio. |
| [`worker/access.test.ts`](../worker/access.test.ts) | — |
| [`worker/access.ts`](../worker/access.ts) | La pregunta «¿es miembro de este workspace y tiene un derecho vivo para este producto?», en una sola consulta (2026-10-07). |
| [`worker/api.ts`](../worker/api.ts) | El lado de la Developer Platform en un producto: rutas a las que llama una aplicación de terceros con un bearer token, en nombre de una persona. |
| [`worker/cookies.ts`](../worker/cookies.ts) | Lectura de cookies, y nada más. |
| [`worker/email.ts`](../worker/email.ts) | Email transaccional para las notificaciones de un producto. |
| [`worker/json-schema.test.ts`](../worker/json-schema.test.ts) | — |
| [`worker/json-schema.ts`](../worker/json-schema.ts) | El subconjunto de JSON Schema con el que se describen los parámetros de una herramienta de Nova, y su validador (2026-10-07, Nova central). |
| [`worker/jwt.ts`](../worker/jwt.ts) | Firma HS256 y verificación con audiencia, sobre Web Crypto. |
| [`worker/middleware.ts`](../worker/middleware.ts) | El middleware de autenticación y de workspace con el que cada producto satélite envuelve sus rutas. |
| [`worker/mirror.ts`](../worker/mirror.ts) | El espejo del estado de OnDesk — las escrituras que cada producto hace de forma idéntica. |
| [`worker/nova-contract.ts`](../worker/nova-contract.ts) | Los tipos del contrato entre Nova central y las herramientas de un producto (2026-10-07). |
| [`worker/nova-search.test.ts`](../worker/nova-search.test.ts) | — |
| [`worker/nova-search.ts`](../worker/nova-search.ts) | La búsqueda semántica de Nova central (fase 1b, 2026-10-07). |
| [`worker/nova-tools.test.ts`](../worker/nova-tools.test.ts) | Una sola clave para todo el archivo: la caché del JWKS vive entre pruebas y sólo se refresca a la fuerza una vez por minuto. |
| [`worker/nova-tools.ts`](../worker/nova-tools.ts) | Las herramientas que un producto le publica a Nova central (2026-10-07, fase 1). |
| [`worker/response.ts`](../worker/response.ts) | Las tres respuestas JSON que devuelve cualquier handler de Pages Functions. |
| [`worker/rs256.test.ts`](../worker/rs256.test.ts) | — |
| [`worker/rs256.ts`](../worker/rs256.ts) | Verificación RS256 contra un JWKS remoto, con caché por URL en el isolate (2026-10-07, Nova central). |
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
| `npm run test` | `tsx --test "worker/**/*.test.ts" "components/**/*.test.ts"` |

<!-- END generated:config -->
