-- Enable RLS on email_bounces table
ALTER TABLE email_bounces ENABLE ROW LEVEL SECURITY;

-- Policy: Allow users to view bounces for emails from their assigned mailboxes
CREATE POLICY "Users can view bounces for their assigned mailboxes" ON email_bounces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tracked_emails te
            JOIN mailboxes m ON te.mailbox_id = m.id
            JOIN user_mailbox_assignments uma ON m.id = uma.mailbox_id
            WHERE te.id = email_bounces.tracked_email_id
            AND uma.user_id = auth.uid()
        )
    );

-- Policy: Allow managers and admins to view all bounces
CREATE POLICY "Managers can view all bounces" ON email_bounces
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role IN ('administrateur', 'manager')
        )
    );

-- Policy: Allow service role to insert bounces (for webhook processing)
CREATE POLICY "Service role can insert bounces" ON email_bounces
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role'
    );

-- Policy: Allow service role to update bounces (for webhook processing)
CREATE POLICY "Service role can update bounces" ON email_bounces
    FOR UPDATE
    USING (
        auth.role() = 'service_role'
    );

-- Policy: Allow admins to delete bounces
CREATE POLICY "Admins can delete bounces" ON email_bounces
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid()
            AND role = 'administrateur'
        )
    );