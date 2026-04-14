import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

describe("database migration contract", () => {
  const migrationFiles = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const sql = migrationFiles
    .map((file) => readFileSync(join("supabase/migrations", file), "utf8"))
    .join("\n");

  it("contains the required device uniqueness guarantees", () => {
    expect(sql).toContain("create unique index devices_push_token_uidx");
    expect(sql).toContain("create unique index devices_user_device_id_uidx");
  });

  it("contains task status consistency checks", () => {
    expect(sql).toContain("constraint tasks_status_timestamps_consistent");
  });

  it("defines family-membership helpers only after the profiles table exists", () => {
    const profilesIndex = sql.indexOf("create table public.profiles");
    const familyMemberFunctionIndex = sql.indexOf(
      "create or replace function public.is_family_member"
    );

    expect(profilesIndex).toBeGreaterThanOrEqual(0);
    expect(familyMemberFunctionIndex).toBeGreaterThan(profilesIndex);
  });

  it("broadcasts task changes over Supabase realtime", () => {
    expect(sql).toContain("create or replace function public.broadcast_task_changes()");
    expect(sql).toContain("create trigger broadcast_tasks_changes");
    expect(sql).toContain("realtime.broadcast_changes(");
    expect(sql).toContain("on realtime.messages");
  });
});
