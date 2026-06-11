create or replace function public.prevent_deleted_sheet_lead_reinsert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d text;
begin
  d := regexp_replace(coalesce(new.client_phone, ''), '\D', '', 'g');
  if length(d) >= 6 and exists (
    select 1
    from public.sheet_lead_imports sli
    where sli.deleted_at is not null
      and (
        sli.phone_digits = d
        or right(sli.phone_digits, 9) = right(d, 9)
        or ('0' || right(sli.phone_digits, 9)) = d
        or ('61' || right(d, 9)) = sli.phone_digits
      )
  ) then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists pipeline_deals_prevent_deleted_sheet_lead_reinsert on public.pipeline_deals;
create trigger pipeline_deals_prevent_deleted_sheet_lead_reinsert
before insert on public.pipeline_deals
for each row execute function public.prevent_deleted_sheet_lead_reinsert();