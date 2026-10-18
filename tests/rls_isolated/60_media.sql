\set ON_ERROR_STOP on
-- Synthetic minimal Storage contract; no actual Supabase service / bucket is touched.
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text NOT NULL,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text REFERENCES storage.buckets(id),name text,metadata jsonb,UNIQUE(bucket_id,name));
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated;
CREATE POLICY synthetic_broad_legacy_coord ON storage.objects FOR ALL TO authenticated
 USING(auth.jwt()->'app_metadata'->>'akp_role'='coordinator') WITH CHECK(auth.jwt()->'app_metadata'->>'akp_role'='coordinator');
CREATE TABLE public.akp_photos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),job_id uuid NOT NULL REFERENCES public.akp_jobs(id),report_id uuid REFERENCES public.akp_reports(id),stage text NOT NULL,storage_path text NOT NULL UNIQUE,caption text,uploaded_by uuid REFERENCES public.akp_profiles(user_id),created_at timestamptz NOT NULL DEFAULT clock_timestamp());
ALTER TABLE public.akp_photos ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.akp_photos TO authenticated;
CREATE POLICY synthetic_photo_ro ON public.akp_photos FOR SELECT TO authenticated USING(akp_pro_private.can_job(job_id,false));
INSERT INTO public.akp_photos(id,job_id,stage,storage_path,caption,uploaded_by) VALUES('90000000-0000-4000-8000-000000000030','44444444-4444-4444-8444-444444444444','BEFORE','44444444-4444-4444-8444-444444444444/legacy.jpg','Opis oryginalny','22222222-2222-4222-8222-222222222222');
\i docs/sql_proposals/supersprint03_media_v01.REVIEW_ONLY.sql
\set job '44444444-4444-4444-8444-444444444444'
\set photo '90000000-0000-4000-8000-000000000031'
\set data '{"id":"90000000-0000-4000-8000-000000000031","mime_type":"image/png","size":100,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","caption":"Fikcyjne zdjęcie","stage":"DURING","category":"PROGRESS"}'
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT public.akp_pro_photo_prepare(:'job',:'photo',:'data');
SELECT public.akp_pro_photo_prepare(:'job',:'photo',:'data');
SELECT test.expect_count('upload reservation retry one row',1,'select count(*) from public.akp_pro_photo_uploads');
SELECT test.expect_error('metadata cannot claim absent file','P0002',format('select public.akp_pro_photo_complete(%L,%L)',:'job',:'photo'));
SELECT test.expect_error('unreserved object insert denied','42501','insert into storage.objects(bucket_id,name) values(''akp-job-media'',''forged.png'')');
INSERT INTO storage.objects(bucket_id,name) SELECT 'akp-job-media',public.akp_pro_photo_slot(:'job',:'photo')->>'storage_path';
SELECT public.akp_pro_photo_complete(:'job',:'photo');
SELECT public.akp_pro_photo_complete(:'job',:'photo');
SELECT test.expect_count('completion retry one new photograph',2,'select count(*) from public.akp_photos');
SELECT test.expect_count('gallery includes historical and new',2,format('select jsonb_array_length(public.akp_pro_photo_list(%L)->''items'')',:'job'));
SELECT public.akp_pro_photo_meta_save(:'job','90000000-0000-4000-8000-000000000030',0,'90000000-0000-4000-8000-000000000032','{"caption":"Nowy opis","stage":"AFTER","category":"ACCEPTANCE"}');
SELECT test.expect_count('legacy original metadata unchanged',1,'select count(*) from public.akp_photos where caption=''Opis oryginalny'' and stage=''BEFORE''');
SELECT test.expect_error('photo stale metadata CAS','40001',format('select public.akp_pro_photo_meta_save(%L,%L,0,%L,%L)',:'job','90000000-0000-4000-8000-000000000030','90000000-0000-4000-8000-000000000033','{"caption":"Other","stage":"AFTER","category":"ACCEPTANCE"}'));
SELECT test.expect_error('photo metadata direct forgery denied','42501','delete from public.akp_pro_photo_meta_versions');
COMMIT;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"33333333-3333-4333-8333-333333333333","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('other worker cannot list storage objects',0,'select count(*) from storage.objects');
SELECT test.expect_error('other worker cannot get photo path','42501',format('select public.akp_pro_photo_file(%L,%L)',:'job',:'photo'));
ROLLBACK;
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","app_metadata":{"akp_role":"coordinator"}}',true);
SELECT test.expect_error('broad legacy coordinator policy cannot forge new object','42501','insert into storage.objects(bucket_id,name) values(''akp-job-media'',''forged.png'')');
SELECT test.expect_count('broad legacy coordinator policy cannot delete original',0,'with changed as (delete from storage.objects where bucket_id=''akp-job-media'' returning 1) select count(*) from changed');
SELECT test.expect_count('broad legacy coordinator policy cannot overwrite original',0,'with changed as (update storage.objects set name=''overwrite.png'' where bucket_id=''akp-job-media'' returning 1) select count(*) from changed');
ROLLBACK;
UPDATE public.akp_profiles SET is_active=false WHERE user_id='22222222-2222-4222-8222-222222222222';
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"22222222-2222-4222-8222-222222222222","app_metadata":{"akp_role":"worker"}}',true);
SELECT test.expect_count('inactive worker old JWT cannot read file',0,'select count(*) from storage.objects');
SELECT test.expect_error('inactive worker old JWT cannot complete upload','42501',format('select public.akp_pro_photo_complete(%L,%L)',:'job',:'photo'));
ROLLBACK;
UPDATE public.akp_profiles SET is_active=true WHERE user_id='22222222-2222-4222-8222-222222222222';
-- Even an unrelated broad anonymous policy cannot open the new bucket.
GRANT USAGE ON SCHEMA storage,test TO anon;
GRANT SELECT ON storage.objects TO anon;
CREATE POLICY synthetic_anon_broad ON storage.objects FOR SELECT TO anon USING(true);
BEGIN;
SET LOCAL ROLE anon;
SELECT test.expect_count('anonymous broad policy cannot read new media',0,'select count(*) from storage.objects');
ROLLBACK;
\echo MEDIA RLS PASS
