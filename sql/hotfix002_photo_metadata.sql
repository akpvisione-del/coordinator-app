create table public.akp_photos (
 id uuid primary key default gen_random_uuid(),
 job_id uuid not null references public.akp_jobs(id) on delete cascade,
 report_id uuid references public.akp_reports(id),
 stage text not null default 'DURING' check(stage in ('BEFORE','DURING','AFTER','DEFECT','PROTOCOL')),
 storage_path text not null unique check(length(storage_path) between 1 and 300),
 caption text check(length(caption)<=500),
 created_at timestamptz not null default now(),
 uploaded_by uuid not null references public.akp_profiles(user_id)
);
alter table public.akp_photos enable row level security;
revoke all on public.akp_photos from anon,authenticated;
grant select on public.akp_photos to authenticated;
create policy akp_photos_read on public.akp_photos for select to authenticated using (
 exists(select 1 from public.akp_profiles p where p.user_id=(select auth.uid()) and p.is_active)
 and (((select auth.jwt()->'app_metadata'->>'akp_role')='coordinator')
 or ((select auth.jwt()->'app_metadata'->>'akp_role')='worker' and exists(select 1 from public.akp_assignments a where a.job_id=akp_photos.job_id and a.worker_id=(select auth.uid()) and a.active)))
);
create index akp_photos_job_created on public.akp_photos(job_id,created_at desc);
create index akp_photos_report on public.akp_photos(report_id);
create index akp_photos_uploader on public.akp_photos(uploaded_by);
comment on table public.akp_photos is 'Metadata read path enabled. Upload writes remain closed pending private Storage integration.';
