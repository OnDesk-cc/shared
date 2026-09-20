# @ondesk/shared

**El código idéntico en los seis productos de OnDesk y el control plane.** Cada
uno es su propio repositorio y se despliega por su cuenta; este paquete es lo que
evita que carguen siete copias byte a byte del mismo archivo.

Envía **TypeScript crudo**: no hay paso de build. El bundler de la app que lo
consume lo compila y su `tsc` lo comprueba.

## 📖 La documentación está en [`docs/`](docs/)

**Empieza por [`docs/README.md`](docs/README.md).**

| | |
|---|---|
| [modulos.md](docs/modulos.md) | qué hay dentro, y la frontera navegador ↔ worker |
| [uso.md](docs/uso.md) | consumirlo, publicarlo, y las reglas de qué entra |
| [pendiente.md](docs/pendiente.md) | lo abierto y las trampas |
| [decisiones.md](docs/decisiones.md) | el texto original, con el razonamiento completo |

## ⚠️ Aquí vive el middleware de los seis productos

`worker/middleware.ts` → `createMiddleware(product)`. El
`functions/_lib/middleware.ts` de cada producto son diez líneas de
configuración.

**Antes de arreglar un bug de autenticación en un producto, mira si el arreglo va
aquí.** Arreglarlo allí es crear la séptima copia del bug.

## ⚠️ El pin es a un TAG, no a master

```json
"@ondesk/shared": "git+https://github.com/OnDesk-cc/shared.git#v1.4.0"
```

Un commit empujado **sin tag** rompió el CI de los seis a la vez. Y `npm install`
no re-resuelve un tag por su cuenta: hay que pedírselo explícitamente.

## Publicar

```bash
npm run typecheck
# sube "version" en package.json, commit
git tag v1.5.0 && git push --tags
```

Luego, en cada app que lo quiera: cambia el tag, `npm install`, su typecheck y su
build. Detalle en [uso.md](docs/uso.md#publicar).

## Mantener los docs al día

```bash
npm run docs
npm run docs:check
```
