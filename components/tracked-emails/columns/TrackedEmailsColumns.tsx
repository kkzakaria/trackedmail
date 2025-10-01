/**
 * TrackedEmailsColumns
 *
 * Column definitions for the tracked emails table.
 * Follows Single Responsibility Principle - defines only table columns.
 */

import { ColumnDef } from "@tanstack/react-table";
import { AlertTriangleIcon, MailIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { TrackedEmailStatusBadge } from "../TrackedEmailStatusBadge";
import { TrackedEmailActions } from "../TrackedEmailActions";
import { TruncatedTextWithTooltip } from "../TruncatedTextWithTooltip";
import { cn } from "@/lib/utils";
import {
  formatDate,
  formatRecipients,
  calculateDaysSince,
  formatRelativeTime,
} from "@/lib/utils/email-formatting";
import { multiColumnFilterFn, statusFilterFn } from "../hooks/useEmailFilters";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

export interface CreateColumnsOptions {
  onStatusUpdate: (emailId: string, status: EmailStatus) => Promise<void>;
  onViewDetails: (email: TrackedEmailWithDetails) => void;
  onSendFollowup: (email: TrackedEmailWithDetails) => void;
  onDelete: (email: TrackedEmailWithDetails) => Promise<void>;
}

/**
 * Create column definitions for the tracked emails table
 * @param options - Callback functions for actions
 * @returns Array of column definitions
 */
export function createTrackedEmailsColumns(
  options: CreateColumnsOptions
): ColumnDef<TrackedEmailWithDetails>[] {
  const { onStatusUpdate, onViewDetails, onSendFollowup, onDelete } = options;

  return [
    // Selection column
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      size: 28,
      enableSorting: false,
      enableHiding: false,
    },

    // Recipient column
    {
      header: "Destinataire",
      accessorKey: "recipient_emails",
      cell: ({ row }) => {
        const email = row.original;
        const recipients = formatRecipients(email.recipient_emails);
        const subject = email.subject;

        return (
          <div className="max-w-[250px] min-w-0">
            <TruncatedTextWithTooltip
              text={recipients}
              className="font-medium"
              tooltipSide="top"
            />
            <TruncatedTextWithTooltip
              text={subject}
              className="text-muted-foreground text-sm"
              tooltipSide="bottom"
            />
          </div>
        );
      },
      size: 250,
      filterFn: multiColumnFilterFn,
      enableHiding: false,
    },

    // Mailbox column
    {
      header: "Boîte mail",
      accessorKey: "mailbox",
      cell: ({ row }) => (
        <div className="text-sm">
          <div className="font-medium">
            {row.original.mailbox?.display_name || "N/A"}
          </div>
          <div className="text-muted-foreground">
            {row.original.mailbox?.email_address}
          </div>
        </div>
      ),
      size: 200,
    },

    // Status column
    {
      header: "Statut",
      accessorKey: "status",
      cell: ({ row }) => (
        <TrackedEmailStatusBadge status={row.getValue("status")} />
      ),
      size: 120,
      filterFn: statusFilterFn,
    },

    // Sent date column
    {
      header: "Envoyé le",
      accessorKey: "sent_at",
      cell: ({ row }) => {
        const email = row.original;
        const daysSince = calculateDaysSince(email.sent_at);
        return (
          <div className="text-sm">
            <div>{formatDate(email.sent_at)}</div>
            <div className="text-muted-foreground">
              {formatRelativeTime(daysSince)}
            </div>
          </div>
        );
      },
      size: 140,
    },

    // Followup count column
    {
      header: "Suivi",
      accessorKey: "followup_count",
      cell: ({ row }) => {
        const email = row.original;
        const highFollowupCount = email.followup_count >= 4;
        const requiresManualReview = email.requires_manual_review;

        return (
          <div className="text-center text-sm">
            <div className="flex items-center justify-center gap-1">
              <MailIcon className="h-3 w-3" />
              <span>0</span>
              {(highFollowupCount || requiresManualReview) && (
                <AlertTriangleIcon className="h-3 w-3 text-red-500" />
              )}
            </div>
            <div
              className={cn(
                "text-muted-foreground",
                (highFollowupCount || requiresManualReview) &&
                  "font-medium text-red-600"
              )}
            >
              {email.followup_count} relance
              {email.followup_count > 1 ? "s" : ""}
              {requiresManualReview && (
                <div className="mt-1 text-xs text-red-600">
                  Révision requise
                </div>
              )}
            </div>
          </div>
        );
      },
      size: 120,
    },

    // Actions column
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => (
        <TrackedEmailActions
          row={row}
          onStatusUpdate={onStatusUpdate}
          onViewDetails={onViewDetails}
          onSendFollowup={onSendFollowup}
          onDelete={onDelete}
        />
      ),
      size: 60,
      enableHiding: false,
    },
  ];
}
