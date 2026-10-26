-- =====================================================================
-- ELV Project Tracker — Supabase schema
-- Run this whole file once in Supabase: SQL Editor → New query → Run.
-- Then change the admin email at the very bottom if needed.
-- All permission checks happen in this file (database side), so they
-- hold no matter what a browser sends.
-- =====================================================================

-- gen_random_uuid() is built into Postgres 13+

-- ---------- tables (no direct access; everything goes through functions) ----------
create table if not exists public.admins(
  email text primary key check (email = lower(email))
);

create table if not exists public.profiles(
  id uuid primary key,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.projects(
  id uuid primary key default gen_random_uuid(),
  name text not null,
  client text default '',
  location text default '',
  start_date text default '',
  target text default '',
  status text not null default 'Active',
  completed_at text default '',
  deleted_at timestamptz,
  deleted_by_name text,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.project_members(
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null check (email = lower(email)),
  levels jsonb not null default '{}'::jsonb,
  added_at timestamptz not null default now(),
  primary key (project_id, email)
);

create table if not exists public.items(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  ord int not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by_name text
);
create index if not exists items_project on public.items(project_id, ord);

create table if not exists public.item_rates(
  item_id uuid primary key references public.items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  w numeric, p numeric
);

create table if not exists public.lots(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  kind text not null,
  bill text not null default 'material' check (bill in ('material','installation')),
  qty numeric not null check (qty > 0),
  date text default '',
  ref text default '',
  note text default '',
  status text not null check (status in ('approved','pending','rejected','removed')),
  direct boolean not null default false,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  decided_by_name text, decided_at timestamptz, decision_note text default '',
  deleted boolean not null default false
);
create index if not exists lots_project on public.lots(project_id);
alter table public.lots drop constraint if exists lots_kind_check;
alter table public.lots add constraint lots_kind_check check (kind in ('delivery','install','testing','commission','handover','billing'));

create table if not exists public.changes(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  cat text not null check (cat in ('data','status')),
  changes jsonb not null,
  before jsonb not null default '{}'::jsonb,
  note text default '',
  status text not null check (status in ('approved','pending','rejected')),
  direct boolean not null default false,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  decided_by_name text, decided_at timestamptz, decision_note text default ''
);
create index if not exists changes_project on public.changes(project_id);

create table if not exists public.documents(
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sec text not null,
  system text default '', title text default '', no text default '', rev text default '',
  date text default '', note text default '',
  file_path text not null unique, file_name text not null, size bigint default 0, ext text default '',
  status text not null check (status in ('approved','pending','rejected','removed')),
  direct boolean not null default false,
  created_by uuid, created_by_name text, created_at timestamptz not null default now(),
  decided_by_name text, decided_at timestamptz, decision_note text default '',
  deleted boolean not null default false
);
create index if not exists documents_project on public.documents(project_id);
alter table public.documents drop constraint if exists documents_sec_check;
alter table public.documents add constraint documents_sec_check check (sec in ('drawing','tds','letter','challan','rabill','invoice','testcert'));

create table if not exists public.activity(
  id bigserial primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid,
  cat text,
  at timestamptz not null default now(),
  by_name text,
  text text not null
);
create index if not exists activity_project on public.activity(project_id, at desc);

alter table public.admins enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.items enable row level security;
alter table public.item_rates enable row level security;
alter table public.lots enable row level security;
alter table public.changes enable row level security;
alter table public.documents enable row level security;
alter table public.activity enable row level security;

-- ---------- identity helpers ----------
create or replace function public.me_email() returns text
language sql stable as $$ select lower(coalesce(auth.jwt()->>'email','')) $$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists(select 1 from admins where email = me_email())
$$;

create or replace function public.my_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif((select name from profiles where id = auth.uid()),''), me_email())
$$;

-- permission level of the current user for one area of one project:
-- 'admin' | 'edit' | 'request' | 'none' (only see) | 'hide' (no access)
create or replace function public.lvl(pid uuid, cat text) returns text
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then return 'hide'; end if;
  if is_admin() then return 'admin'; end if;
  select levels->>cat into v from project_members m join projects p on p.id = m.project_id
   where m.project_id = pid and m.email = me_email() and p.deleted_at is null;
  return coalesce(v, 'hide');
end $$;

create or replace function public.can_see(pid uuid, cat text) returns boolean
language sql stable security definer set search_path = public as $$
  select lvl(pid, cat) in ('admin','edit','request','none') $$;

create or replace function public.can_write(pid uuid, cat text) returns boolean
language sql stable security definer set search_path = public as $$
  select lvl(pid, cat) in ('admin','edit','request') $$;

create or replace function public.is_member(pid uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare c text;
begin
  if is_admin() then return true; end if;
  foreach c in array array['data','status','delivery','install','testing','commission','handover','billing','docs'] loop
    if lvl(pid, c) <> 'hide' then return true; end if;
  end loop;
  return false;
end $$;

-- item fields per area
create or replace function public.cat_keys(cat text) returns text[]
language sql immutable as $$
  select case cat
    when 'base'     then array['section','sr','desc','qty','unit','woQty','header']
    when 'data'     then array['make','model','vendor','poDate','contractor']
    when 'status'   then array['drawing','drawingDate','tds','tdsDate','expStatus','pendingReason','delayReason','remarks']
    when 'delivery' then array['delivered','deliveryDate']
    when 'install'  then array['installed','installDate']
    when 'testing'  then array['tested','testDate']
    when 'commission' then array['commissioned','commissionDate']
    when 'handover' then array['handedOver','handoverDate']
    when 'billing'  then array['billMat','billMatDate','billInst','billInstDate']
    else array[]::text[] end $$;

-- fields a person may change through an update request
create or replace function public.edit_keys(cat text) returns text[]
language sql immutable as $$
  select case cat
    when 'data'   then array['section','sr','desc','qty','unit','woQty','make','model','vendor','poDate','contractor']
    when 'status' then cat_keys('status')
    else array[]::text[] end $$;

create or replace function public.doc_sec_ok(pid uuid, sec text) returns boolean
language sql stable security definer set search_path = public as $$
  select can_see(pid,'docs') and case sec when 'challan' then can_see(pid,'delivery')
                                         when 'rabill' then can_see(pid,'billing')
                                         when 'invoice' then can_see(pid,'billing')
                                         when 'testcert' then can_see(pid,'testing') else true end $$;

create or replace function public.mask_item(pid uuid, d jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare allowed text[] := cat_keys('base'); c text; out jsonb;
begin
  if is_admin() then return d; end if;
  foreach c in array array['data','status','delivery','install','testing','commission','handover','billing'] loop
    if can_see(pid, c) then allowed := allowed || cat_keys(c); end if;
  end loop;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into out from jsonb_each(d) where key = any(allowed);
  return out;
end $$;

create or replace function public.log_act(pid uuid, txt text, cat text default null, iid uuid default null) returns void
language sql security definer set search_path = public as $$
  insert into activity(project_id, item_id, cat, by_name, text) values (pid, iid, cat, my_name(), left(txt, 2000)) $$;

create or replace function public.need_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin if not is_admin() then raise exception 'Only admins can do this.' using errcode = '42501'; end if; end $$;

-- ---------- profiles ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles(id, email, name) values (new.id, lower(new.email), coalesce(new.raw_user_meta_data->>'name',''))
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.whoami() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return null; end if;
  insert into profiles(id, email) values (auth.uid(), me_email()) on conflict (id) do nothing;
  return jsonb_build_object('id', auth.uid(), 'email', me_email(), 'name', (select name from profiles where id = auth.uid()), 'admin', is_admin());
end $$;

create or replace function public.set_my_name(n text) returns void
language sql security definer set search_path = public as $$
  update profiles set name = left(trim(n), 120) where id = auth.uid() $$;

-- ---------- reading ----------
create or replace function public.my_projects() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(p) - 'created_by' || jsonb_build_object('levels',
      case when is_admin() then '{}'::jsonb else (select levels from project_members m where m.project_id = p.id and m.email = me_email()) end)
      order by p.name)
    from projects p
    where (is_admin()) or (p.deleted_at is null and is_member(p.id))
  ), '[]'::jsonb);
