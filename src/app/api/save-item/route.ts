import { NextResponse } from "next/server";
import { getSupabaseAdmin, PHOTOS_BUCKET } from "@/lib/supabase";

export const maxDuration = 30;

type ItemMetadata = {
  category: string;
  subcategory: string;
  name: string;
  description: string;
  color_primary: string;
  color_family: string;
  silhouette: string;
  length: string;
  formality: number;
  tags: string[];
  flatters_me: boolean;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image_base64, media_type, metadata } = body as {
      image_base64?: string;
      media_type?: string;
      metadata?: ItemMetadata;
    };

    if (!image_base64 || !media_type || !metadata) {
      return NextResponse.json({ error: "image_base64, media_type, and metadata required" }, { status: 400 });
    }

    const ext = media_type.split("/")[1] || "jpg";
    const filename = `${metadata.category}/${Date.now()}-${slugify(metadata.name)}.${ext}`;
    const photoBuffer = Buffer.from(image_base64, "base64");

    const { error: uploadError } = await getSupabaseAdmin().storage
      .from(PHOTOS_BUCKET)
      .upload(filename, photoBuffer, { contentType: media_type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: `Upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = getSupabaseAdmin().storage.from(PHOTOS_BUCKET).getPublicUrl(filename);
    const photoUrl = publicUrlData.publicUrl;

    const { data: inserted, error: insertError } = await getSupabaseAdmin()
      .from("items")
      .insert({
        category: metadata.category,
        subcategory: metadata.subcategory,
        name: metadata.name,
        description: metadata.description,
        color_primary: metadata.color_primary,
        color_family: metadata.color_family,
        silhouette: metadata.silhouette,
        length: metadata.length,
        formality: metadata.formality,
        tags: metadata.tags,
        flatters_me: metadata.flatters_me,
        photo_url: photoUrl,
      })
      .select()
      .single();

    if (insertError) {
      await getSupabaseAdmin().storage.from(PHOTOS_BUCKET).remove([filename]);
      return NextResponse.json({ error: `Insert failed: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ item: inserted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("items")
    .select("category", { count: "exact" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const c = (row as { category: string }).category;
    counts[c] = (counts[c] || 0) + 1;
  }
  return NextResponse.json({ total: data?.length || 0, by_category: counts });
}
