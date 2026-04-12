insert into public.families (id, name)
values ('8f7c91f2-6e6c-4e63-81ef-0f5810a03e1e', 'Cohnobi')
on conflict (id) do nothing;

-- Profiles depend on auth.users rows in a real Supabase instance; seed here is illustrative.
