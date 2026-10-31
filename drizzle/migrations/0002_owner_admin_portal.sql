CREATE TYPE public.portal_role AS ENUM ('owner','admin');
CREATE TABLE public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, display_name text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(display_name) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read own profile" ON public.profiles FOR SELECT TO authenticated USING(id=auth.uid());
CREATE POLICY "Edit own display name" ON public.profiles FOR UPDATE TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
CREATE TABLE public.user_roles (user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, role public.portal_role NOT NULL, permissions text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT valid_portal_permissions CHECK(permissions <@ ARRAY['users.read','usage.read','providers.read']::text[]));
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX one_portal_owner ON public.user_roles(role) WHERE role='owner';
CREATE TABLE public.portal_audit (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL, target_id uuid NOT NULL, action text NOT NULL, details jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.portal_audit TO authenticated;
GRANT ALL ON public.portal_audit TO service_role;
ALTER TABLE public.portal_audit ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.portal_can(task text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND (role='owner' OR task=ANY(permissions))) $$;
REVOKE ALL ON FUNCTION public.portal_can(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_can(text) TO authenticated;
CREATE POLICY "Read own role or owner team" ON public.user_roles FOR SELECT TO authenticated USING(user_id=auth.uid() OR public.portal_can('team.manage'));
CREATE POLICY "Owner audit" ON public.portal_audit FOR SELECT TO authenticated USING(public.portal_can('team.manage'));
CREATE FUNCTION public.portal_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
INSERT INTO public.profiles(id,display_name) VALUES(new.id, left(coalesce(new.raw_user_meta_data->>'display_name',''),80)) ON CONFLICT(id) DO NOTHING;
IF new.email_confirmed_at IS NOT NULL AND lower(new.email)='vampiee001@gmail.com' THEN
INSERT INTO public.user_roles(user_id,role) VALUES(new.id,'owner') ON CONFLICT DO NOTHING;
END IF;
RETURN new; END $$;
REVOKE ALL ON FUNCTION public.portal_signup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER memorymelody_profile_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.portal_signup();
CREATE TRIGGER memorymelody_owner_confirmation AFTER UPDATE OF email_confirmed_at ON auth.users FOR EACH ROW WHEN(old.email_confirmed_at IS NULL AND new.email_confirmed_at IS NOT NULL) EXECUTE FUNCTION public.portal_signup();
INSERT INTO public.profiles(id,display_name) SELECT id,left(coalesce(raw_user_meta_data->>'display_name',''),80) FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles(user_id,role) SELECT id,'owner'::public.portal_role FROM auth.users WHERE lower(email)='vampiee001@gmail.com' AND email_confirmed_at IS NOT NULL ON CONFLICT DO NOTHING;
CREATE FUNCTION public.portal_access() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT jsonb_build_object('role',coalesce((SELECT role::text FROM public.user_roles WHERE user_id=auth.uid()),'user'),'permissions',coalesce((SELECT to_jsonb(permissions) FROM public.user_roles WHERE user_id=auth.uid()),'[]'::jsonb),'premium',EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=auth.uid() AND role='owner'),'displayName',coalesce((SELECT display_name FROM public.profiles WHERE id=auth.uid()),'')) $$;
REVOKE ALL ON FUNCTION public.portal_access() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_access() TO authenticated;
CREATE FUNCTION public.portal_users(search_text text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.portal_can('users.read') THEN RAISE EXCEPTION 'Forbidden'; END IF;
RETURN coalesce((SELECT jsonb_agg(row_to_json(t)) FROM (SELECT u.id,u.email,p.display_name,u.created_at,u.email_confirmed_at,u.last_sign_in_at,coalesce(r.role::text,'user') AS role,(r.role='owner') IS TRUE AS premium,(SELECT count(*) FROM public.projects s WHERE s.user_id=u.id) AS projects,(SELECT count(*) FROM public.projects s WHERE s.user_id=u.id AND s.audio_path IS NOT NULL) AS songs FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id LEFT JOIN public.user_roles r ON r.user_id=u.id WHERE search_text='' OR position(lower(left(search_text,200)) in lower(coalesce(u.email,'')||' '||coalesce(p.display_name,'')))>0 ORDER BY u.created_at DESC LIMIT 50) t),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.portal_users(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_users(text) TO authenticated;
CREATE FUNCTION public.portal_metrics() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.portal_can('usage.read') THEN RAISE EXCEPTION 'Forbidden'; END IF;
RETURN jsonb_build_object('users',(SELECT count(*) FROM auth.users),'projects',(SELECT count(*) FROM public.projects),'audio',(SELECT count(*) FROM public.projects WHERE audio_path IS NOT NULL),'covers',(SELECT count(*) FROM public.projects WHERE cover_path IS NOT NULL),'failed',(SELECT count(*) FROM public.projects WHERE audio_status='failed' OR beat_status='failed' OR mastering_status='failed' OR cover_status='failed'),'exported',(SELECT count(*) FROM public.projects WHERE package_exported_at IS NOT NULL),'submitted',(SELECT count(*) FROM public.projects WHERE distribution_status='submitted'),'live',(SELECT count(*) FROM public.projects WHERE distribution_status='live'),'today',(SELECT count(*) FROM public.projects WHERE created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),'daily',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT d::date AS day,(SELECT count(*) FROM public.projects p WHERE p.created_at>=d AND p.created_at<d+interval '1 day') AS projects FROM generate_series(date_trunc('day',now())-interval '6 days',date_trunc('day',now()),interval '1 day') d) t));
END $$;
REVOKE ALL ON FUNCTION public.portal_metrics() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_metrics() TO authenticated;
CREATE FUNCTION public.portal_team() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF NOT public.portal_can('team.manage') THEN RAISE EXCEPTION 'Forbidden'; END IF;
RETURN jsonb_build_object('members',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT r.user_id,r.role,r.permissions,u.email,p.display_name FROM public.user_roles r JOIN auth.users u ON u.id=r.user_id LEFT JOIN public.profiles p ON p.id=r.user_id ORDER BY r.created_at) t),'audit',(SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (SELECT a.action,a.details,a.created_at,u.email AS target_email FROM public.portal_audit a LEFT JOIN auth.users u ON u.id=a.target_id ORDER BY a.created_at DESC LIMIT 20) t));
END $$;
REVOKE ALL ON FUNCTION public.portal_team() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_team() TO authenticated;
CREATE FUNCTION public.portal_set_admin(target_email text, tasks text[], revoke_access boolean DEFAULT false) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE target uuid; BEGIN
IF NOT public.portal_can('team.manage') THEN RAISE EXCEPTION 'Only the owner can manage admins'; END IF;
IF tasks IS NULL OR NOT(tasks <@ ARRAY['users.read','usage.read','providers.read']::text[]) THEN RAISE EXCEPTION 'Invalid permissions'; END IF;
SELECT id INTO target FROM auth.users WHERE lower(email)=lower(trim(target_email)) AND email_confirmed_at IS NOT NULL;
IF target IS NULL THEN RAISE EXCEPTION 'User must create an account and confirm their email first'; END IF;
IF EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=target AND role='owner') THEN RAISE EXCEPTION 'Creator access cannot be changed'; END IF;
IF revoke_access THEN DELETE FROM public.user_roles WHERE user_id=target AND role='admin'; ELSE INSERT INTO public.user_roles(user_id,role,permissions) VALUES(target,'admin',tasks) ON CONFLICT(user_id) DO UPDATE SET permissions=excluded.permissions WHERE user_roles.role='admin'; END IF;
INSERT INTO public.portal_audit(actor_id,target_id,action,details) VALUES(auth.uid(),target,CASE WHEN revoke_access THEN 'Admin revoked' ELSE 'Admin permissions saved' END,jsonb_build_object('permissions',tasks));
END $$;
REVOKE ALL ON FUNCTION public.portal_set_admin(text,text[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_set_admin(text,text[],boolean) TO authenticated;