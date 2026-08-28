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
| `worker/`  | Pages Functions | `response` — the `jsonOk` / `jsonError` helpers; `sso` — platform session + webhook verification (the products' side, never ondesk's) |

Import by path, no barrel:

```ts
import { Button } from "@ondesk/shared/ui/button";
import { cn } from "@ondesk/shared/lib/utils";
import { jsonOk } from "@ondesk/shared/worker/response";
```

`ui/`, `lib/`, `hooks/` and `calls/` assume the DOM; `worker/` assumes
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

2. **CI needs nothing.** This repository is **public**, so `npm ci` on a runner
   clones it anonymously and the app's workflow stays as it is. That is a
   deliberate trade: the six product repos are private, but on the GitHub Free
   plan an organization secret never reaches a private repository (it is listed
   as visible and arrives empty), and a PAT copied into six repos is exactly the
   kind of machinery this package exists to remove.

   What follows from it: **nothing secret ever lands here** — no keys, no
   internal hostnames, no platform logic you would not want read. Code that is
   shared but sensitive stays in the apps until this repo goes private again, and
   if it does, every app needs a token step before `npm ci`:

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
