-- Far From Fries: State Extremes / Top 100 listing, monthly data import, push outbox.

-- All active spots with whether you've claimed them. Ticks are permanent: a state
-- you claimed stays ticked even after its spot moves in a monthly refresh.
create or replace function public.spots()
returns table (id bigint, kind text, state text, state_name text, rank int, lat double precision,
               lon double precision, distance_mi numeric, land text, claimed boolean, claimed_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select e.id, e.kind, e.state, coalesce(r.name, e.state), e.rank,
         st_y(e.geom::geometry), st_x(e.geom::geometry), e.distance_mi, e.land,
         t.id is not null, t.claimed_at
  from public.extremes e
  left join public.regions r on r.code = 'US-' || e.state
  left join lateral (
    select k.id, k.claimed_at from public.extreme_ticks k
    where k.user_id = auth.uid()
      and (k.extreme_id = e.id or (e.kind = 'state' and k.kind = 'state' and k.state = e.state))
    limit 1
  ) t on true
  where e.active
  order by e.kind, coalesce(e.rank, 0), e.state
$$;

create or replace function public.my_ticks()
returns table (kind text, state text, rank_at_claim int, distance_mi numeric, claimed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select kind, state, rank_at_claim, distance_mi, claimed_at from public.extreme_ticks
  where user_id = auth.uid() order by claimed_at desc
$$;

-- ---------------------------------------------------------------------------
-- Monthly data import (run by pipeline/load_supabase.py with the database URL).
-- 1. begin_import() -> version id
-- 2. insert into private.stage_stores / private.stage_spots
-- 3. finish_import(version) swaps stores and merges spots.
-- ---------------------------------------------------------------------------
create table private.stage_stores (
  source_id text, lat double precision, lon double precision, country text, state text, city text
);
create table private.stage_spots (
  kind text, state text, rank int, lat double precision, lon double precision,
  distance_mi numeric, land text, nearest text
);

create or replace function private.begin_import(p_source text, p_notes text default null)
returns int language plpgsql set search_path = public as $$
declare v int;
begin
  truncate private.stage_stores, private.stage_spots;
  insert into public.data_versions (source, notes) values (p_source, p_notes) returning id into v;
  return v;
end $$;

create or replace function private.finish_import(p_version int)
returns jsonb language plpgsql set search_path = public, extensions as $$
declare s public.game_settings := private.settings(); n_stores int; n_spots int := 0;
  r record; m public.extremes; kept int := 0; moved int := 0; added int := 0; retired int := 0;
begin
  select count(*) into n_stores from private.stage_stores;
  if n_stores > 0 then
    if n_stores < 0.9 * (select count(*) from public.stores) then
      raise exception 'store count dropped from % to %, refusing to import', (select count(*) from public.stores), n_stores;
    end if;
    delete from public.stores;
    insert into public.stores (source_id, geom, country, state, city, data_version_id)
    select source_id, private.point(lat, lon), country, state, city, p_version from private.stage_stores;
  end if;

  if exists (select 1 from private.stage_spots) then
    -- Free the rank / state slots; matched spots get reactivated below.
    create temporary table old_active on commit drop as
      select id from public.extremes where active and kind in (select distinct kind from private.stage_spots);
    update public.extremes set active = false where id in (select id from old_active);

    for r in select * from private.stage_spots order by kind, coalesce(rank, 0), state loop
      -- Keep the same spot (and its id) if the new point is within 2 mi of an old one.
      select e.* into m from public.extremes e
      where e.id in (select id from old_active) and e.kind = r.kind and not e.active
        and (r.kind = 'top100' or e.state = r.state)
        and st_dwithin(e.geom, private.point(r.lat, r.lon), s.spot_match_radius_m)
      order by st_distance(e.geom, private.point(r.lat, r.lon)) limit 1;
      if m.id is not null then
        update public.extremes set active = true, state = r.state, rank = r.rank,
          geom = private.point(r.lat, r.lon), distance_mi = r.distance_mi, land = r.land, nearest = r.nearest,
          data_version_id = p_version, updated_at = now(), retired_at = null
        where id = m.id;
        if st_distance(m.geom, private.point(r.lat, r.lon)) > 1 then moved := moved + 1; else kept := kept + 1; end if;
      else
        insert into public.extremes (kind, state, rank, geom, distance_mi, land, nearest, data_version_id)
        values (r.kind, r.state, r.rank, private.point(r.lat, r.lon), r.distance_mi, r.land, r.nearest, p_version);
        added := added + 1;
      end if;
      n_spots := n_spots + 1;
    end loop;
    update public.extremes set retired_at = now() where id in (select id from old_active) and not active;
    get diagnostics retired = row_count;
  end if;

  update public.data_versions set store_count = n_stores, spot_count = n_spots where id = p_version;
  truncate private.stage_stores, private.stage_spots;
  return jsonb_build_object('version', p_version, 'stores', n_stores, 'spots', n_spots,
    'spots_kept', kept, 'spots_moved', moved, 'spots_added', added, 'spots_retired', retired);
end $$;

-- ---------------------------------------------------------------------------
-- Push outbox, drained by the push-dispatch Edge Function (service role only).
-- ---------------------------------------------------------------------------
create or replace function public.claim_outbox(p_limit int default 500)
returns table (id bigint, title text, body text, data jsonb, tokens text[])
language sql security definer set search_path = public as $$
  with c as (
    update public.outbox o set claimed_at = now(), attempts = attempts + 1
    where o.id in (
      select id from public.outbox
      where sent_at is null and attempts < 5
        and (claimed_at is null or claimed_at < now() - interval '5 minutes')
      order by created_at limit p_limit
      for update skip locked)
    returning o.id, o.user_id, o.title, o.body, o.data
  )
  select c.id, c.title, c.body, c.data,
         coalesce((select array_agg(t.token) from public.push_tokens t where t.user_id = c.user_id), '{}')
  from c
$$;

create or replace function public.finish_outbox(p_sent bigint[], p_failed jsonb default '[]', p_dead_tokens text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.outbox set sent_at = now() where id = any (p_sent);
  update public.outbox o set last_error = f ->> 'error'
    from jsonb_array_elements(p_failed) f where o.id = (f ->> 'id')::bigint;
  delete from public.push_tokens where token = any (p_dead_tokens);
  delete from public.outbox where sent_at < now() - interval '30 days';
end $$;
