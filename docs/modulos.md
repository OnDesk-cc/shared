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

Módulos de las carpetas publicadas (46), con la primera línea de su comentario de cabecera.

| Archivo | Qué hace |
| --- | --- |
| [`calls/ring-tone.tsx`](../calls/ring-tone.tsx) | The two ringtones. |
| [`calls/ringer-lease.ts`](../calls/ringer-lease.ts) | One ringtone per browser, however many OnDesk tabs are open. |
| [`components/confirm-delete-modal.tsx`](../components/confirm-delete-modal.tsx) | — |
| [`components/console.tsx`](../components/console.tsx) | Console primitives — hard corners, hairline grids, mono telemetry labels, lime scan-lines. |
| [`components/form-modal.tsx`](../components/form-modal.tsx) | — |
| [`components/theme-provider.tsx`](../components/theme-provider.tsx) | The scaffold bound `d` to a theme toggle globally. |
| [`hooks/use-mobile.ts`](../hooks/use-mobile.ts) | — |
| [`lib/crud-api.ts`](../lib/crud-api.ts) | — |
| [`lib/crud-hooks.ts`](../lib/crud-hooks.ts) | — |
| [`lib/initials.ts`](../lib/initials.ts) | Two letters standing in for somebody who has no avatar yet. |
| [`lib/utils.ts`](../lib/utils.ts) | — |
| [`presence/presence-dot.tsx`](../presence/presence-dot.tsx) | Draws the ring that separates it from whatever it is pinned to. |
| [`presence/status.ts`](../presence/status.ts) | The presence vocabulary. |
| [`ui/alert-dialog.tsx`](../ui/alert-dialog.tsx) | — |
| [`ui/avatar.tsx`](../ui/avatar.tsx) | — |
| [`ui/badge.tsx`](../ui/badge.tsx) | — |
| [`ui/button.tsx`](../ui/button.tsx) | — |
| [`ui/card.tsx`](../ui/card.tsx) | — |
| [`ui/checkbox.tsx`](../ui/checkbox.tsx) | — |
| [`ui/command.tsx`](../ui/command.tsx) | — |
| [`ui/dialog.tsx`](../ui/dialog.tsx) | — |
| [`ui/dropdown-menu.tsx`](../ui/dropdown-menu.tsx) | — |
| [`ui/hover-card.tsx`](../ui/hover-card.tsx) | — |
| [`ui/input.tsx`](../ui/input.tsx) | — |
| [`ui/label.tsx`](../ui/label.tsx) | — |
| [`ui/popover.tsx`](../ui/popover.tsx) | — |
| [`ui/progress.tsx`](../ui/progress.tsx) | — |
| [`ui/select.tsx`](../ui/select.tsx) | — |
| [`ui/separator.tsx`](../ui/separator.tsx) | — |
| [`ui/sheet.tsx`](../ui/sheet.tsx) | — |
| [`ui/sidebar.tsx`](../ui/sidebar.tsx) | This is the internal state of the sidebar. |
| [`ui/skeleton.tsx`](../ui/skeleton.tsx) | — |
| [`ui/sonner.tsx`](../ui/sonner.tsx) | Every OnDesk app's theme lives in this package's own provider rather than next-themes — one less dependency, and the provider is what writes the `dark` class the tokens… |
| [`ui/switch.tsx`](../ui/switch.tsx) | — |
| [`ui/table.tsx`](../ui/table.tsx) | — |
| [`ui/tabs.tsx`](../ui/tabs.tsx) | — |
| [`ui/textarea.tsx`](../ui/textarea.tsx) | — |
| [`ui/tooltip.tsx`](../ui/tooltip.tsx) | — |
| [`worker/api.ts`](../worker/api.ts) | The Developer Platform's side of a product: routes a third-party application calls with a bearer token, on behalf of a person. |
| [`worker/cookies.ts`](../worker/cookies.ts) | Cookie reading, and nothing else. |
| [`worker/email.ts`](../worker/email.ts) | Transactional email for a product's notifications. |
| [`worker/jwt.ts`](../worker/jwt.ts) | HS256 signing and audienced verification, on Web Crypto. |
| [`worker/middleware.ts`](../worker/middleware.ts) | The auth/tenancy middleware every satellite product wraps its routes in. |
| [`worker/mirror.ts`](../worker/mirror.ts) | The mirror of OnDesk state — the writes every product performs identically. |
| [`worker/response.ts`](../worker/response.ts) | — |
| [`worker/sso.ts`](../worker/sso.ts) | Platform token verification for the OnDesk control plane. |

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
