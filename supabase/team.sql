-- Lets the owner add and remove team members from inside the app (☰ → Team).
-- Paste into Supabase → SQL Editor → Run (once).
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('owner','family','buddy','work'));

create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email') and role = 'owner');
$$;

drop policy if exists "members: owner adds"    on public.members;
drop policy if exists "members: owner edits"   on public.members;
drop policy if exists "members: owner removes" on public.members;
create policy "members: owner adds"    on public.members for insert with check (public.is_owner());
create policy "members: owner edits"   on public.members for update using (public.is_owner()) with check (public.is_owner());
create policy "members: owner removes" on public.members for delete using (public.is_owner());
