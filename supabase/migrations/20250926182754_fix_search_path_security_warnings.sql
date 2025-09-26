-- Fix search_path security warnings for all functions
-- Setting search_path to an empty string prevents malicious search_path manipulation

-- Fix sync_user_to_auth function (trigger function)
ALTER FUNCTION public.sync_user_to_auth()
SET search_path = '';

-- Fix get_total_followup_count function (with parameter)
ALTER FUNCTION public.get_total_followup_count(p_tracked_email_id uuid)
SET search_path = '';

-- Fix handle_user_updated function (trigger function)
ALTER FUNCTION public.handle_user_updated()
SET search_path = '';

-- Fix sync_all_users_from_auth function
ALTER FUNCTION public.sync_all_users_from_auth()
SET search_path = '';

-- Fix reschedule_pending_followups function (with parameters)
ALTER FUNCTION public.reschedule_pending_followups(p_tracked_email_id uuid, p_base_time timestamp with time zone, p_adjustment_hours integer)
SET search_path = '';

-- Fix handle_new_user function (trigger function)
ALTER FUNCTION public.handle_new_user()
SET search_path = '';