import { z } from 'zod';

/**
 * Schema for creating a new mailbox
 */
export const createMailboxSchema = z.object({
  email_address: z
    .string()
    .email('Format d\'email invalide')
    .min(1, 'L\'adresse email est requise')
    .max(255, 'L\'adresse email ne peut pas dépasser 255 caractères'),

  display_name: z
    .string()
    .min(1, 'Le nom d\'affichage est requis')
    .max(100, 'Le nom d\'affichage ne peut pas dépasser 100 caractères')
    .optional(),

  microsoft_user_id: z
    .string()
    .uuid('ID utilisateur Microsoft invalide')
    .optional(),

  is_active: z.boolean().default(true).optional(),
});

/**
 * Schema for updating a mailbox
 */
export const updateMailboxSchema = createMailboxSchema.partial();

/**
 * Schema for mailbox filters
 */
export const mailboxFiltersSchema = z.object({
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  limit: z.number().min(1).max(100).default(20).optional(),
  offset: z.number().min(0).default(0).optional(),
});

/**
 * Schema for assignment operations
 */
export const assignmentSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  mailboxId: z.string().uuid('ID boîte mail invalide'),
  assignedBy: z.string().uuid('ID assigneur invalide'),
});

/**
 * Schema for bulk assignment to user
 */
export const bulkAssignToUserSchema = z.object({
  userId: z.string().uuid('ID utilisateur invalide'),
  mailboxIds: z
    .array(z.string().uuid())
    .min(1, 'Au moins une boîte mail doit être sélectionnée')
    .max(50, 'Maximum 50 boîtes mail à la fois'),
  assignedBy: z.string().uuid('ID assigneur invalide'),
});

/**
 * Schema for bulk assignment to mailbox
 */
export const bulkAssignToMailboxSchema = z.object({
  mailboxId: z.string().uuid('ID boîte mail invalide'),
  userIds: z
    .array(z.string().uuid())
    .min(1, 'Au moins un utilisateur doit être sélectionné')
    .max(50, 'Maximum 50 utilisateurs à la fois'),
  assignedBy: z.string().uuid('ID assigneur invalide'),
});

// Type exports for TypeScript
export type CreateMailboxInput = z.infer<typeof createMailboxSchema>;
export type UpdateMailboxInput = z.infer<typeof updateMailboxSchema>;
export type MailboxFilters = z.infer<typeof mailboxFiltersSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
export type BulkAssignToUserInput = z.infer<typeof bulkAssignToUserSchema>;
export type BulkAssignToMailboxInput = z.infer<typeof bulkAssignToMailboxSchema>;