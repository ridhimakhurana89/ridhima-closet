import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category");

  let query = getSupabaseAdmin()
    .from("items")
    .select("id, name, category, subcategory, description, silhouette, length, photo_url, color_primary, color_family, formality, flatters_me, tags, last_worn_date")
    .order("created_at", { ascending: false });

  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data });
}