end $$;

create or replace function public.project_data(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare adm boolean := is_admin(); uid uuid := auth.uid(); lv jsonb; res jsonb;
begin
  if not is_member(pid) then raise exception 'You don''t have access to this project.' using errcode = '42501'; end if;
  select jsonb_object_agg(c, lvl(pid, c)) into lv from unnest(array['data','status','delivery','install','testing','commission','handover','billing','docs']) c;
  res := jsonb_build_object(
    'project', (select to_jsonb(p) - 'created_by' from projects p where id = pid),
    'admin', adm,
    'levels', lv,
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'ord', i.ord, 'updatedAt', i.updated_at, 'updatedBy', i.updated_by_name) || mask_item(pid, i.data) order by i.ord) from items i where i.project_id = pid), '[]'::jsonb),
    'rates', case when adm then coalesce((select jsonb_object_agg(item_id, jsonb_build_object('w', w, 'p', p)) from item_rates where project_id = pid), '{}'::jsonb) else '{}'::jsonb end,
    'lots', coalesce((select jsonb_agg(to_jsonb(l) - 'created_by' || jsonb_build_object('mine', l.created_by = uid) order by l.created_at)
                        from lots l where l.project_id = pid and not l.deleted and can_see(pid, l.kind)
                         and (adm or l.status = 'approved' or l.created_by = uid)), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(to_jsonb(c) - 'created_by' || jsonb_build_object('mine', c.created_by = uid) order by c.created_at)
                        from changes c where c.project_id = pid and can_see(pid, c.cat) and (adm or c.created_by = uid)), '[]'::jsonb),
    'docs', coalesce((select jsonb_agg(to_jsonb(d) - 'created_by' || jsonb_build_object('mine', d.created_by = uid) order by d.created_at)
                        from documents d where d.project_id = pid and not d.deleted and doc_sec_ok(pid, d.sec)
                         and (adm or d.status = 'approved' or d.created_by = uid)), '[]'::jsonb),
    'activity', coalesce((select jsonb_agg(to_jsonb(a) order by a.at desc) from (
                          select * from activity a where a.project_id = pid and (a.cat is null or can_see(pid, a.cat)) order by a.at desc limit 300) a), '[]'::jsonb)
  );
  return res;
