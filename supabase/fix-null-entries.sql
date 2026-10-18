create or replace function public.put_recipe_book_entry(p_book uuid,p_kind text,p_key text,p_value jsonb,p_expected integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_entry public.recipe_book_entries; exists_entry boolean;
begin
  p_value:=coalesce(p_value,'null'::jsonb);
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
