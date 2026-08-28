/**
 * Cookie reading, and nothing else.
 *
 * The session cookie is minted by ondesk on `Domain=.ondesk.cc` and a product
 * only ever reads it — there is deliberately no serializer here, because a
 * product that can write `access_token` is a product that can drift out of
 * step with the platform session.
 */

export const ACCESS_TOKEN_COOKIE = "access_token";

/**
 * Parse a Cookie header string into a key-value map.
 */
export function parseCookies(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
}

/**
 * Every value the browser sent under one name, in header order.
 *
 * A name can legitimately appear twice during the shared-cookie migration: a
 * stale host-only cookie from the per-product-session era and the
 * Domain=.ondesk.cc one share a name but not a store key, and the browser
 * sends both. `parseCookies` keeps whichever comes last; session verification
 * needs to try each until one verifies.
 */
export function parseCookieValues(
  cookieHeader: string | null,
  name: string
): string[] {
  if (!cookieHeader) return [];
  const values: string[] = [];
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k.trim() === name) values.push(decodeURIComponent(v.join("=")));
  }
  return values;
}
