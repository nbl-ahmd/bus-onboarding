import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { z } from "zod";
import { authorize, sameOrigin } from "@/lib/server-auth";
const schema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  password: z.string().min(12).max(100),
});
export async function POST(request: NextRequest) {
  if (!sameOrigin(request))
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const auth = await authorize(request);
  if (!auth?.member || auth.member.role !== "admin")
    return Response.json(
      { error: "Fleet administrator access required." },
      { status: 403 },
    );
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key)
    return Response.json(
      {
        error:
          "Set SUPABASE_SERVICE_ROLE_KEY on the server to create driver accounts.",
      },
      { status: 503 },
    );
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      {
        error:
          "Provide a name, valid email and a password of at least 12 characters.",
      },
      { status: 400 },
    );
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
  });
  if (error || !data.user)
    return Response.json(
      { error: error?.message || "Could not create driver." },
      { status: 400 },
    );
  const { error: memberError } = await admin
    .from("fleet_members")
    .insert({
      user_id: data.user.id,
      fleet_id: auth.member.fleet_id,
      display_name: parsed.data.name,
      email: parsed.data.email,
      role: "driver",
    });
  if (memberError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return Response.json(
      { error: "Could not assign the driver to your fleet. Try again." },
      { status: 500 },
    );
  }
  return Response.json({
    id: data.user.id,
    fleetId: auth.member.fleet_id,
    name: parsed.data.name,
    email: parsed.data.email,
    role: "driver",
  });
}
