/**
 * useEmailFilters Hook
 *
 * Provides custom filter functions for TanStack Table.
 * Follows Single Responsibility Principle - handles only filtering logic.
 */

import { FilterFn } from "@tanstack/react-table";
import type { TrackedEmailWithDetails, EmailStatus } from "@/lib/types";

/**
 * Multi-column filter function for searching across multiple email fields
 * Searches in: subject, recipient emails, sender email, and mailbox address
 */
export const multiColumnFilterFn: FilterFn<TrackedEmailWithDetails> = (
  row,
  _columnId,
  filterValue
) => {
  const email = row.original;
  const searchableContent = [
    email.subject,
    email.recipient_emails.join(" "),
    email.sender_email,
    email.mailbox?.email_address || "",
  ]
    .join(" ")
    .toLowerCase();

  const searchTerm = (filterValue ?? "").toLowerCase();
  return searchableContent.includes(searchTerm);
};

/**
 * Status filter function for filtering by email status
 * Supports multiple status values
 */
export const statusFilterFn: FilterFn<TrackedEmailWithDetails> = (
  row,
  columnId,
  filterValue: EmailStatus[]
) => {
  if (!filterValue?.length) return true;
  const status = row.getValue(columnId) as EmailStatus;
  return filterValue.includes(status);
};

/**
 * Hook to provide filter functions
 * @returns Object containing all custom filter functions
 */
export function useEmailFilters() {
  return {
    multiColumnFilterFn,
    statusFilterFn,
  };
}
