import { OAuth2Client } from "google-auth-library";

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified: boolean;
};

export function getGoogleClientId(): string {
  const id = (process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!id) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  return id;
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile> {
  const clientId = getGoogleClientId();
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: clientId,
  });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error("Invalid Google account information");
  }

  return {
    googleId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || payload.email.split("@")[0] || "User",
    picture: payload.picture,
    emailVerified: payload.email_verified === true,
  };
}
