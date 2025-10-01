/**
 * Email formatting utilities
 *
 * Provides formatting functions for email-related data display.
 * Follows Single Responsibility Principle - each function handles one formatting concern.
 */

/**
 * Format a date string for display in French format
 * @param dateString - ISO date string to format
 * @returns Formatted date string (e.g., "15/03/2024 à 14:30")
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

/**
 * Format recipient list for display with optional truncation
 * @param recipients - Array of email addresses
 * @param maxShow - Maximum number of recipients to show before truncating (default: 2)
 * @returns Formatted recipient string
 */
export const formatRecipients = (recipients: string[], maxShow = 2): string => {
  if (recipients.length <= maxShow) {
    return recipients.join(", ");
  }
  const shown = recipients.slice(0, maxShow).join(", ");
  const remaining = recipients.length - maxShow;
  return `${shown} +${remaining}`;
};

/**
 * Calculate days since a given date
 * @param dateString - ISO date string
 * @returns Number of days elapsed
 */
export const calculateDaysSince = (dateString: string): number => {
  const sentDate = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - sentDate.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Format a relative time description
 * @param days - Number of days
 * @returns Formatted string (e.g., "Il y a 3 jours")
 */
export const formatRelativeTime = (days: number): string => {
  if (days === 0) {
    return "Aujourd'hui";
  }
  if (days === 1) {
    return "Il y a 1 jour";
  }
  return `Il y a ${days} jours`;
};
