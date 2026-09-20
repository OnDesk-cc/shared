# @ondesk/shared — notas del proyecto

> Este documento es el README original del proyecto. Se conserva porque es la
> explicación de fondo más detallada que existe del *por qué*. **Traducido del
> inglés el 2026-09-19**; donde el texto se había quedado atrás respecto al
> código, la corrección va marcada con «▸ **Hoy**».
>
> La navegación en español está en [README.md](README.md), el índice de `docs/`.

---

Código que es idéntico en todos los productos de OnDesk — la consola, Pulse,
Vault, Orbit, Nexus y Halo. Cada producto es su propio repositorio y se despliega
por su cuenta; este paquete es la forma de que dejen de llevar seis copias
byte a byte idénticas del mismo archivo.

Se publica como **TypeScript en crudo**. No hay paso de compilación: el bundler
de la app que lo consume (Vite para `src/`, wrangler para `functions/`) lo
compila, y el `tsc` de la app lo comprueba como parte de su propio programa.

## Cómo está organizado

| Ruta       | Corre en | Qué es                                                     |
| ---------- | ------- | ------------------------------------------------------------- |
| `ui/`      | navegador | primitivas de shadcn/ui (`button`, `dialog`, `sidebar`, …) más `sonner` (con tema vía `components/theme-provider`) |
| `lib/`     | navegador | `cn()`; `crud-api` / `crud-hooks` — el cliente genérico de listar/crear/actualizar/borrar y sus hooks de TanStack Query |
| `hooks/`   | navegador | `useIsMobile()`                                               |
| `components/` | navegador | `theme-provider` (el que escribe la clase `dark`, y lo monta toda app), `confirm-delete-modal`, `form-modal` |
| `calls/`   | navegador | `ringer-lease` — un solo tono de llamada por navegador en todos los productos; `ring-tone` — el reproductor `<RingTone>` (cada app sirve `/sounds/ringtone-{in,out}.mp3`) |
| `presence/` | navegador | `status` — el vocabulario de presencia que renderiza cada producto (`STATUS_META`, `presenceLabel`, `lastSeenShort`); `presence-dot` — el punto en sí |
| `worker/`  | Pages Functions | `response` — los helpers `jsonOk` / `jsonError`; `sso` — sesión de plataforma y verificación de webhooks (el lado de los productos, nunca el de ondesk); `cookies` — lectura de la cookie de sesión; `jwt` — firma HS256 y tickets con audiencia; `middleware` — `createMiddleware(product)` → los cuatro envoltorios de ruta; `email` — `createEmailer(brand)` y helpers de plantilla; `mirror` — las escrituras del espejo del control plane, idénticas en todos |

Se importa por ruta, sin barrel:

```ts
import { Button } from "@ondesk/shared/ui/button";
import { cn } from "@ondesk/shared/lib/utils";
import { jsonOk } from "@ondesk/shared/worker/response";
```

`ui/`, `lib/`, `hooks/`, `components/`, `calls/` y `presence/` dan por hecho el
DOM; `worker/` da por hecho `@cloudflare/workers-types`. **Nunca importes
cruzando esa línea** — los dos universos de tipos no se ponen de acuerdo sobre
los mismos nombres globales, que es por lo que aquí hay dos `tsconfig` y otros
dos en cada app.

## Consumirlo

Cada app fija un **tag** y actualiza cuando quiere:

```json
"dependencies": {
  "@ondesk/shared": "git+https://github.com/OnDesk-cc/shared.git#v1.0.0"
}
```

Escribe la especificación a mano en `package.json` en vez de vía
`npm install <url>`, que guarda el atajo `github:OnDesk-cc/shared#v1.0.0`. Las
dos formas instalan lo mismo; la URL explícita sólo dice lo que es.

> ▸ **Hoy**: los diez consumidores usan el atajo `github:OnDesk-cc/shared#v1.4.0`,
> no la URL larga. Funciona igual; esta sección describe una preferencia que en
> la práctica no se siguió.

`package-lock.json` va a mostrar la dependencia como
`git+ssh://git@github.com/OnDesk-cc/shared.git#<sha>` use la forma que use
`package.json`. Eso es cosmético: para una URL de GitHub, npm clona primero por
**https** y sólo cae a ssh si eso falla, así que no hace falta clave SSH en
ninguna parte — verificado con `npm ci` en npm 11. El `<sha>` es lo que hace un
build reproducible; hacer rollback es revertir una línea.

Después, en la app:

1. **Tailwind v4 no escanea `node_modules`.** Añade al `index.css` de la app,
   justo después de los `@import`:

   ```css
   @source "../node_modules/@ondesk/shared";
   ```

   Sin eso, cada componente compartido se renderiza sin estilos y no falla nada.

2. **CI necesita un token en cuanto este repo sea privado.** Mientras es público,
   el `npm ci` de un runner lo clona anónimamente y los workflows de las apps se
   quedan como están. En el momento en que se pase a privado, eso se rompe en los
   seis a la vez: el `GITHUB_TOKEN` por defecto está limitado al repositorio de la
   propia app y no puede leer otro repo privado de la organización, y la
   resolución del lockfile es una URL de git.

   Hay exactamente un sitio donde arreglarlo, porque Cloudflare Pages **no
   construye desde fuente** — el workflow construye y luego corre
   `wrangler pages deploy dist`. Así que cada app necesita esto antes de su
   `npm ci`:

   ```yaml
   - run: git config --global url."https://x-access-token:${SHARED_READ_TOKEN}@github.com/".insteadOf "https://github.com/"
     env:
       SHARED_READ_TOKEN: ${{ secrets.SHARED_READ_TOKEN }}   # PAT de grano fino, Contents: read, un secreto DE REPOSITORIO en cada app
   ```

3. Borra la copia que la app tenga de cada archivo que ahora importes de aquí.
   Dos copias de un `Dialog` es exactamente como los seis se separaron.

## Publicar una versión

1. Cambia el archivo. Corre `npm run typecheck`.
2. Sube `version` en `package.json`, commit, tag:
   `git tag v1.1.0 && git push --tags`.
3. En cada app que lo quiera: cambia el tag en `package.json` a `#v1.1.0`, corre
   `npm install`, luego su typecheck y su build, y abre su PR.

> ⚠️ **El pin es al TAG, no a master.** Un commit empujado sin tag rompió el CI
> de los seis productos a la vez. Y `npm install` a secas **no vuelve a resolver
> un tag** que ya está en el lockfile: hace falta
> `npm install @ondesk/shared@git+…#vX.Y.Z` explícito.

El semver es para las personas: **major** cuando un consumidor tiene que cambiar
código, **minor** cuando se añade algo, **patch** para un arreglo. Las apps que no
estén listas simplemente se quedan en el tag anterior.

## Las reglas

- Aquí sólo pertenece el código que es genuinamente idéntico entre productos. Algo
  que necesite un `if (app === "halo")` pertenece a la app, o necesita
  parametrizarse *antes* de mudarse aquí.
- Dentro de este paquete, **sólo imports relativos** (`../lib/utils`, no
  `@/lib/utils`). El alias `@/` es de cada app; el bundler del consumidor no sabe
  nada del nuestro.
- Las dependencias de runtime son **peerDependencies**, nunca `dependencies`. Una
  segunda copia de React dentro de `node_modules/@ondesk/shared/` rompe todos los
  hooks.
- **No hay campo `exports` a propósito**: con `moduleResolution: "bundler"`, un
  import de subruta resuelve directo al archivo `.ts`/`.tsx`, y cada archivo nuevo
  es importable sin tocar `package.json`.
