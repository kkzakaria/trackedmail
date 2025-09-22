'use client';

import { useState } from 'react';
import { MailboxList } from '@/components/mailboxes/mailbox-list';
import { MailboxForm } from '@/components/mailboxes/mailbox-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/hooks/use-auth';
import { redirect } from 'next/navigation';

export default function MailboxesPage() {
  const { user, loading: isLoading } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Redirect if not authorized
  if (!isLoading && (!user || (user.role !== 'administrateur' && user.role !== 'manager'))) {
    redirect('/dashboard');
  }

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    // The list will automatically update thanks to react-query
  };

  const handleOpenCreate = () => {
    setShowCreateDialog(true);
  };

  return (
    <div className="container mx-auto py-6">
      <MailboxList onCreateNew={handleOpenCreate} />

      {/* Create dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle boîte mail</DialogTitle>
          </DialogHeader>
          <MailboxForm
            onSuccess={handleCreateSuccess}
            onCancel={() => setShowCreateDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}