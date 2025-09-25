/**
 * Types TypeScript pour l'intégration Microsoft Graph
 * Utilisés pour l'authentification, webhooks, et gestion des emails
 */

// ===== AUTHENTIFICATION =====

export interface MicrosoftGraphToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  expires_at: Date;
}

export interface MicrosoftGraphAuthConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  scopes: string[];
}

// ===== WEBHOOKS =====

export interface MicrosoftGraphWebhookNotification {
  subscriptionId: string;
  changeType: "created" | "updated" | "deleted";
  tenantId: string;
  clientState: string;
  subscriptionExpirationDateTime: string;
  resource: string;
  resourceData: {
    "@odata.type": string;
    "@odata.id": string;
    "@odata.etag"?: string;
    id: string;
  };
  encryptedContent?: {
    data: string;
    dataSignature: string;
    dataKey: string;
    encryptionCertificateId: string;
    encryptionCertificateThumbprint: string;
  };
}

export interface MicrosoftGraphWebhookPayload {
  value: MicrosoftGraphWebhookNotification[];
  validationTokens?: string[];
}

export interface WebhookSubscriptionRequest {
  changeType: string;
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  resource: string;
  expirationDateTime: string;
  clientState: string;
  includeResourceData?: boolean;
  encryptionCertificate?: string;
  encryptionCertificateId?: string;
}

export interface WebhookSubscriptionResponse {
  id: string;
  resource: string;
  applicationId: string;
  changeType: string;
  clientState: string;
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  expirationDateTime: string;
  creatorId: string;
  includeResourceData: boolean;
  latestSupportedTlsVersion: string;
  encryptionCertificate?: string;
  encryptionCertificateId?: string;
  notificationContentType?: string;
}

// ===== EMAILS =====

export interface MicrosoftGraphEmailMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  changeKey: string;
  categories: string[];
  receivedDateTime: string;
  sentDateTime: string;
  hasAttachments: boolean;
  internetMessageId: string;
  subject: string;
  bodyPreview: string;
  importance: "low" | "normal" | "high";
  parentFolderId: string;
  conversationId: string;
  conversationIndex?: string;
  isDeliveryReceiptRequested: boolean;
  isReadReceiptRequested: boolean;
  isRead: boolean;
  isDraft: boolean;
  webLink: string;
  inferenceClassification: "focused" | "other";

  // Corps du message
  body: {
    contentType: "text" | "html";
    content: string;
  };

  // Participants
  sender: EmailAddress;
  from: EmailAddress;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  bccRecipients: EmailAddress[];
  replyTo: EmailAddress[];

  // Headers pour threading
  internetMessageHeaders?: InternetMessageHeader[];

  // Propriétés pour threading avancé
  inReplyTo?: string;
  references?: string;

  // Pièces jointes
  attachments?: EmailAttachment[];
}

export interface EmailAddress {
  emailAddress: {
    name: string;
    address: string;
  };
}

export interface InternetMessageHeader {
  name: string;
  value: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  lastModifiedDateTime: string;
}

// ===== UTILISATEURS =====

export interface MicrosoftGraphUser {
  id: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  surname: string;
  mail: string;
  mobilePhone?: string;
  officeLocation?: string;
  preferredLanguage?: string;
  jobTitle?: string;
  department?: string;
}

// ===== THREADING ET DÉTECTION =====

export interface EmailThreadingInfo {
  conversationId?: string;
  conversationIndex?: string;
  internetMessageId?: string;
  inReplyTo?: string;
  references?: string[];
  subject?: string;
  cleanSubject?: string;
  threadDepth?: number;
  isNewThread?: boolean;
}

export interface EmailDetectionResult {
  isResponse: boolean;
  trackedEmailId?: string;
  detectionMethod:
    | "conversation_id"
    | "in_reply_to"
    | "references"
    | "heuristic"
    | "not_detected";
  confidence: number;
  rejectionReason?:
    | "internal_email"
    | "already_responded"
    | "auto_response"
    | "no_match";
}

// ===== CONFIGURATION SYSTÈME =====

export interface TenantConfig {
  domain: string;
  microsoft_tenant_id: string;
  exclude_internal_emails: boolean;
}

export interface MicrosoftGraphConfig {
  baseUrl: string;
  apiVersion: string;
  maxRetries: number;
  timeoutMs: number;
  rateLimitDelay: number;
}

// ===== ERREURS =====

export interface MicrosoftGraphError {
  code: string;
  message: string;
  innerError?: {
    code: string;
    message: string;
    date: string;
    "request-id": string;
    "client-request-id": string;
  };
}

export interface MicrosoftGraphApiError extends Error {
  code: string;
  statusCode: number;
  requestId?: string;
  timestamp: Date;
}

// ===== SERVICES =====

export interface WebhookServiceConfig {
  baseUrl: string;
  // secret supprimé - géré par les Edge Functions Supabase
  maxRenewalsPerDay: number;
  renewBeforeExpiryHours: number;
}

export interface EmailProcessingConfig {
  excludeInternalEmails: boolean;
  enableHeuristicDetection: boolean;
  maxThreadDepth: number;
  autoResponseHeaders: string[];
}

// ===== STATISTIQUES =====

export interface MicrosoftGraphStats {
  totalSubscriptions: number;
  activeSubscriptions: number;
  expiringSoon: number;
  webhooksReceived24h: number;
  emailsDetected24h: number;
  responsesDetected24h: number;
  errorRate: number;
}

export interface DetectionStats {
  totalAttempts: number;
  successfulDetections: number;
  failedDetections: number;
  methodBreakdown: {
    conversation_id: number;
    in_reply_to: number;
    references: number;
    heuristic: number;
    not_detected: number;
  };
  rejectionReasons: {
    internal_email: number;
    already_responded: number;
    auto_response: number;
    no_match: number;
  };
}

// ===== TYPES UTILITAIRES =====

export type SubscriptionChangeType = "created" | "updated" | "deleted";
export type EmailImportance = "low" | "normal" | "high";
export type DetectionMethod =
  | "conversation_id"
  | "in_reply_to"
  | "references"
  | "heuristic"
  | "not_detected";
export type RejectionReason =
  | "internal_email"
  | "already_responded"
  | "auto_response"
  | "no_match";

// ===== RÉPONSES API =====

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export interface WebhookValidationResponse {
  valid: boolean;
  subscriptionId?: string;
  error?: string;
}

export interface SubscriptionStatus {
  id: string;
  isActive: boolean;
  expiresAt: Date;
  lastRenewal?: Date;
  renewalCount: number;
  resource: string;
  mailboxId: string;
}

// ===== MAILBOX SERVICE TYPES =====

export interface MailboxSyncResult {
  mailbox: Record<string, unknown>;
  userInfo: MicrosoftGraphUser;
  updatedFields: string[];
}

export interface MailboxConfigurationResult {
  mailbox: Record<string, unknown>;
  userInfo: MicrosoftGraphUser;
}

export interface WebhookSubscriptionResult {
  subscription: SubscriptionStatus;
  created: boolean;
}

export interface WebhookStatusResult {
  hasActiveSubscription: boolean;
  subscription?: SubscriptionStatus;
  health: "healthy" | "expiring" | "expired" | "error";
}

export interface WebhookRemovalResult {
  deleted: boolean;
  subscriptionId?: string;
}
