-- ============================================================================
-- DalOS Vision — CRM module schema  (REVIEW COPY — not yet applied)
-- Additive only: creates NEW crm_* / region_* objects. Touches no existing
-- table or data. RLS-first + anon revoked → tables are locked from creation.
-- Region-scoped RLS validated by rollback-transaction role-simulation
-- (anon blocked, member sees own region, admin sees all).
-- Apply as named migrations in a quiet window, then re-verify with SELECTs.
-- ============================================================================

-- ── Regions (from "Regions 2026.xlsx": Reporting Region + CRM owner, 1:1) ──
create table if not exists regions (
  id     text primary key,
  label  text not null,
  owner  text,                       -- CRM person/team
  is_bucket boolean default false    -- 'unassigned' admin bucket
);
insert into regions(id,label,owner,is_bucket) values
  ('ne','Northern Europe','Amer_EUR',false),
  ('ga','Gulf & Asia','Abeer',false),
  ('cis','Russia & CIS','RANDA',false),
  ('uk','UK','Amer-UK',false),
  ('go','Greece & other','Safaa',false),
  ('unassigned','Unassigned',null,true)
on conflict (id) do nothing;

-- Country → region default (44 uniquely-mapped countries; 13 overlaps omitted
-- deliberately → they resolve to Unassigned until an override rule is set).
create table if not exists region_country_map (
  country_lc text primary key,       -- lower(trim(country))
  region_id  text not null references regions(id)
);
insert into region_country_map(country_lc,region_id) values
 ('argentina','cis'),('belarus','cis'),('brazil','cis'),('costa rica','cis'),('croatia','cis'),
 ('curacao','cis'),('czechia','cis'),('guatemala','cis'),('latvia','cis'),('lithuania','cis'),
 ('mauritius','cis'),('poland','cis'),('reunion','cis'),('romania','cis'),('ukraine','cis'),('vaietnam','cis'),
 ('belgium','ne'),('denmark','ne'),('finland','ne'),('france','ne'),('germany','ne'),('italy','ne'),
 ('netherlands','ne'),('norway','ne'),('portugal','ne'),('sweden','ne'),('switzerland','ne'),
 ('australia','ga'),('china','ga'),('hong kong','ga'),('india','ga'),('indonsia','ga'),('jaban','ga'),
 ('malaysia','ga'),('malta','ga'),('new zealand','ga'),('singapore','ga'),('south sudan','ga'),('vietnam','ga'),
 ('ireland','uk'),('uk','uk'),
 ('greece','go'),('kazakhstan','go'),('lebanon','go')
on conflict (country_lc) do nothing;

-- Overrides — THE place assignments get overwritten (admin "Region mapping").
-- Cascade priority: shipment > client > country-override > country default > Unassigned.
create table if not exists region_overrides (
  scope     text not null check (scope in ('country','client','shipment')),
  key       text not null,           -- lower(country) | client name | container voyage key
  region_id text not null references regions(id),
  set_by    uuid,
  set_at    timestamptz default now(),
  primary key (scope,key)
);

-- Region membership — a user can span several regions; admins/commercial see all.
create table if not exists region_members (
  user_id   uuid not null,
  region_id text not null references regions(id),
  primary key (user_id,region_id)
);

-- ── Resolver: region on the fly, never stored on shipments ──
create or replace function resolve_shipment_region(p_container text, p_client text, p_country text)
returns text language sql stable security definer set search_path=public as $$
  select coalesce(
    (select region_id from region_overrides where scope='shipment' and key=upper(regexp_replace(trim(p_container),'\s+',' ','g'))),
    (select region_id from region_overrides where scope='client'   and key=p_client),
    (select region_id from region_overrides where scope='country'  and key=lower(trim(p_country))),
    (select region_id from region_country_map where country_lc=lower(trim(p_country))),
    'unassigned'
  );
$$;

-- ── Access helpers ──
create or replace function crm_is_admin() returns boolean
  language sql stable security definer set search_path=public as $$
  select exists(select 1 from users u where u.id=auth.uid()
                and u.role in ('admin','power_user') and coalesce(u.active,true));
$$;
create or replace function crm_user_regions() returns setof text
  language sql stable security definer set search_path=public as $$
  select region_id from region_members where user_id=auth.uid();
$$;

-- ── Canonical quality bands (raw score text → 1..5; unmapped → NULL/Unclassified) ──
create table if not exists crm_score_bands (raw_lc text primary key, band int not null check (band between 1 and 5));
create or replace function score_band(p_raw text) returns int
  language sql immutable set search_path=public as $$
  select band from crm_score_bands where raw_lc = lower(trim(p_raw));
$$;

