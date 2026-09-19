# @ondesk/shared — documentación

**El código que es idéntico en los seis productos.** Cada producto es su propio
repositorio y se despliega por su cuenta; este paquete es lo que evita que
carguen seis copias byte a byte del mismo archivo.

No es una librería más: **aquí vive el middleware de autenticación de los seis
productos**. Un arreglo en la ruta de auth se hace aquí y llega a todos a la vez.

---

## Empieza por aquí

| Quiero… | Ve a |
|---|---|
| saber qué hay dentro y dónde | [modulos.md](modulos.md) |
| consumirlo, publicarlo, y las reglas de qué entra | [uso.md](uso.md) |
| el texto original con el razonamiento completo | [decisiones.md](decisiones.md) |
| saber qué está pendiente | [pendiente.md](pendiente.md) |

---

## Las cuatro cosas que hay que saber

**1. Envía TypeScript crudo.** No hay paso de compilación. El bundler de la app
que lo consume (Vite para `src/`, wrangler para `functions/`) lo compila, y el
`tsc` de la app lo comprueba como parte de su propio programa.

**2. Hay una frontera de tipos dentro del paquete.** `ui/`, `lib/`, `hooks/`,
`components/`, `calls/` y `presence/` asumen el DOM; `worker/` asume
`@cloudflare/workers-types`.

> **Nunca importes cruzando esa línea.** Los dos universos de tipos no se ponen
> de acuerdo sobre los mismos nombres globales, y por eso hay dos `tsconfig`
> aquí y dos en cada app.

**3. El pin es a un TAG de git, no a master.**

```json
"dependencies": {
  "@ondesk/shared": "git+https://github.com/OnDesk-cc/shared.git#v1.4.0"
}
```

> ⚠️ **Un commit empujado sin tag rompió el CI de los seis productos a la vez.**
> Y `npm install` no vuelve a resolver un tag por su cuenta: hay que pedírselo
> explícitamente (`npm install pkg@git+…#tag`).

**4. Tailwind v4 no escanea `node_modules`.** Cada app lleva en su `index.css`:

```css
@source "../node_modules/@ondesk/shared";
```

Sin esa línea **todo componente compartido se renderiza sin estilos y no falla
nada**.

---

## Quién depende de esto

Los seis productos (`pulse`, `vault`, `orbit`, `nexus`, `halo`, `atlas`) y el
control plane (`ondesk`). Siete repositorios.

**Cualquier cambio aquí es un cambio en siete sitios.** Por eso las apps fijan un
tag y suben cuando quieren, en vez de seguir a master.

---

## Para una IA que llega a este repo

1. **Antes de arreglar un bug de autenticación en un producto, mira si el arreglo
   va aquí.** `worker/middleware.ts` es el middleware de los seis. Arreglarlo en
   el producto es crear la séptima copia del bug.
2. **Sólo entra lo genuinamente idéntico.** Algo que necesite un
   `if (app === "halo")` pertenece a la app, o hay que parametrizarlo **antes**
   de moverlo aquí.
3. **Las dependencias de runtime son `peerDependencies`, nunca `dependencies`.**
   Una segunda copia de React dentro de `node_modules/@ondesk/shared/` rompe
   todos los hooks.
4. Publicar es tag + bump; el procedimiento está en [uso.md](uso.md#publicar).

---

**El mapa de los 15 proyectos de la plataforma** está en
[`ondesk/docs/plataforma.md`](../../ondesk/docs/plataforma.md).
