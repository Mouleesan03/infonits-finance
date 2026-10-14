-- Publish workspace snapshot updates so signed-in devices receive changes immediately.
do $$
begin
  alter publication supabase_realtime add table public.local_workspaces;
exception
  when duplicate_object then null;
end
$$;