-- ── Claims ──
create table if not exists crm_claims (
  id             uuid primary key default gen_random_uuid(),
  claim_ref      text unique,                 -- CLM-2026-XXXX
  season_id      uuid,
  product_id     text,
  container_number text not null,
  voyage_key     text,                         -- normalize(container)+load-date cluster
  client         text,
  sub_client     text,
  country        text,
  region_id      text references regions(id),  -- resolved at write (for RLS)
  bl_number      text not null,
  scope          text check (scope in ('whole','part')) default 'whole',
  status         text check (status in ('open','closed','cancelled')) default 'open',
  potential      boolean default false,
  reason         text,
  claimed_value  numeric, claimed_currency text,
  settled_value  numeric, settled_currency text,
  resolution_type text,
  claimant_name  text, claimant_email text, client_ref text,
  cqc_report_id  uuid,                          -- the quality evidence
  raised_at      timestamptz default now(),
  response_deadline date,
  closed_at      timestamptz, closed_by uuid,
  created_by     uuid, notes text
);
create table if not exists crm_claim_rows (   -- claim ↔ affected composition rows
  claim_id uuid references crm_claims(id) on delete cascade,
  ship_container text, ship_carta text, variety text, farm text, packhouse text,
  cartons int, net_kg numeric
);
create table if not exists crm_claim_events ( -- audit trail
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references crm_claims(id) on delete cascade,
  event text, detail text, actor uuid, at timestamptz default now()
);
create table if not exists crm_claim_files (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid references crm_claims(id) on delete cascade,
  name text, storage_path text, content_type text, uploaded_by uuid, at timestamptz default now()
);

-- ── CRM gradings (no-CQC containers) ──
create table if not exists crm_gradings (
  id uuid primary key default gen_random_uuid(),
  grade_ref text unique,                        -- CRM-GRD-2026-XXXX
  season_id uuid, product_id text,
  container_number text not null, voyage_key text,
  client text, country text, region_id text references regions(id),
  grade text check (grade in ('A','B','C')),
  cause text, comments text,
  graded_by uuid, graded_at timestamptz default now()
);

-- resolve + stamp region_id on claim/grading write
create or replace function crm_stamp_region() returns trigger
  language plpgsql security definer set search_path=public as $$
begin
  new.region_id := resolve_shipment_region(new.container_number, new.client, new.country);
  return new;
end $$;
create trigger crm_claims_region   before insert or update on crm_claims   for each row execute function crm_stamp_region();
create trigger crm_gradings_region before insert or update on crm_gradings for each row execute function crm_stamp_region();

-- ── RLS: region-scoped read; write for members of the region or admins ──
alter table crm_claims   enable row level security;
alter table crm_gradings enable row level security;
alter table crm_claim_rows   enable row level security;
alter table crm_claim_events enable row level security;
alter table crm_claim_files  enable row level security;
alter table region_members   enable row level security;
alter table region_overrides enable row level security;

revoke all on crm_claims, crm_gradings, crm_claim_rows, crm_claim_events, crm_claim_files,
              regions, region_country_map, region_overrides, region_members, crm_score_bands
       from anon;
grant select on regions, region_country_map to authenticated;
grant select, insert, update on crm_claims, crm_gradings to authenticated;
grant select, insert, update, delete on crm_claim_rows, crm_claim_events, crm_claim_files to authenticated;

create policy claims_region on crm_claims for select to authenticated
  using (crm_is_admin() or region_id in (select crm_user_regions()));
create policy claims_write on crm_claims for insert to authenticated
  with check (crm_is_admin() or region_id in (select crm_user_regions()));
create policy claims_update on crm_claims for update to authenticated
  using (crm_is_admin() or region_id in (select crm_user_regions()));

create policy grad_region on crm_gradings for select to authenticated
  using (crm_is_admin() or region_id in (select crm_user_regions()));
create policy grad_write on crm_gradings for all to authenticated
  using (crm_is_admin() or region_id in (select crm_user_regions()))
  with check (crm_is_admin() or region_id in (select crm_user_regions()));

-- child tables inherit visibility via their parent claim's region
create policy claim_rows_via_parent on crm_claim_rows for all to authenticated
  using (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))))
  with check (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))));
create policy claim_events_via_parent on crm_claim_events for all to authenticated
  using (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))))
  with check (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))));
create policy claim_files_via_parent on crm_claim_files for all to authenticated
  using (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))))
  with check (exists(select 1 from crm_claims c where c.id=claim_id and (crm_is_admin() or c.region_id in (select crm_user_regions()))));

-- region admin tables: read for authenticated, write admin-only
create policy members_read on region_members for select to authenticated using (user_id=auth.uid() or crm_is_admin());
create policy members_admin on region_members for all to authenticated using (crm_is_admin()) with check (crm_is_admin());
create policy overrides_read on region_overrides for select to authenticated using (true);
create policy overrides_admin on region_overrides for all to authenticated using (crm_is_admin()) with check (crm_is_admin());

grant execute on function resolve_shipment_region(text,text,text), crm_is_admin(), crm_user_regions(), score_band(text) to authenticated;

-- NOTE (build follow-ups, not blocking):
--  • crm_voyages view (normalize container + loading-date ±7d cluster; join inspections/CQC) — 8 citrus reuse cases need the date cluster; grapes clean.
--  • re-resolve region_id on claims/gradings when an override changes (maintenance fn).
--  • seed crm_score_bands from the client_qc_reports score check-constraint vocabulary.
--  • NOTIFY pgrst,'reload schema' after apply.
