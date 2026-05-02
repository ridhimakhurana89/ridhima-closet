import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Missing env vars");
  process.exit(1);
}
const supabase = createClient(url, secretKey);
const BUCKET = "closet-photos";

const DRY_RUN = process.argv.includes("--dry-run");

const { data: rows, error } = await supabase
  .from("items")
  .select("id, name, photo_url, created_at")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

const grouped = new Map();
for (const row of rows) {
  if (!grouped.has(row.name)) grouped.set(row.name, []);
  grouped.get(row.name).push(row);
}

const toDelete = [];
const toKeep = [];
for (const [name, group] of grouped) {
  toKeep.push(group[0]);
  for (let i = 1; i < group.length; i++) toDelete.push(group[i]);
}

console.log(`Total rows: ${rows.length}`);
console.log(`Unique names: ${grouped.size}`);
console.log(`Will keep: ${toKeep.length}`);
console.log(`Will delete: ${toDelete.length}`);
console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "EXECUTE"}\n`);

if (DRY_RUN) {
  console.log("First 5 deletions that would happen:");
  for (const row of toDelete.slice(0, 5)) {
    console.log(`  delete row ${row.id}  name="${row.name}"`);
  }
  process.exit(0);
}

const photoPaths = toDelete
  .map((row) => {
    const marker = `/${BUCKET}/`;
    const idx = row.photo_url.indexOf(marker);
    return idx >= 0 ? row.photo_url.substring(idx + marker.length) : null;
  })
  .filter(Boolean);

console.log(`Deleting ${photoPaths.length} photos from Storage...`);
const chunkSize = 100;
for (let i = 0; i < photoPaths.length; i += chunkSize) {
  const chunk = photoPaths.slice(i, i + chunkSize);
  const { error: rmError } = await supabase.storage.from(BUCKET).remove(chunk);
  if (rmError) {
    console.error(`Storage remove failed at chunk ${i}:`, rmError.message);
    process.exit(1);
  }
  console.log(`  removed chunk ${i / chunkSize + 1} (${chunk.length} files)`);
}

console.log(`\nDeleting ${toDelete.length} rows from items table...`);
const idsToDelete = toDelete.map((r) => r.id);
const { error: delError } = await supabase.from("items").delete().in("id", idsToDelete);
if (delError) {
  console.error("Row delete failed:", delError.message);
  process.exit(1);
}

const { count } = await supabase.from("items").select("id", { count: "exact", head: true });
console.log(`\nDone. items table now has ${count} rows.`);
