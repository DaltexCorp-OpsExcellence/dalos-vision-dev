-- shipments_v2_int_thousands_fix — APPLIED 2026-10-12 (follow-up to shipments_v2_hardening)
-- Whole-number fields (cartons/pallets/punnets/jumbo/sack): a comma can only be a
-- thousands separator ("1,664" = 1664). Strip ',' (and the Arabic thousands sep)
-- before parsing, so _shipments_v2_num's decimal-comma rule never applies here.
create or replace function public._shipments_v2_int(p text, p_field text default 'value')
returns int language plpgsql immutable set search_path = public as $$
declare n numeric := public._shipments_v2_num(replace(replace(coalesce(p,''), ',', ''), '٬', ''), p_field);
begin
  if n is null then return null; end if;
  if n <> trunc(n) then
    raise exception '% must be a whole number: "%"', p_field, p using errcode = '22P02';
  end if;
  return n::int;
end $$;
revoke all on function public._shipments_v2_int(text, text) from public, anon, authenticated;
