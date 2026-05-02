import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing env vars");
  process.exit(1);
}
const supabase = createClient(url, secretKey);

const { data, error } = await supabase
  .from("items")
  .select("id, name, category, photo_url, created_at")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

console.log(`Total rows in items: ${data.length}\n`);

const byCategory = {};
const byName = {};
const byPhotoUrl = {};
for (const row of data) {
  byCategory[row.category] = (byCategory[row.category] || 0) + 1;
  byName[row.name] = (byName[row.name] || 0) + 1;
  byPhotoUrl[row.photo_url] = (byPhotoUrl[row.photo_url] || 0) + 1;
}

console.log("By category:", byCategory);

const dupNames = Object.entries(byName).filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
console.log(`\nDuplicate names: ${dupNames.length}`);
for (const [name, count] of dupNames.slice(0, 20)) {
  console.log(`  ${count}x  "${name}"`);
}

const dupPhotos = Object.entries(byPhotoUrl).filter(([, n]) => n > 1);
console.log(`\nDuplicate photo URLs (same exact URL saved multiple times): ${dupPhotos.length}`);
