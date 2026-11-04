import { createRemoteJWKSet, decodeJwt, jwtVerify } from "jose";

// Firebase ID tokens are JWTs signed by Google; these are the public keys.
const KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

// Returns { uid, email } for a valid Firebase ID token with a verified email in the Authorization
// header, or null. With FIREBASE_AUTH_EMULATOR set (local dev only), the
// emulator's unsigned tokens are accepted after the same claim checks.
export async function signedInUser(request, env) {
  const header = request.headers.get("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return null;
  const project = env.FIREBASE_PROJECT_ID;
  try {
    let claims;
    if (env.FIREBASE_AUTH_EMULATOR) {
      claims = decodeJwt(token);
      if (claims.iss !== `https://securetoken.google.com/${project}` || claims.aud !== project) return null;
      if (claims.exp * 1000 < Date.now()) return null;
    } else {
      ({ payload: claims } = await jwtVerify(token, KEYS, {
        issuer: `https://securetoken.google.com/${project}`,
        audience: project,
        algorithms: ["RS256"],
      }));
    }
    if (!claims.sub) return null;
    // Google and email-link accounts have a checked email. Password sign-up is
    // on only because Firebase needs it for email links; those accounts (made
    // straight through the API, unverified) get no AI messages.
    if (claims.email_verified !== true) return null;
    return { uid: claims.sub, email: claims.email || "" };
  } catch {
    return null;
  }
}
