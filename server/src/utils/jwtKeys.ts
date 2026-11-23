import jwt from 'jsonwebtoken';

/**
 * JWT secret rotation. New tokens are always signed with JWT_SECRET. Tokens signed with JWT_SECRET_OLD
 * (comma-separated list allowed) are still accepted, so changing the secret doesn't log everyone out at once.
 * Sessions last 30 days, so remove JWT_SECRET_OLD 30 days after a rotation. (docs/KEY_ROTATION.md)
 */
export const jwtVerifySecrets = (): string[] => {
  const current = process.env.JWT_SECRET;
  if (!current) throw new Error('Server misconfiguration: Missing JWT_SECRET');
  const old = String(process.env.JWT_SECRET_OLD || '').split(',').map(s => s.trim()).filter(Boolean);
  return [current, ...old.filter(s => s !== current)];
};

/** Verify with the current secret, then any old ones. Throws the original error if none match. */
export const verifyJwt = (token: string): any => {
  const secrets = jwtVerifySecrets();
  let firstErr: any;
  for (const s of secrets) {
    try { return jwt.verify(token, s); }
    catch (e: any) {
      if (!firstErr) firstErr = e;
      // an expired token is expired whatever the key — don't try the others
      if (e?.name === 'TokenExpiredError') throw e;
    }
  }
  throw firstErr;
};