end $$;

-- ---------- lots ----------
create or replace function public.add_lot(pid uuid, iid uuid, kind text, qty numeric, d text, ref text, note text, bill text default 'material')
returns jsonb language plpgsql security definer set search_path = public as $$
declare l text := lvl(pid, kind); st text; newid uuid; lbl text;
begin
  if l not in ('admin','edit','request') then raise exception 'You can''t record this.' using errcode = '42501'; end if;
  if not exists(select 1 from items where id = iid and project_id = pid) then raise exception 'Item not found.'; end if;
  if qty is null or qty <= 0 then raise exception 'Enter a quantity above zero.'; end if;
  st := case when l in ('admin','edit') then 'approved' else 'pending' end;
  insert into lots(project_id, item_id, kind, bill, qty, date, ref, note, status, direct, created_by, created_by_name)
  values (pid, iid, kind, case when bill = 'installation' then 'installation' else 'material' end, qty, left(coalesce(d,''),10), left(coalesce(ref,''),200), left(coalesce(note,''),1000), st, st = 'approved', auth.uid(), my_name())
  returning id into newid;
  select coalesce(data->>'sr','') || ' ' || left(coalesce(data->>'desc',''),60) into lbl from items where id = iid;
  perform log_act(pid, (case when st = 'approved' then 'recorded ' else 'sent for approval: ' end) || kind || ' of ' || qty || ' for “' || trim(lbl) || '”', kind, iid);
  return jsonb_build_object('id', newid, 'status', st);
end $$;

