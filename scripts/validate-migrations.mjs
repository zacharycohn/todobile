import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const requiredSnippets = [
  "create table public.families",
  "create table public.profiles",
  "create table public.tasks",
  "create table public.devices",
  "alter table public.tasks enable row level security",
  "create policy \"family members can read family tasks\""
];

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const files = (await readdir(migrationsDir)).filter((file) => file.endsWith(".sql"));

if (files.length === 0) {
  throw new Error("No SQL migrations found in supabase/migrations");
}

const contents = (await Promise.all(files.map((file) => readFile(join(migrationsDir, file), "utf8")))).join("\n");

for (const snippet of requiredSnippets) {
  if (!contents.includes(snippet)) {
    throw new Error(`Missing required migration snippet: ${snippet}`);
  }
}

console.log(`Validated ${files.length} migration file(s).`);
