import { NextResponse } from "next/server";
import { isCloudSnapshotV1 } from "@/lib/cloud/snapshot-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Cloud sync is not configured." }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload =
    body && typeof body === "object" && "payload" in body
      ? (body as { payload: unknown }).payload
      : body;

  if (!isCloudSnapshotV1(payload)) {
    return NextResponse.json({ error: "Body must be a v1 snapshot or { payload }." }, { status: 400 });
  }

  const { error } = await supabase.from("user_collection_snapshots").upsert(
    {
      user_id: user.id,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
