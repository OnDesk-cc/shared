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
