import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const encoder = new TextEncoder();
const secretKey = encoder.encode(env.JWT_SECRET);

export type GooglePendingPayload = {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
};

export async function signGooglePendingToken(payload: GooglePendingPayload): Promise<string> {
  return new SignJWT({
    type: "google_pending",
    googleId: payload.googleId,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secretKey);
}

export async function verifyGooglePendingToken(token: string): Promise<GooglePendingPayload> {
  const { payload } = await jwtVerify(token, secretKey);
  if (payload.type !== "google_pending") {
    throw new Error("Invalid Google sign-in session");
  }
  const googleId = payload.googleId;
  const email = payload.email;
  const name = payload.name;
  if (typeof googleId !== "string" || typeof email !== "string" || typeof name !== "string") {
    throw new Error("Google sign-in session expired. Please try again.");
  }
  return {
    googleId,
    email,
    name,
    picture: typeof payload.picture === "string" ? payload.picture : undefined,
  };
}
