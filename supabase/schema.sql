-- Shared book. Access is limited to verified users on a private email allowlist.
create table if not exists public.recipe_books (
  id uuid primary key default gen_random_uuid(), name text not null
);
create table if not exists public.recipe_book_allowed_emails (
  email text primary key, book_id uuid not null references public.recipe_books(id)
);
create table if not exists public.recipe_book_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  book_id uuid not null references public.recipe_books(id)
);
create table if not exists public.recipe_book_entries (
  book_id uuid not null references public.recipe_books(id),
  kind text not null check (kind in ('overrides','favorites','basket','checked','photos')),
  item_key text not null check (length(item_key) between 1 and 250),
  value jsonb not null, revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key(book_id,kind,item_key)
);
alter table public.recipe_books enable row level security;
alter table public.recipe_book_allowed_emails enable row level security;
alter table public.recipe_book_members enable row level security;
alter table public.recipe_book_entries enable row level security;
revoke all on public.recipe_books,public.recipe_book_allowed_emails,public.recipe_book_members,public.recipe_book_entries from anon,authenticated;
grant select on public.recipe_book_members,public.recipe_book_entries to authenticated;
drop policy if exists "Read own membership" on public.recipe_book_members;
create policy "Read own membership" on public.recipe_book_members for select to authenticated using(user_id=(select auth.uid()));
drop policy if exists "Read shared entries" on public.recipe_book_entries;
create policy "Read shared entries" on public.recipe_book_entries for select to authenticated using(exists(select 1 from public.recipe_book_members m where m.user_id=(select auth.uid()) and m.book_id=recipe_book_entries.book_id));

create or replace function public.my_recipe_book() returns jsonb
language plpgsql security definer set search_path='' as $$
declare b public.recipe_books; user_email text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select lower(email) into user_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  select rb.* into b from public.recipe_books rb join public.recipe_book_allowed_emails a on a.book_id=rb.id where a.email=user_email;
  if b.id is null then raise exception 'Account is not allowed in this book' using errcode='42501'; end if;
  insert into public.recipe_book_members(user_id,book_id) values(auth.uid(),b.id) on conflict(user_id) do update set book_id=excluded.book_id;
  return jsonb_build_object('id',b.id,'name',b.name);
end $$;

create or replace function public.put_recipe_book_entry(p_book uuid,p_kind text,p_key text,p_value jsonb,p_expected integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_entry public.recipe_book_entries; exists_entry boolean;
begin
  if not exists(select 1 from public.recipe_book_members where user_id=auth.uid() and book_id=p_book) then raise exception 'Access denied' using errcode='42501';end if;
  if p_kind not in ('overrides','favorites','basket','checked','photos') or length(p_key) not between 1 and 250 or p_value is null or octet_length(p_value::text)>750000 then raise exception 'Invalid entry';end if;
  if p_value<>'null'::jsonb and ((p_kind in ('favorites','basket','checked') and jsonb_typeof(p_value)<>'boolean') or (p_kind='overrides' and jsonb_typeof(p_value)<>'object') or (p_kind='photos' and (jsonb_typeof(p_value)<>'string' or (p_value#>>'{}') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'))) then raise exception 'Invalid value';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_book::text||p_kind||p_key,0));
  select * into current_entry from public.recipe_book_entries where book_id=p_book and kind=p_kind and item_key=p_key;
  exists_entry=found;
  if exists_entry and current_entry.value=p_value then return jsonb_build_object('conflict',false,'entry',to_jsonb(current_entry));end if;
  if coalesce(current_entry.revision,0)<>p_expected then return jsonb_build_object('conflict',true,'entry',to_jsonb(current_entry));end if;
  insert into public.recipe_book_entries(book_id,kind,item_key,value,revision,updated_by) values(p_book,p_kind,p_key,p_value,1,auth.uid())
  on conflict(book_id,kind,item_key) do update set value=excluded.value,revision=recipe_book_entries.revision+1,updated_at=now(),updated_by=auth.uid() returning * into current_entry;
  return jsonb_build_object('conflict',false,'entry',to_jsonb(current_entry));
end $$;
revoke all on function public.my_recipe_book() from public,anon;
revoke all on function public.put_recipe_book_entry(uuid,text,text,jsonb,integer) from public,anon;
grant execute on function public.my_recipe_book() to authenticated;
grant execute on function public.put_recipe_book_entry(uuid,text,text,jsonb,integer) to authenticated;
-- Seed the book and two email addresses in the SQL editor, not in public Git.
