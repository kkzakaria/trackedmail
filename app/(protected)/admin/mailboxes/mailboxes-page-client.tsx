"use client";

import { useState } from "react";
import { MailboxTable } from "@/components/mailboxes/MailboxTable";
import { MailboxForm } from "@/components/mailboxes/mailbox-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function MailboxesPageClient() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const handleCreateSuccess = () => {
    setShowCreateDialog(false);
    // The list will automatically update thanks to react-query
  };

  const handleOpenCreate = () => {
    setShowCreateDialog(true);
  };

  return (
    <div className="container mx-auto py-6">
      <MailboxTable onCreateNew={handleOpenCreate} />

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
