import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("user_preferences")
    .select("id, color_season, body_notes, style_rules, no_go_rules, voice_tone, profile_answers, profile_updated_at")
    .limit(1)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const answers = body.profile_answers as Record<string, unknown> | undefined;
  if (!answers || typeof answers !== "object") {
    return NextResponse.json({ error: "profile_answers must be an object" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: existing, error: fetchError } = await supabase
    .from("user_preferences")
    .select("id, profile_answers")
    .limit(1)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });

  const merged = { ...(existing.profile_answers || {}), ...answers };

  const { data, error } = await supabase
    .from("user_preferences")
    .update({
      profile_answers: merged,
      profile_updated_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}
