-- Seed data for TrackedMail application
-- This file contains test data for development and demonstration purposes
-- Uses Supabase test helpers for proper auth.users ↔ public.users integration

-- ============================================
-- 0. Enable required extensions and setup
-- ============================================

-- Ensure pgcrypto extension is available for test helpers
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. Cleanup existing data
-- ============================================

-- Clear existing data (in correct order to respect foreign keys)
DELETE FROM user_mailbox_assignments;
DELETE FROM email_responses;
DELETE FROM followups;
DELETE FROM tracked_emails;
DELETE FROM followup_templates;
DELETE FROM mailboxes;

-- Clean up any existing test users
SELECT tests.cleanup_test_users();

-- ============================================
-- 1. Create test users with proper authentication
-- ============================================

-- Create users using Supabase test helpers (creates both auth.users and public.users)
SELECT tests.create_supabase_user(
    'admin',
    'admin@company.com',
    'admin123',
    jsonb_build_object(
        'full_name', 'Jean Administrateur',
        'role', 'administrateur',
        'timezone', 'Europe/Paris',
        'pause_relances', false
    )
);

SELECT tests.create_supabase_user(
    'manager',
    'manager@company.com',
    'manager123',
    jsonb_build_object(
        'full_name', 'Marie Manager',
        'role', 'manager',
        'timezone', 'Europe/Paris',
        'pause_relances', false
    )
);

SELECT tests.create_supabase_user(
    'user1',
    'user1@company.com',
    'user123',
    jsonb_build_object(
        'full_name', 'Pierre Utilisateur',
        'role', 'utilisateur',
        'timezone', 'Europe/Paris',
        'pause_relances', false
    )
);

SELECT tests.create_supabase_user(
    'user2',
    'user2@company.com',
    'user123',
    jsonb_build_object(
        'full_name', 'Sophie Commercial',
        'role', 'utilisateur',
        'timezone', 'Europe/Paris',
        'pause_relances', false
    )
);

SELECT tests.create_supabase_user(
    'user3',
    'user3@company.com',
    'user123',
    jsonb_build_object(
        'full_name', 'Lucas Support',
        'role', 'utilisateur',
        'timezone', 'Europe/Paris',
        'pause_relances', true
    )
);

-- ============================================
-- 2. Insert test mailboxes
-- ============================================

INSERT INTO mailboxes (
    email_address,
    display_name,
    microsoft_user_id,
    is_active,
    last_sync,
    created_at,
    updated_at
) VALUES (
    'commercial@company.com',
    'Équipe Commerciale',
    '12345678-1234-4000-8000-123456789012',
    true,
    NOW() - INTERVAL '2 hours',
    NOW() - INTERVAL '7 days',
    NOW()
), (
    'support@company.com',
    'Service Support',
    '12345678-1234-4000-8000-123456789013',
    true,
    NOW() - INTERVAL '30 minutes',
    NOW() - INTERVAL '5 days',
    NOW()
), (
    'marketing@company.com',
    'Service Marketing',
    '12345678-1234-4000-8000-123456789014',
    false, -- Boîte mail inactive
    NULL, -- Jamais synchronisée
    NOW() - INTERVAL '3 days',
    NOW()
), (
    'direction@company.com',
    'Direction Générale',
    '12345678-1234-4000-8000-123456789015',
    true,
    NOW() - INTERVAL '1 hour',
    NOW() - INTERVAL '10 days',
    NOW()
), (
    'rh@company.com',
    'Ressources Humaines',
    NULL, -- Pas d'ID Microsoft configuré
    true,
    NULL,
    NOW() - INTERVAL '1 day',
    NOW()
);

-- ============================================
-- 3. Insert user-mailbox assignments
-- ============================================

-- Manager a accès à commercial et support
INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('manager'),
    commercial.id,
    tests.get_supabase_uid('admin'),
    NOW() - INTERVAL '4 days'
FROM
    mailboxes commercial
WHERE
    commercial.email_address = 'commercial@company.com';

INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('manager'),
    support.id,
    tests.get_supabase_uid('admin'),
    NOW() - INTERVAL '4 days'
FROM
    mailboxes support
WHERE
    support.email_address = 'support@company.com';

-- Pierre (user1) - Boîte commerciale
INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('user1'),
    commercial.id,
    tests.get_supabase_uid('manager'),
    NOW() - INTERVAL '3 days'
FROM
    mailboxes commercial
WHERE
    commercial.email_address = 'commercial@company.com';

-- Sophie (user2) - Boîtes commerciale et support
INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('user2'),
    commercial.id,
    tests.get_supabase_uid('manager'),
    NOW() - INTERVAL '3 days'
FROM
    mailboxes commercial
WHERE
    commercial.email_address = 'commercial@company.com';

INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('user2'),
    support.id,
    tests.get_supabase_uid('manager'),
    NOW() - INTERVAL '3 days'
