-- Adds the 'guest' role (can sign in with just their email, book trips, and see trips).
alter table public.members drop constraint if exists members_role_check;
alter table public.members add constraint members_role_check check (role in ('owner','family','buddy','work','guest'));
