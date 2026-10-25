-- Run once in the Supabase SQL editor. Use a separate project for the pilot.
create table public.fleets (
  id uuid primary key default gen_random_uuid(), name text not null check (length(name) between 1 and 100), created_at timestamptz not null default now()
);
create table public.fleet_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  fleet_id uuid not null references public.fleets(id) on delete cascade,
  display_name text not null, email text not null, role text not null check (role in ('admin','driver')),
  unique (fleet_id,user_id)
);
create function public.is_fleet_member(target uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from fleet_members where fleet_id=target and user_id=auth.uid());
$$;
create function public.is_fleet_admin(target uuid) returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from fleet_members where fleet_id=target and user_id=auth.uid() and role='admin');
$$;
create table public.vehicles (
 id uuid primary key default gen_random_uuid(), fleet_id uuid not null references public.fleets(id), name text not null, registration text not null default '', unique(fleet_id,id)
);
create table public.trips (
 id uuid primary key default gen_random_uuid(), fleet_id uuid not null references public.fleets(id), driver_id uuid not null, vehicle_id uuid,
 payload jsonb not null, updated_at timestamptz not null default now(),
 foreign key(fleet_id,driver_id) references public.fleet_members(fleet_id,user_id),
 foreign key(fleet_id,vehicle_id) references public.vehicles(fleet_id,id), unique(fleet_id,id)
);
create table public.announcement_templates (
 id text not null, fleet_id uuid not null references public.fleets(id), payload jsonb not null, primary key(fleet_id,id)
);
create table public.announcement_events (
 id uuid primary key, fleet_id uuid not null references public.fleets(id), trip_id uuid not null, driver_id uuid not null,
 payload jsonb not null, created_at timestamptz not null default now(),
 foreign key(fleet_id,trip_id) references public.trips(fleet_id,id), foreign key(fleet_id,driver_id) references public.fleet_members(fleet_id,user_id)
);
create index trips_fleet_idx on public.trips(fleet_id,updated_at desc);
create index events_fleet_idx on public.announcement_events(fleet_id,created_at desc);
alter table public.fleets enable row level security;
alter table public.fleet_members enable row level security;
alter table public.vehicles enable row level security;
alter table public.trips enable row level security;
alter table public.announcement_templates enable row level security;
alter table public.announcement_events enable row level security;
create policy fleet_read on public.fleets for select to authenticated using (public.is_fleet_member(id));
create policy fleet_update on public.fleets for update to authenticated using (public.is_fleet_admin(id)) with check(public.is_fleet_admin(id));
create policy members_read on public.fleet_members for select to authenticated using(public.is_fleet_member(fleet_id));
-- Membership writes are restricted to the server provisioning endpoint.
create policy vehicles_read on public.vehicles for select to authenticated using(public.is_fleet_member(fleet_id));
create policy vehicles_write on public.vehicles for all to authenticated using(public.is_fleet_admin(fleet_id)) with check(public.is_fleet_admin(fleet_id));
create policy trips_read on public.trips for select to authenticated using(public.is_fleet_admin(fleet_id) or (public.is_fleet_member(fleet_id) and driver_id=auth.uid()));
create policy trips_insert on public.trips for insert to authenticated with check(public.is_fleet_admin(fleet_id) or (public.is_fleet_member(fleet_id) and driver_id=auth.uid()));
create policy trips_update on public.trips for update to authenticated using(public.is_fleet_admin(fleet_id) or (public.is_fleet_member(fleet_id) and driver_id=auth.uid())) with check(public.is_fleet_admin(fleet_id) or (public.is_fleet_member(fleet_id) and driver_id=auth.uid()));
create policy templates_read on public.announcement_templates for select to authenticated using(public.is_fleet_member(fleet_id));
create policy templates_write on public.announcement_templates for all to authenticated using(public.is_fleet_admin(fleet_id)) with check(public.is_fleet_admin(fleet_id));
create policy events_read on public.announcement_events for select to authenticated using(public.is_fleet_admin(fleet_id) or (public.is_fleet_member(fleet_id) and driver_id=auth.uid()));
create policy events_insert on public.announcement_events for insert to authenticated with check(
 public.is_fleet_member(fleet_id) and driver_id=auth.uid() and exists(select 1 from public.trips t where t.id=trip_id and t.fleet_id=announcement_events.fleet_id and (t.driver_id=auth.uid() or public.is_fleet_admin(t.fleet_id)))
);
create function public.create_pilot_fleet(fleet_name text, display_name text) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 if exists(select 1 from fleet_members where user_id=auth.uid()) then raise exception 'Already a member of a fleet'; end if;
 if length(trim(fleet_name)) not between 1 and 100 or length(trim(display_name)) not between 1 and 100 then raise exception 'Provide a fleet and display name'; end if;
 insert into fleets(name) values(trim(fleet_name)) returning id into result;
 insert into fleet_members(user_id,fleet_id,display_name,email,role) values(auth.uid(),result,trim(display_name),coalesce(auth.jwt()->>'email',''),'admin');
 return result;
end; $$;
revoke all on function public.create_pilot_fleet(text,text) from public;
grant execute on function public.create_pilot_fleet(text,text) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('announcements','announcements',false,10485760,array['audio/wav','audio/mpeg','audio/mp4','audio/webm','audio/ogg','audio/x-wav']) on conflict(id) do nothing;
create policy audio_read on storage.objects for select to authenticated using(bucket_id='announcements' and exists(select 1 from public.fleet_members m where m.user_id=auth.uid() and m.fleet_id::text=(storage.foldername(name))[1]));
create policy audio_insert on storage.objects for insert to authenticated with check(bucket_id='announcements' and exists(select 1 from public.fleet_members m where m.user_id=auth.uid() and m.fleet_id::text=(storage.foldername(name))[1]));
create policy audio_update on storage.objects for update to authenticated using(bucket_id='announcements' and exists(select 1 from public.fleet_members m where m.user_id=auth.uid() and m.fleet_id::text=(storage.foldername(name))[1])) with check(bucket_id='announcements' and exists(select 1 from public.fleet_members m where m.user_id=auth.uid() and m.fleet_id::text=(storage.foldername(name))[1]));
create table public.speech_usage(user_id uuid not null references auth.users(id) on delete cascade, usage_day date not null, count integer not null default 0, primary key(user_id,usage_day));
alter table public.speech_usage enable row level security;
create function public.consume_speech_quota() returns boolean language plpgsql security definer set search_path=public as $$
declare used integer;
begin
 if auth.uid() is null or not exists(select 1 from fleet_members where user_id=auth.uid()) then return false; end if;
 insert into speech_usage(user_id,usage_day,count) values(auth.uid(),current_date,1)
 on conflict(user_id,usage_day) do update set count=speech_usage.count+1 where speech_usage.count<40 returning count into used;
 return used is not null and used<=40;
end; $$;
revoke all on function public.consume_speech_quota() from public;
grant execute on function public.consume_speech_quota() to authenticated;
