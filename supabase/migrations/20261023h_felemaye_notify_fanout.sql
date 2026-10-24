-- FELEMAYE · 2026-10-23h · Email fan-out: nothing posted to a portal stays silent.  Safe to re-run.
--
-- What changes
--   1. Every client-facing notification now also sends the launch team a copy ("Sent to client · …").
--   2. Each email event carries the full recipient lists: client_emails (the client of record plus every Active
--      contact in the project directory who is not studio) and launch_team (studio_config.launch_team_emails).
--   3. File uploads are no longer silent. They are batched: every 15 minutes, uploads older than 10 minutes that
--      have not been emailed go out as ONE digest per project and audience ("6 new files in your portal").
--   4. Every notification records whether and how it was emailed (email_status, emailed_at), so a post can be
--      checked after the fact.
-- Nothing is deleted. Existing notifications keep their rows; only the two new columns are added.

insert into public.studio_config (key, value) values
  ('launch_team_emails', 'felema@felemaye.com'),
  ('studio_alias_emails', 'felemayemaneberhan@gmail.com')
on conflict (key) do nothing;

alter table public.portal_notifications add column if not exists emailed_at timestamptz;
alter table public.portal_notifications add column if not exists email_status text;   -- dispatched | digest | queued | skipped

-- Who should hear about a project. Studio addresses are never counted as clients.
create or replace function public.fy_recipients(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare team text[]; alias text[]; cl text[];
begin
  select coalesce(string_to_array(replace(value, ' ', ''), ','), '{}') into team from public.studio_config where key = 'launch_team_emails';
  select coalesce(string_to_array(replace(value, ' ', ''), ','), '{}') into alias from public.studio_config where key = 'studio_alias_emails';
  team := coalesce(team, '{}'); alias := coalesce(alias, '{}');
  select coalesce(array_agg(distinct lower(e)), '{}') into cl from (
    select c.email as e from public.projects p join public.clients c on c.client_id = p.client_id where p.id = p_project
    union
    select c.email from public.clients c where c.project_id = p_project
    union
    select d.email from public.project_directory d where d.project_id = p_project and d.status ilike 'active%'
  ) x
  where e is not null and e like '%@%'
    and lower(e) not like '%@felemaye.com'
    and lower(e) <> all (select lower(t) from unnest(team || alias) t);
  return jsonb_build_object('clients', to_jsonb(cl), 'launch_team', to_jsonb(team));
end $$;

create or replace function public.fy_notify(p_project uuid, p_audience text, p_kind text, p_title text, p_body text, p_link text, p_ref uuid)
returns void language plpgsql security definer set search_path = public as $$
declare skip text; nid uuid; rec jsonb; payload jsonb;
begin
  insert into public.portal_notifications (project_id, audience, kind, title, body, link_target, ref_id)
  values (p_project, p_audience, p_kind, left(p_title, 200), left(p_body, 600), p_link, p_ref)
  returning id into nid;

  -- Uploads wait for the 15-minute digest instead of one email per file.
  if p_kind in ('client_upload', 'studio_upload') then
    update public.portal_notifications set email_status = 'queued' where id = nid;
    return;
  end if;

  select value into skip from public.studio_config where key = 'notify_email_skip_kinds';
  if p_kind = any(string_to_array(replace(coalesce(skip, ''), ' ', ''), ',')) then
    update public.portal_notifications set email_status = 'skipped' where id = nid;
    return;
  end if;

  begin  -- email fan-out never blocks the write
    rec := public.fy_recipients(p_project);
    payload := jsonb_build_object('event', 'portal_notification', 'audience', p_audience, 'kind', p_kind,
      'title', p_title, 'body', coalesce(p_body, ''), 'link', coalesce(p_link, ''), 'project_id', p_project,
      'notification_id', nid, 'client_emails', rec->'clients', 'launch_team', rec->'launch_team');
    perform public.notify_make('make_notifications_webhook', payload);
    if p_audience = 'client' then
      perform public.notify_make('make_notifications_webhook',
        payload || jsonb_build_object('audience', 'studio', 'title', 'Sent to client · ' || p_title));
    end if;
    update public.portal_notifications set email_status = 'dispatched', emailed_at = now() where id = nid;
  exception when others then null;
  end;
end $$;

-- One email per project and audience for uploads that have settled for 10 minutes.
create or replace function public.fy_upload_digest()
returns int language plpgsql security definer set search_path = public as $$
declare r record; rec jsonb; payload jsonb; n int := 0;
begin
  for r in
    select project_id, audience, count(*) as cnt,
           string_agg(regexp_replace(title, '^(Client uploaded|New file) · ', ''), E'\n' order by created_at) as names,
           array_agg(id) as ids
      from public.portal_notifications
     where kind in ('client_upload', 'studio_upload') and emailed_at is null
       and created_at < now() - interval '10 minutes' and created_at > now() - interval '3 days'
     group by project_id, audience
  loop
    rec := public.fy_recipients(r.project_id);
    payload := jsonb_build_object('event', 'portal_notification', 'audience', r.audience, 'kind', 'upload_digest',
      'title', case when r.audience = 'client' then r.cnt || case when r.cnt = 1 then ' new file' else ' new files' end || ' from the studio'
                    else 'Client uploaded ' || r.cnt || case when r.cnt = 1 then ' file' else ' files' end end,
      'body', r.names, 'link', 'files', 'project_id', r.project_id,
      'client_emails', rec->'clients', 'launch_team', rec->'launch_team');
    perform public.notify_make('make_notifications_webhook', payload);
    if r.audience = 'client' then
      perform public.notify_make('make_notifications_webhook', payload || jsonb_build_object('audience', 'studio', 'title', 'Sent to client · ' || (payload->>'title')));
    end if;
    update public.portal_notifications set emailed_at = now(), email_status = 'digest' where id = any(r.ids);
    n := n + 1;
  end loop;
  return n;
end $$;

do $$ begin
  perform cron.unschedule('fy-upload-digest');
exception when others then null; end $$;
select cron.schedule('fy-upload-digest', '*/15 * * * *', 'select public.fy_upload_digest()');

-- Check any post: one row per notification with how it was emailed.
create or replace view public.v_notification_dispatch as
  select n.created_at at time zone 'America/Los_Angeles' as created_pt, p.title as project, n.audience, n.kind, n.title,
         coalesce(n.email_status, case when n.created_at < '2026-10-24' then 'before tracking' end) as email_status,
         n.emailed_at at time zone 'America/Los_Angeles' as emailed_pt, n.read_at is not null as read_in_portal
    from public.portal_notifications n left join public.projects p on p.id = n.project_id;
revoke all on public.v_notification_dispatch from anon, authenticated;
