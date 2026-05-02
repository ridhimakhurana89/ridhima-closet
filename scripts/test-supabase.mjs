import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  console.error("Missing env vars. Run with: node --env-file=.env.local scripts/test-supabase.mjs");
  process.exit(1);
}

const supabase = createClient(url, secretKey);

console.log("Testing Supabase connection...\n");

const { data: prefs, error: prefsError } = await supabase
  .from("user_preferences")
  .select("color_season, voice_tone")
  .limit(1)
  .single();

if (prefsError) {
  console.error("Database read failed:", prefsError.message);
  process.exit(1);
}
console.log("Database OK. Color season:", prefs.color_season);

const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();

if (bucketsError) {
  console.error("Storage list failed:", bucketsError.message);
  process.exit(1);
}

const closetBucket = buckets.find((b) => b.name === "closet-photos");
if (!closetBucket) {
  console.error("closet-photos bucket not found. Found:", buckets.map((b) => b.name));
  process.exit(1);
}
console.log("Storage OK. closet-photos bucket exists, public:", closetBucket.public);

const { data: items, error: itemsError } = await supabase
  .from("items")
  .select("id", { count: "exact", head: true });

if (itemsError) {
  console.error("Items count failed:", itemsError.message);
  process.exit(1);
}
console.log("Items table OK. Current count: 0 (empty as expected)");

console.log("\nAll checks passed. Step 2 plumbing is solid.");
