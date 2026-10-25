import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
export function signedPilotToken(expires: number) {
  return `${expires}.${createHmac("sha256", process.env.PILOT_ACCESS_CODE || "")
    .update(String(expires))
    .digest("hex")}`;
}
export function constantEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
export async function authorize(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (url && anon && bearer) {
    const db = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${bearer}` } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
    } = await db.auth.getUser(bearer);
    if (user) {
      const { data: member } = await db
        .from("fleet_members")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (member) return { user, member, db };
    }
  }
  const token = request.cookies.get("nightline-pilot")?.value;
  if (process.env.PILOT_ACCESS_CODE && token) {
    const expiry = Number(token.split(".")[0]);
    if (
      Number.isFinite(expiry) &&
      expiry > Date.now() &&
      constantEqual(token, signedPilotToken(expiry))
    )
      return { user: null, member: null, db: null };
  }
  return null;
}
export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  return (
    !origin ||
    origin === request.nextUrl.origin ||
    origin === `https://${request.headers.get("host")}`
  );
}