FROM
    mailboxes support
WHERE
    support.email_address = 'support@company.com';

-- Lucas (user3) - Service support
INSERT INTO user_mailbox_assignments (user_id, mailbox_id, assigned_by, assigned_at)
SELECT
    tests.get_supabase_uid('user3'),
    support.id,
    tests.get_supabase_uid('manager'),
    NOW() - INTERVAL '2 days'
FROM
    mailboxes support
WHERE
    support.email_address = 'support@company.com';

-- ============================================
-- 4. Insert followup templates
-- ============================================

INSERT INTO followup_templates (
    name,
    subject,
    body,
    delay_hours,
    followup_number,
    is_active,
    created_at,
    updated_at
) VALUES (
    'Relance 1 - Amicale',
    'Re: {{original_subject}}',
    'Bonjour {{recipient_name}},

J''espère que vous allez bien. Je me permets de revenir vers vous concernant mon email précédent.

{{original_message}}

N''hésitez pas si vous avez des questions ou si vous souhaitez en discuter.

Cordialement,
{{sender_name}}',
    48, -- 2 jours
    1, -- 1ère relance
    true,
    NOW() - INTERVAL '10 days',
    NOW()
), (
    'Relance 2 - Professionnelle',
    'Suivi: {{original_subject}}',
    'Bonjour {{recipient_name}},

Je vous écris pour faire le point sur notre échange précédent.

{{original_message}}

Pourrions-nous organiser un point téléphonique cette semaine ?

Bien à vous,
{{sender_name}}',
    120, -- 5 jours
    2, -- 2ème relance
    true,
    NOW() - INTERVAL '10 days',
    NOW()
), (
    'Relance 3 - Finale',
    'Dernière relance: {{original_subject}}',
    'Bonjour {{recipient_name}},

N''ayant pas eu de retour de votre part, je me permets une dernière relance.

{{original_message}}

Si ce sujet n''est plus d''actualité pour vous, n''hésitez pas à me le faire savoir.

Merci pour votre attention.

Cordialement,
{{sender_name}}',
    168, -- 7 jours
    3, -- 3ème relance
    true,
    NOW() - INTERVAL '10 days',
    NOW()
);

-- ============================================
-- 5. Insert sample tracked emails
-- ============================================

-- Email en attente de réponse
INSERT INTO tracked_emails (
    mailbox_id,
    sender_email,
    recipient_emails,
    subject,
    body_preview,
    sent_at,
    microsoft_message_id,
    conversation_id,
    internet_message_id,
    status,
    created_at,
    updated_at
)
SELECT
    commercial.id,
    'commercial@company.com',
    ARRAY['client1@external.com'],
    'Proposition commerciale - Solution ERP',
    'Bonjour, suite à notre échange téléphonique...',
    NOW() - INTERVAL '3 days',
    'MSG001-commercial',
    'CONV001-commercial',
    '<msg001@commercial.company.com>',
    'pending',
    NOW() - INTERVAL '3 days',
    NOW()
FROM mailboxes commercial
WHERE commercial.email_address = 'commercial@company.com';

-- Email avec réponse reçue
INSERT INTO tracked_emails (
    mailbox_id,
    sender_email,
    recipient_emails,
    subject,
    body_preview,
    sent_at,
    microsoft_message_id,
    conversation_id,
    internet_message_id,
    status,
    created_at,
    updated_at
)
SELECT
    support.id,
    'support@company.com',
    ARRAY['user@customer.com'],
    'Résolution de votre ticket #12345',
    'Bonjour, votre problème a été résolu...',
    NOW() - INTERVAL '2 days',
    'MSG002-support',
    'CONV002-support',
    '<msg002@support.company.com>',
    'responded',
    NOW() - INTERVAL '2 days',
    NOW()
FROM mailboxes support
WHERE support.email_address = 'support@company.com';

-- Email avec plusieurs destinataires
INSERT INTO tracked_emails (
    mailbox_id,
    sender_email,
    recipient_emails,
    cc_emails,
    subject,
    body_preview,
    sent_at,
    microsoft_message_id,
    conversation_id,
    internet_message_id,
    status,
    created_at,
    updated_at
)
SELECT
    commercial.id,
    'commercial@company.com',
    ARRAY['prospect1@external.com', 'prospect2@external.com'],
    ARRAY['commercial-manager@company.com'],
    'Présentation de nos services',
    'Nous vous proposons une présentation de nos services...',
    NOW() - INTERVAL '5 days',
    'MSG003-commercial',
    'CONV003-commercial',
    '<msg003@commercial.company.com>',
    'pending',
    NOW() - INTERVAL '5 days',
    NOW()
FROM mailboxes commercial
WHERE commercial.email_address = 'commercial@company.com';

-- ============================================
-- 6. Insert sample email responses
-- ============================================

