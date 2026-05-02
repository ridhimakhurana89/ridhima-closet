import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, PHOTOS_BUCKET } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = [
  "name",
  "category",
  "subcategory",
  "description",
  "color_primary",
  "color_family",
  "silhouette",
  "length",
  "formality",
  "tags",
  "flatters_me",
] as const;

type Patch = Partial<Record<(typeof ALLOWED_FIELDS)[number], unknown>>;

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as Patch;

  const update: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data, error } = await getSupabaseAdmin()
    .from("items")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: row, error: fetchError } = await supabase
    .from("items")
    .select("photo_url")
    .eq("id", id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 404 });

  const marker = `/${PHOTOS_BUCKET}/`;
  const idx = row.photo_url?.indexOf(marker) ?? -1;
  if (idx >= 0) {
    const path = row.photo_url.substring(idx + marker.length);
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
  }

  const { error: deleteError } = await supabase.from("items").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
