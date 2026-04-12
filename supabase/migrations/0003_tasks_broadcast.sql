create or replace function public.broadcast_task_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family_id uuid := coalesce(new.family_id, old.family_id);
begin
  perform realtime.broadcast_changes(
    'family:' || target_family_id::text,
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );

  return null;
end;
$$;

drop trigger if exists broadcast_tasks_changes on public.tasks;

create trigger broadcast_tasks_changes
after insert or update or delete on public.tasks
for each row execute function public.broadcast_task_changes();

create policy "authenticated users can receive task broadcasts"
on realtime.messages
for select
to authenticated
using (true);
