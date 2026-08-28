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
| `ui/`      | browser | shadcn/ui primitives (`button`, `dialog`, `sidebar`, …)       |
| `lib/`     | browser | `cn()`                                                        |
| `hooks/`   | browser | `useIsMobile()`                                               |
| `calls/`   | browser | `ringer-lease` — one ringtone per browser across all products |
| `worker/`  | Pages Functions | `response` — the `jsonOk` / `jsonError` helpers        |

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

2. **CI needs to read this private repo.** Before `npm ci` in the app's workflow:

   ```yaml
   - name: Authorize access to OnDesk-cc/shared
     run: |
       git config --global url."https://x-access-token:${SHARED_READ_TOKEN}@github.com/".insteadOf "https://github.com/"
       git config --global url."https://x-access-token:${SHARED_READ_TOKEN}@github.com/".insteadOf "ssh://git@github.com/"
     env:
       SHARED_READ_TOKEN: ${{ secrets.SHARED_READ_TOKEN }}
   ```

   The first rule is the one that matters (npm clones over https); the second
   covers the ssh fallback so a failure is never silent.

   `SHARED_READ_TOKEN` is a fine-grained PAT with *Contents: read* on this
   repository only, stored once as an **organization secret** so every product
   repo sees it. Locally nothing is needed — your existing GitHub credential
   already covers it.

3. Delete the app's copy of each file you now import from here. Two copies of a
   `Dialog` is how the six drifted apart in the first place.

## Releasing

1. Change the file. Run `npm run typecheck`.
2. Bump `version` in `package.json`, commit, tag: `git tag v1.1.0 && git push --tags`.
3. In each app that wants it: `npm install git+https://github.com/OnDesk-cc/shared.git#v1.1.0`,
   run its typecheck + build, open its PR.

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
