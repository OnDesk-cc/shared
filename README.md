# @ondesk/shared

Code that is the same in every OnDesk product — the console, Pulse, Vault, Orbit,
Nexus and Halo. Each product is its own repository and deploys on its own; this
package is how they stop carrying six byte-identical copies of the same file.

It ships **raw TypeScript**. There is no build step: the consuming app's bundler
(Vite for `src/`, wrangler for `functions/`) compiles it, and the app's `tsc`
typechecks it as part of its own program.

## Layout

| Path       | Runs in | What                                                          |
| ---------- | ------- | ------------------------------------------------------------- |
| `ui/`      | browser | shadcn/ui primitives (`button`, `dialog`, `sidebar`, …) plus `sonner` (themed via `components/theme-provider`) |
| `lib/`     | browser | `cn()`; `crud-api` / `crud-hooks` — the generic list/create/update/delete client + TanStack Query hooks |
| `hooks/`   | browser | `useIsMobile()`                                               |
| `components/` | browser | `theme-provider` (the `dark`-class writer every app mounts), `confirm-delete-modal`, `form-modal` |
| `calls/`   | browser | `ringer-lease` — one ringtone per browser across all products; `ring-tone` — the `<RingTone>` player (each app serves `/sounds/ringtone-{in,out}.mp3`) |
| `presence/` | browser | `status` — the presence vocabulary every product renders (`STATUS_META`, `presenceLabel`, `lastSeenShort`); `presence-dot` — the dot itself |
| `worker/`  | Pages Functions | `response` — the `jsonOk` / `jsonError` helpers; `sso` — platform session + webhook verification (the products' side, never ondesk's); `cookies` — session-cookie reading; `jwt` — HS256 signing + audienced tickets; `middleware` — `createMiddleware(product)` → the four route wrappers; `email` — `createEmailer(brand)` + template helpers; `mirror` — the identical control-plane mirror writes |

Import by path, no barrel:

```ts
import { Button } from "@ondesk/shared/ui/button";
import { cn } from "@ondesk/shared/lib/utils";
import { jsonOk } from "@ondesk/shared/worker/response";
```

`ui/`, `lib/`, `hooks/`, `components/`, `calls/` and `presence/` assume the DOM;
`worker/` assumes
`@cloudflare/workers-types`. Never import across that line — the two type
universes disagree on the same global names, which is why there are two
`tsconfig`s here and two in every app.

## Consuming it

Each app pins a **tag** and upgrades when it wants to:

```json
"dependencies": {
  "@ondesk/shared": "git+https://github.com/OnDesk-cc/shared.git#v1.0.0"
}
```

Write the spec by hand in `package.json` rather than via `npm install <url>`,
which saves the `github:OnDesk-cc/shared#v1.0.0` shorthand instead. Either
spelling installs the same thing; the explicit URL just says what it is.

`package-lock.json` will show the dependency as
`git+ssh://git@github.com/OnDesk-cc/shared.git#<sha>` no matter which form
`package.json` uses. That is cosmetic: for a GitHub URL npm clones over **https**
first and only falls back to ssh if that fails, so no SSH key is needed anywhere —
verified with `npm ci` on npm 11. The `<sha>` is what makes a build
reproducible; a rollback is reverting one line.

Then, in the app:

1. **Tailwind v4 does not scan `node_modules`.** Add to the app's `index.css`,
   right after the `@import`s:

   ```css
   @source "../node_modules/@ondesk/shared";
   ```

   Without it every shared component renders with no styles and nothing errors.

2. **CI needs a token once this repo is private.** While it is public, `npm ci`
   on a runner clones it anonymously and the app workflows stay as they are.
   The moment it is flipped to private that breaks in all six at once: the
   default `GITHUB_TOKEN` is scoped to the app's own repository and cannot read
   another private repo in the org, and the lockfile resolution is a git URL.

   There is exactly one place to fix, because Cloudflare Pages does not build
   from source — the workflow builds and then runs `wrangler pages deploy dist`.
   So each app needs this before its `npm ci`:

   ```yaml
   - run: git config --global url."https://x-access-token:${SHARED_READ_TOKEN}@github.com/".insteadOf "https://github.com/"
     env:
       SHARED_READ_TOKEN: ${{ secrets.SHARED_READ_TOKEN }}   # fine-grained PAT, Contents: read, a REPOSITORY secret in each app
   ```

3. Delete the app's copy of each file you now import from here. Two copies of a
   `Dialog` is how the six drifted apart in the first place.

## Releasing

1. Change the file. Run `npm run typecheck`.
2. Bump `version` in `package.json`, commit, tag: `git tag v1.1.0 && git push --tags`.
3. In each app that wants it: change the tag in `package.json` to `#v1.1.0`, run
   `npm install`, then its typecheck + build, and open its PR.

Semver is for people: **major** when a consumer has to change code, **minor**
when something is added, **patch** for a fix. Apps that are not ready simply stay
on the older tag.

## Rules

- Only code that is genuinely identical across products belongs here. Something
  that needs an `if (app === "halo")` belongs in the app, or needs to be
  parameterised *before* it moves in.
- Relative imports only inside this package (`../lib/utils`, not `@/lib/utils`).
  The `@/` alias is each app's; the consumer's bundler knows nothing about ours.
- Runtime dependencies are **peerDependencies**, never `dependencies`. A second
  copy of React inside `node_modules/@ondesk/shared/` breaks every hook.
- No `exports` field on purpose: with `moduleResolution: "bundler"` a subpath
  import resolves straight to the `.ts`/`.tsx` file, and every new file is
  importable without editing `package.json`.
