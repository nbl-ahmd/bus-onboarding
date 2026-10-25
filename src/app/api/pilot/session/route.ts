import { NextRequest, NextResponse } from "next/server";
import { constantEqual, sameOrigin, signedPilotToken } from "@/lib/server-auth";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const expected = process.env.PILOT_ACCESS_CODE;
  if (!expected || expected.length < 12)
    return Response.json(
      {
        error:
          "Configure a pilot access code of at least 12 characters on the server.",
      },
      { status: 503 },
    );
  const body = await request.json().catch(() => null);
  if (typeof body?.code !== "string" || !constantEqual(body.code, expected))
    return Response.json(
      { error: "Access code not recognized." },
      { status: 401 },
    );
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    "nightline-pilot",
    signedPilotToken(Date.now() + 12 * 3600_000),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 12 * 3600,
      path: "/",
    },
  );
  return response;
}
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("nightline-pilot");
  return response;
}
