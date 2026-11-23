-- Let's Roll database. Paste this whole file into Supabase → SQL Editor → Run.

-- Who is on the team. Only these emails can sign in and see anything.
create table if not exists public.members (
  email text primary key,
  role  text not null default 'family' check (role in ('owner','family','buddy')),
  name  text
);

-- Everything the app stores (trips, places, contacts, requests…) as small JSON documents.
create table if not exists public.docs (
  path       text primary key,          -- e.g. trips/2026-11-24, places/cpmed
  coll       text not null,             -- e.g. trips, places
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists docs_coll_idx on public.docs (coll);

alter table public.members enable row level security;
alter table public.docs    enable row level security;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

drop policy if exists "members: see the team" on public.members;
create policy "members: see the team" on public.members for select
  using (lower(email) = lower(auth.jwt() ->> 'email') or public.is_member());

drop policy if exists "docs: read"   on public.docs;
drop policy if exists "docs: insert" on public.docs;
drop policy if exists "docs: update" on public.docs;
drop policy if exists "docs: delete" on public.docs;
create policy "docs: read"   on public.docs for select using (public.is_member());
create policy "docs: insert" on public.docs for insert with check (public.is_member());
create policy "docs: update" on public.docs for update using (public.is_member()) with check (public.is_member());
create policy "docs: delete" on public.docs for delete using (public.is_member());

-- Live updates to every phone.
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- The team. Change or add emails here (owner = you, buddy = your driver, family = everyone else).
insert into public.members (email, role, name) values
  ('YOUR_EMAIL@gmail.com', 'owner', 'Boss'),
  ('BUDDY_EMAIL@gmail.com', 'buddy', 'Buddy')
on conflict (email) do update set role = excluded.role, name = excluded.name;
