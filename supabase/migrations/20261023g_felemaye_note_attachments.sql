-- FELEMAYE · 2026-10-23g · up to three PDF attachments per Friday note (safe to re-run)
alter table public.async_updates add column if not exists attachments jsonb not null default '[]';   -- [{path, name}]
update public.async_updates set attachments = jsonb_build_array(jsonb_build_object('path', file_path, 'name', regexp_replace(split_part(file_path, '/', -1), '^\d+_', '')))
 where file_path is not null and attachments = '[]'::jsonb;