INSERT INTO email_responses (
    tracked_email_id,
    sender_email,
    subject,
    body_preview,
    received_at,
    microsoft_message_id,
    conversation_id,
    internet_message_id,
    created_at
)
SELECT
    te.id,
    'user@customer.com',
    'Re: Résolution de votre ticket #12345',
    'Merci beaucoup pour la résolution rapide...',
    NOW() - INTERVAL '1 day',
    'RESP001-support',
    'CONV002-support',
    '<resp001@customer.com>',
    NOW() - INTERVAL '1 day'
FROM tracked_emails te
JOIN mailboxes m ON m.id = te.mailbox_id
WHERE m.email_address = 'support@company.com'
  AND te.subject = 'Résolution de votre ticket #12345';

-- ============================================
-- 7. Insert sample followups
-- ============================================

INSERT INTO followups (
    tracked_email_id,
    template_id,
    scheduled_for,
    sent_at,
    subject,
    body,
    followup_number,
    status,
    created_at,
    updated_at
)
SELECT
    te.id,
    ft.id,
    NOW() + INTERVAL '1 day',
    NULL,
    'Re: Proposition commerciale - Solution ERP',
    'Bonjour, j''espère que vous allez bien. Je me permets de revenir vers vous...',
    1,
    'scheduled',
    NOW(),
    NOW()
FROM tracked_emails te
JOIN mailboxes m ON m.id = te.mailbox_id
JOIN followup_templates ft ON ft.name = 'Relance 1 - Amicale'
WHERE m.email_address = 'commercial@company.com'
  AND te.subject = 'Proposition commerciale - Solution ERP';

-- Followup déjà envoyé
INSERT INTO followups (
    tracked_email_id,
    template_id,
    scheduled_for,
    sent_at,
    subject,
    body,
    followup_number,
    status,
    microsoft_message_id,
    created_at,
    updated_at
)
SELECT
    te.id,
    ft.id,
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '6 hours',
    'Re: Présentation de nos services',
    'Bonjour, j''espère que vous allez bien...',
    1,
    'sent',
    'FUP001-commercial',
    NOW() - INTERVAL '1 day',
    NOW()
FROM tracked_emails te
JOIN mailboxes m ON m.id = te.mailbox_id
JOIN followup_templates ft ON ft.name = 'Relance 1 - Amicale'
WHERE m.email_address = 'commercial@company.com'
  AND te.subject = 'Présentation de nos services';

-- ============================================
-- 8. System configuration
-- ============================================

-- Configuration du tenant (mono-tenant)
UPDATE system_config
SET
    value = '"company.com"'::jsonb,
    updated_at = NOW()
WHERE key = 'tenant_domain';

UPDATE system_config
SET
    value = '{"start": "07:00", "end": "18:00", "timezone": "UTC"}'::jsonb,
    updated_at = NOW()
WHERE key = 'business_hours';

UPDATE system_config
SET
    value = '3'::jsonb,
    updated_at = NOW()
WHERE key = 'max_followups_per_email';

-- ============================================
-- 9. Seed data completed successfully
-- ============================================

-- Vérification: Affichage du nombre d'enregistrements créés
DO $$
DECLARE
    auth_users_count INTEGER;
    public_users_count INTEGER;
    mailboxes_count INTEGER;
    assignments_count INTEGER;
    templates_count INTEGER;
    tracked_emails_count INTEGER;
    responses_count INTEGER;
    followups_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO auth_users_count FROM auth.users WHERE email LIKE '%@company.com';
    SELECT COUNT(*) INTO public_users_count FROM public.users WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO mailboxes_count FROM mailboxes;
    SELECT COUNT(*) INTO assignments_count FROM user_mailbox_assignments;
    SELECT COUNT(*) INTO templates_count FROM followup_templates;
    SELECT COUNT(*) INTO tracked_emails_count FROM tracked_emails;
    SELECT COUNT(*) INTO responses_count FROM email_responses;
    SELECT COUNT(*) INTO followups_count FROM followups;

    RAISE NOTICE '=== SEED DATA SUMMARY ===';
    RAISE NOTICE 'Auth users: %', auth_users_count;
    RAISE NOTICE 'Public users: %', public_users_count;
    RAISE NOTICE 'Mailboxes: %', mailboxes_count;
    RAISE NOTICE 'Assignments: %', assignments_count;
    RAISE NOTICE 'Templates: %', templates_count;
    RAISE NOTICE 'Tracked emails: %', tracked_emails_count;
    RAISE NOTICE 'Responses: %', responses_count;
    RAISE NOTICE 'Followups: %', followups_count;
    RAISE NOTICE '========================';

    -- Vérifier la synchronisation auth.users ↔ public.users
    IF auth_users_count = public_users_count THEN
        RAISE NOTICE '✅ auth.users and public.users are properly synchronized';
    ELSE
        RAISE WARNING '❌ auth.users (%) and public.users (%) counts do not match!', auth_users_count, public_users_count;
    END IF;
END $$;