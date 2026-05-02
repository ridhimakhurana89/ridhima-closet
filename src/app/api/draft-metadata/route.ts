import { NextResponse } from "next/server";
import { getAnthropic, TAGGING_MODEL } from "@/lib/anthropic";

export const maxDuration = 60;

const SYSTEM_PROMPT = `You are tagging items in Ridhima's wardrobe so an AI stylist can use them.

For each clothing photo, output JSON with these fields:
- category: one of "top", "bottom", "outerwear", "dress", "shoes", "accessory"
- subcategory: short specific noun like "blouse", "jeans", "blazer", "midi-dress", "sneakers", "scarf"
- name: a 2-5 word descriptive name like "Rust copper satin shirt" or "Camel ribbed turtleneck"
- description: a 1-2 sentence longer description of the item for an AI stylist's context (fabric, notable details, vibe)
- color_primary: the dominant color in plain words like "rust", "espresso", "cream", "forest"
- color_family: one of "warm-deep" (rust, terracotta, espresso, mustard, burgundy, forest, camel, copper), "warm-light" (cream, peach, coral, soft gold), "cool-deep" (navy, charcoal, true black, jewel tones), "cool-light" (dusty pink, baby blue, mint, sage, icy pastels), "neutral" (true grey, true white, true black with no undertone)
- silhouette: short adjective like "drapey", "fitted", "oversized", "structured", "flowy", "tailored"
- length: for tops "cropped", "regular", "tunic"; for bottoms/dresses "mini", "knee", "midi", "maxi"; for shoes/accessories use "n/a"
- formality: integer 1-5 where 1=loungewear, 2=casual, 3=smart-casual, 4=polished/office, 5=formal
- tags: array of 3-6 short lowercase tags like ["satin", "office", "date-night", "buttondown"]
- flatters_me: boolean. true unless you're highly confident the item violates Ridhima's rules.

Ridhima's relevant rules for flatters_me=false:
- Cool pastels (dusty pink, baby blue, mint, sage) near the face wash her out
- Short hemlines above the knee don't suit her
- Anything tapering tightly at the hip is a no-go

Be honest and specific. If unsure, default to flatters_me=true and let her correct.

Return ONLY the JSON object, nothing else. No prose, no markdown, no code fences.`;

const METADATA_SCHEMA = {
  type: "object",
  properties: {
    category: { type: "string", enum: ["top", "bottom", "outerwear", "dress", "shoes", "accessory"] },
    subcategory: { type: "string" },
    name: { type: "string" },
    description: { type: "string" },
    color_primary: { type: "string" },
    color_family: { type: "string", enum: ["warm-deep", "warm-light", "cool-deep", "cool-light", "neutral"] },
    silhouette: { type: "string" },
    length: { type: "string" },
    formality: { type: "integer", minimum: 1, maximum: 5 },
    tags: { type: "array", items: { type: "string" } },
    flatters_me: { type: "boolean" },
  },
  required: [
    "category",
    "subcategory",
    "name",
    "description",
    "color_primary",
    "color_family",
    "silhouette",
    "length",
    "formality",
    "tags",
    "flatters_me",
  ],
  additionalProperties: false,
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { image_base64, media_type, category_hint } = body as {
      image_base64?: string;
      media_type?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
      category_hint?: string;
    };

    if (!image_base64 || !media_type) {
      return NextResponse.json({ error: "image_base64 and media_type required" }, { status: 400 });
    }

    const userText = category_hint
      ? `This item is being tagged in the "${category_hint}" batch. Use that as a strong hint for the category field unless the photo clearly shows otherwise.`
      : "Tag this clothing item.";

    const response = await getAnthropic().messages.create({
      model: TAGGING_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: METADATA_SCHEMA },
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type, data: image_base64 },
            },
            { type: "text", text: userText },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from Claude" }, { status: 500 });
    }

    const metadata = JSON.parse(textBlock.text);
    return NextResponse.json({ metadata, usage: response.usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
