# Pendiente — @ondesk/shared

> El estado de despliegue **no se deduce del repositorio**. Lo marcado
> **«confirmar»** viene de las notas de trabajo.

_Última revisión: 2026-09-22._

## Abierto

| Qué | Detalle | Confirmar |
|---|---|---|
| **Pasar el repo a privado** | Está marcado como "tratar como privado" pero **sigue siendo público**. Cambiarlo **rompe el CI de los seis a la vez** si no se ha puesto antes el paso del PAT. Ver [uso.md](uso.md#pasarlo-a-privado-rompe-los-seis-a-la-vez) | sí |
| **`v1.5.0` sin publicar** | Los seis productos **esperan** `v1.5.0` para las horas de trabajo por membresía. Mientras no salga el tag, esa función no puede desplegarse | **sí** |
| **~47k líneas todavía duplicadas** | Del audit de limpieza: se quitaron ~4,4k líneas, pero queda mucho código repetido entre productos que debería estar aquí. Este repo existe para eso y el trabajo está a medias | no |

## Trampas del terreno

| Trampa | Síntoma |
|---|---|
| **Empujar un commit sin tag** | Rompió el CI de los seis productos a la vez. El pin es al tag |
| **Esperar que `npm install` recoja un tag** | No lo hace solo. Hay que pedirlo explícitamente con `pkg@git+…#tag` |
| **Olvidar `@source` en la app** | Cada componente compartido se renderiza **sin estilos**, y no falla nada |
| **Importar cruzando la frontera** | `ui/` ↔ `worker/`. Los dos universos de tipos declaran los mismos globales con formas distintas |
| **Poner una dependencia de runtime en `dependencies`** | Segunda copia de React en `node_modules/@ondesk/shared/` → todos los hooks rotos |

## Candidatos a entrar aquí

Cosas que hoy están duplicadas y que **cumplen la regla** (idénticas, sin
`if (app === …)`):

- El guard que resuelve el workspace **desde el recurso** en vez de desde la
  query — hoy Pulse lo hace a mano en 19 rutas y se deja permisos y derecho por
  el camino. Ver
  [`pulse/docs/pendiente.md`](../../pulse/docs/pendiente.md#asimetría-de-autorización-entre-colección-y-recurso).
- El tratamiento responsive de consola (`useScrollRow`, `TwoPane open/onBack`,
  diálogos con alto máximo), hoy sólo en `admin`.

## Cómo cerrar una fila de aquí

Bórrala en el mismo commit. Si el cambio es del paquete, **acuérdate del tag**:
sin tag, ninguna app lo verá.
