import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { JWTVerifyGetKey } from 'jose';

/** Google's public keys for Firebase ID tokens. jose caches them between requests. */
export const googleKeys: JWTVerifyGetKey = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

/** The token from an `Authorization: Bearer <token>` header, or null. */
export function bearerToken(header: string | undefined): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(header?.trim() ?? '');
  return match?.[1] ?? null;
}

/**
 * The user's uid if `token` is a valid, unexpired Firebase ID token for this
 * project (spec section 7.2), otherwise null.
 */
export async function verifyFirebaseToken(
  token: string,
  projectId: string,
  keys: JWTVerifyGetKey,
): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    return null;
  }
}
