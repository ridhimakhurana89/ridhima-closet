import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
const { data } = await supabase.from("items").select("id, name, photo_url, created_at").ilike("name", "%mauve%").order("created_at");
console.log(JSON.stringify(data, null, 2));