create or replace function public.delete_lot(lid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r lots;
begin
  select * into r from lots where id = lid and not deleted;
  if not found then raise exception 'Lot not found.'; end if;
  if is_admin() then
    if r.created_by = auth.uid() or r.direct then update lots set deleted = true where id = lid;
    else update lots set status = 'removed', decided_by_name = my_name(), decided_at = now() where id = lid; end if;
  elsif r.created_by = auth.uid() and can_write(r.project_id, r.kind) and (r.status = 'pending' or (r.status = 'approved' and r.direct)) then
    update lots set deleted = true where id = lid;
  else raise exception 'You can''t delete this lot.' using errcode = '42501'; end if;
  perform log_act(r.project_id, 'deleted a ' || r.kind || ' lot of ' || r.qty, r.kind, r.item_id);
end $$;

-- ---------- update requests on item fields ----------
create or replace function public.submit_changes(pid uuid, iid uuid, cat text, ch jsonb, note text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l text := lvl(pid, cat); clean jsonb; bef jsonb; cur jsonb; st text; newid uuid;
begin
  if cat not in ('data','status') or l not in ('admin','edit','request') then raise exception 'You can''t change these fields.' using errcode = '42501'; end if;
  select data into cur from items where id = iid and project_id = pid;
  if cur is null then raise exception 'Item not found.'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into clean from jsonb_each(ch) where key = any(edit_keys(cat));
  if clean = '{}'::jsonb then raise exception 'Nothing to change.'; end if;
  select coalesce(jsonb_object_agg(key, coalesce(cur->key, 'null'::jsonb)), '{}'::jsonb) into bef from jsonb_each(clean);
  st := case when l in ('admin','edit') then 'approved' else 'pending' end;
  insert into changes(project_id, item_id, cat, changes, before, note, status, direct, created_by, created_by_name)
  values (pid, iid, cat, clean, bef, left(coalesce(note,''),1000), st, st = 'approved', auth.uid(), my_name()) returning id into newid;
  if st = 'approved' then update items set data = data || clean, updated_at = now(), updated_by_name = my_name() where id = iid; end if;
  perform log_act(pid, (case when st = 'approved' then 'changed ' else 'requested a change to ' end) || cat || ' fields on “' || left(coalesce(cur->>'desc',''),60) || '”', cat, iid);
  return jsonb_build_object('id', newid, 'status', st);
end $$;

-- ---------- documents ----------
create or replace function public.add_document(pid uuid, sec text, system text, title text, no text, rev text, d text, note text, file_path text, file_name text, size bigint, ext text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare l text := lvl(pid, 'docs'); st text; newid uuid;
begin
  if l not in ('admin','edit','request') or not doc_sec_ok(pid, sec) then raise exception 'You can''t upload here.' using errcode = '42501'; end if;
  if file_path not like pid::text || '/%' then raise exception 'Bad file path.'; end if;
  st := case when l in ('admin','edit') then 'approved' else 'pending' end;
  insert into documents(project_id, sec, system, title, no, rev, date, note, file_path, file_name, size, ext, status, direct, created_by, created_by_name)
  values (pid, sec, left(coalesce(system,''),80), left(coalesce(title,''),200), left(coalesce(no,''),120), left(coalesce(rev,''),20), left(coalesce(d,''),10), left(coalesce(note,''),1000),
          file_path, left(file_name,200), coalesce(size,0), left(coalesce(ext,''),8), st, st = 'approved', auth.uid(), my_name()) returning id into newid;
  perform log_act(pid, (case when st = 'approved' then 'uploaded ' else 'uploaded for approval ' end) || sec || ' “' || left(coalesce(nullif(title,''), file_name),80) || '”', 'docs');
  return jsonb_build_object('id', newid, 'status', st);
end $$;

-- returns the file path so the app can remove the file from storage
create or replace function public.delete_document(did uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r documents;
begin
  select * into r from documents where id = did and not deleted;
  if not found then raise exception 'Document not found.'; end if;
  if not (is_admin() or (r.created_by = auth.uid() and can_write(r.project_id,'docs') and (r.status = 'pending' or r.direct))) then
    raise exception 'You can''t delete this document.' using errcode = '42501'; end if;
  delete from documents where id = did;
  perform log_act(r.project_id, 'deleted document “' || left(coalesce(nullif(r.title,''), r.file_name),80) || '”', 'docs');
  return r.file_path;
end $$;

-- storage helpers (used by storage policies below)
create or replace function public.try_uuid(t text) returns uuid language plpgsql immutable as $$
begin return t::uuid; exception when others then return null; end $$;

create or replace function public.can_upload_file(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select try_uuid(split_part(path,'/',1)) is not null and can_write(try_uuid(split_part(path,'/',1)), 'docs') $$;

create or replace function public.can_read_file(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from documents d where d.file_path = path and not d.deleted and doc_sec_ok(d.project_id, d.sec)
                 and (is_admin() or d.status = 'approved' or d.created_by = auth.uid())) $$;

-- ---------- admin decisions ----------
create or replace function public.decide(kind text, rid uuid, st text, p_note text default '') returns text
language plpgsql security definer set search_path = public as $$
declare c changes; fp text := null; pid uuid; who text; what text;
begin
  perform need_admin();
  if st not in ('approved','rejected') then raise exception 'Bad decision.'; end if;
  if kind = 'lot' then
    update lots set status = st, decided_by_name = my_name(), decided_at = now(), decision_note = left(coalesce(p_note,''),500) where id = rid and status = 'pending'
      returning lots.project_id, lots.created_by_name, lots.kind || ' lot of ' || lots.qty into pid, who, what;
  elsif kind = 'change' then
    select * into c from changes where id = rid and status = 'pending';
    if found then
      update changes set status = st, decided_by_name = my_name(), decided_at = now(), decision_note = left(coalesce(p_note,''),500) where id = rid;
      if st = 'approved' then update items set data = data || c.changes, updated_at = now(), updated_by_name = my_name() where id = c.item_id; end if;
      pid := c.project_id; who := c.created_by_name; what := c.cat || ' change';
    end if;
  elsif kind = 'doc' then
    update documents set status = st, decided_by_name = my_name(), decided_at = now(), decision_note = left(coalesce(p_note,''),500) where id = rid and status = 'pending' returning case when st = 'rejected' then file_path end, project_id, created_by_name, 'document “' || left(coalesce(nullif(title,''),file_name),60) || '”' into fp, pid, who, what;
  end if;
  if pid is not null then perform log_act(pid, st || ' ' || coalesce(who,'someone') || '’s ' || what || case when coalesce(p_note,'') <> '' then ': ' || left(p_note,200) else '' end); end if;
  return fp;
end $$;

create or replace function public.approve_all(pid uuid) returns int
language plpgsql security definer set search_path = public as $$
declare n int := 0; r record;
begin
  perform need_admin();
  for r in select id from changes where project_id = pid and status = 'pending' order by created_at loop perform decide('change', r.id, 'approved'); n := n + 1; end loop;
  with u as (update lots set status = 'approved', decided_by_name = my_name(), decided_at = now() where project_id = pid and status = 'pending' and not deleted returning 1) select n + count(*) into n from u;
  with u as (update documents set status = 'approved', decided_by_name = my_name(), decided_at = now() where project_id = pid and status = 'pending' and not deleted returning 1) select n + count(*) into n from u;
  return n;
end $$;

-- ---------- admin: items & projects ----------
create or replace function public.save_item(pid uuid, iid uuid, d jsonb, w numeric, p numeric) returns uuid
language plpgsql security definer set search_path = public as $$
declare id_ uuid := iid;
begin
  perform need_admin();
  if id_ is null then
    insert into items(project_id, ord, data, updated_by_name) values (pid, coalesce((select max(ord)+1 from items where project_id = pid), 1), d, my_name()) returning id into id_;
    perform log_act(pid, 'added “' || left(coalesce(d->>'desc',''),60) || '”', null, id_);
  else
    update items set data = d, updated_at = now(), updated_by_name = my_name() where id = id_ and project_id = pid;
    perform log_act(pid, 'edited “' || left(coalesce(d->>'desc',''),60) || '”', null, id_);
  end if;
  if w is not null or p is not null or exists(select 1 from item_rates where item_id = id_) then
    insert into item_rates(item_id, project_id, w, p) values (id_, pid, w, p) on conflict (item_id) do update set w = excluded.w, p = excluded.p;
  end if;
  return id_;
end $$;

create or replace function public.delete_item(iid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r items;
begin
  perform need_admin();
  select * into r from items where id = iid; if not found then return; end if;
  delete from items where id = iid;
  perform log_act(r.project_id, 'deleted “' || left(coalesce(r.data->>'desc',''),60) || '”');
end $$;

create or replace function public.create_project(meta jsonb, its jsonb, rates jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare pid uuid; i int; iid uuid; r jsonb;
begin
  perform need_admin();
  insert into projects(name, client, location, start_date, target, status, created_by)
  values (left(coalesce(meta->>'name','New project'),200), coalesce(meta->>'client',''), coalesce(meta->>'location',''), coalesce(meta->>'start',''), coalesce(meta->>'target',''), coalesce(nullif(meta->>'status',''),'Active'), auth.uid())
  returning id into pid;
  for i in 0 .. coalesce(jsonb_array_length(its),0) - 1 loop
    insert into items(project_id, ord, data, updated_by_name) values (pid, i, its->i, my_name()) returning id into iid;
    r := rates->i;
    if r is not null and (coalesce((r->>'w')::numeric,0) <> 0 or coalesce((r->>'p')::numeric,0) <> 0) then
      insert into item_rates(item_id, project_id, w, p) values (iid, pid, nullif((r->>'w')::numeric,0), nullif((r->>'p')::numeric,0));
    end if;
  end loop;
  perform log_act(pid, 'created the project with ' || coalesce(jsonb_array_length(its),0) || ' line items');
  return pid;
end $$;

create or replace function public.copy_project(src uuid, meta jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare its jsonb; rts jsonb; keep text[] := cat_keys('base') || cat_keys('data');
begin
  perform need_admin();
  select coalesce(jsonb_agg((select coalesce(jsonb_object_agg(key, value),'{}'::jsonb) from jsonb_each(i.data) where key = any(keep) and key <> 'poDate') order by i.ord),'[]'::jsonb),
         coalesce(jsonb_agg(coalesce((select jsonb_build_object('w', r.w, 'p', r.p) from item_rates r where r.item_id = i.id), '{}'::jsonb) order by i.ord),'[]'::jsonb)
    into its, rts from items i where i.project_id = src;
  return create_project(meta, its, rts);
end $$;

create or replace function public.update_project(pid uuid, meta jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform need_admin();
  update projects set name = left(coalesce(nullif(meta->>'name',''), name),200), client = coalesce(meta->>'client',client), location = coalesce(meta->>'location',location),
    start_date = coalesce(meta->>'start',start_date), target = coalesce(meta->>'target',target), status = coalesce(nullif(meta->>'status',''),status) where id = pid;
  perform log_act(pid, 'updated project details');
end $$;

create or replace function public.set_project_status(pid uuid, st text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform need_admin();
  update projects set status = st, completed_at = case when st = 'Completed' then to_char(now(),'YYYY-MM-DD') else '' end where id = pid;
  perform log_act(pid, case when st = 'Completed' then 'marked the project as completed' else 'reopened the project' end);
end $$;

create or replace function public.delete_project(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform need_admin(); update projects set deleted_at = now(), deleted_by_name = my_name() where id = pid; perform log_act(pid, 'deleted the project (kept for 7 days)'); end $$;

create or replace function public.restore_project(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin perform need_admin(); update projects set deleted_at = null, deleted_by_name = null where id = pid; perform log_act(pid, 'restored the project'); end $$;

-- permanently removes a project; returns its file paths so the app can delete the files
create or replace function public.purge_project(pid uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare paths text[];
begin
  perform need_admin();
  select coalesce(array_agg(file_path), array[]::text[]) into paths from documents where project_id = pid;
  delete from projects where id = pid;
  return paths;
end $$;

create or replace function public.expired_projects() returns uuid[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(id), array[]::uuid[]) from projects where is_admin() and deleted_at is not null and deleted_at < now() - interval '7 days' $$;

-- ---------- admin: people ----------
create or replace function public.clean_levels(lv jsonb) returns jsonb
language sql immutable as $$
  select coalesce(jsonb_object_agg(c, case when lv->>c in ('edit','request','none','hide') then lv->>c else 'hide' end), '{}'::jsonb)
  from unnest(array['data','status','delivery','install','testing','commission','handover','billing','docs']) c $$;

create or replace function public.list_members(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform need_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('email', m.email, 'levels', m.levels, 'name', pr.name, 'signedUp', pr.id is not null) order by m.added_at)
    from project_members m left join profiles pr on pr.email = m.email where m.project_id = pid), '[]'::jsonb);
end $$;

create or replace function public.set_member(pid uuid, em text, lv jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(em));
begin
  perform need_admin();
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  insert into project_members(project_id, email, levels) values (pid, e, clean_levels(lv))
  on conflict (project_id, email) do update set levels = clean_levels(excluded.levels);
  perform log_act(pid, 'updated access for ' || e);
end $$;

create or replace function public.remove_member(pid uuid, em text) returns void
language plpgsql security definer set search_path = public as $$
begin perform need_admin(); delete from project_members where project_id = pid and email = lower(trim(em)); perform log_act(pid, 'removed ' || lower(trim(em)) || ' from the project'); end $$;

create or replace function public.copy_members(dst uuid, src uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform need_admin();
  insert into project_members(project_id, email, levels) select dst, email, levels from project_members where project_id = src
  on conflict (project_id, email) do update set levels = excluded.levels;
  perform log_act(dst, 'copied access settings from another project');
end $$;

create or replace function public.list_admins() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin perform need_admin(); return coalesce((select jsonb_agg(a.email order by a.email) from admins a), '[]'::jsonb); end $$;

create or replace function public.add_admin(em text) returns void
language plpgsql security definer set search_path = public as $$
declare e text := lower(trim(em));
begin
  perform need_admin();
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a valid email address.'; end if;
  insert into admins(email) values (e) on conflict do nothing;
end $$;

create or replace function public.remove_admin(em text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform need_admin();
  if (select count(*) from admins) <= 1 then raise exception 'There must be at least one admin.'; end if;
  if lower(trim(em)) = me_email() then raise exception 'You can''t remove yourself. Ask another admin.'; end if;
  delete from admins where email = lower(trim(em));
end $$;

-- ---------- grants ----------
revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;

-- ---------- file storage ----------
insert into storage.buckets(id, name, public, file_size_limit)
values ('project-docs', 'project-docs', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

drop policy if exists "docs upload" on storage.objects;
drop policy if exists "docs read" on storage.objects;
drop policy if exists "docs delete" on storage.objects;
create policy "docs upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-docs' and public.can_upload_file(name));
create policy "docs read" on storage.objects for select to authenticated
  using (bucket_id = 'project-docs' and (public.is_admin() or public.can_read_file(name) or owner = auth.uid()));
create policy "docs delete" on storage.objects for delete to authenticated
  using (bucket_id = 'project-docs' and (public.is_admin() or owner = auth.uid()));

-- ---------- upgrade: people added before commissioning / handing over existed get the same access as their testing access ----------
update public.project_members set levels = levels || jsonb_build_object('commission', coalesce(levels->'testing','"hide"'::jsonb), 'handover', coalesce(levels->'testing','"hide"'::jsonb))
 where not (levels ? 'commission');

-- ---------- first admin (change this email if needed) ----------
insert into public.admins(email) values ('tarun@atronic.co.in') on conflict do nothing;
