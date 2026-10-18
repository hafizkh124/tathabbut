-- Supabase's security advisor: rls_auto_enable() (an event-trigger function, SECURITY DEFINER, made by Supabase's dashboard,
-- not by these migrations) could be called through the API by the public key. It runs from its event trigger, which needs
-- no EXECUTE grant, so the API roles lose it. Applied to the live project on 2026-10-19; skipped where the function is absent.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
