/**
 * Las tres respuestas JSON que devuelve cualquier handler de Pages Functions.
 *
 * Están aquí y no en cada producto porque la FORMA del error es un contrato con
 * el frontend: un fallo siempre es `{ error: string }`, y `handleResponse` en
 * `lib/crud-api.ts` lo desempaqueta contando con eso. El día que un handler
 * conteste `{ message }` en vez de `{ error }`, el SPA enseña «undefined» en un
 * toast.
 *
 *   jsonOk       200 — lectura, o escritura sobre algo que ya existía.
 *   jsonCreated  201 — se creó una fila. El cuerpo lleva el recurso entero, no
 *                sólo su id, porque quien llama suele meterlo en la caché.
 *   jsonError    4xx/5xx, 400 por defecto.
 *
 * Ninguna pone cabeceras de CORS: eso es del middleware, que es quien sabe si el
 * origen que pregunta está en `CORS_ROOTS`.
 */
export function jsonOk<T>(
  data: T,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function jsonCreated<T>(
  data: T,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
