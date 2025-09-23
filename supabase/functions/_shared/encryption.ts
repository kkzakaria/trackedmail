/**
 * Robust AES-256-GCM Encryption Module for Supabase Edge Functions
 *
 * Provides secure encryption/decryption for sensitive data with:
 * - AES-256-GCM encryption (authenticated encryption)
 * - Random IV generation for each operation
 * - Base64 encoding for storage compatibility
 * - Comprehensive error handling
 * - OWASP security compliance
 */

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  data: string      // Base64 encoded encrypted data
  iv: string        // Base64 encoded initialization vector
  tag: string       // Base64 encoded authentication tag
}

/**
 * Encryption error types
 */
export class EncryptionError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'EncryptionError'
  }
}

/**
 * Get encryption key from environment variable
 * Uses MICROSOFT_TOKEN_ENCRYPTION_KEY as the master key
 */
function getEncryptionKey(): Promise<CryptoKey> {
  const keyBase64 = Deno.env.get('MICROSOFT_TOKEN_ENCRYPTION_KEY')

  if (!keyBase64) {
    throw new EncryptionError('MICROSOFT_TOKEN_ENCRYPTION_KEY environment variable is not set')
  }

  try {
    // Decode base64 key
    const keyBuffer = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0))

    // Validate key length (256 bits = 32 bytes)
    if (keyBuffer.length !== 32) {
      throw new EncryptionError(`Invalid key length: expected 32 bytes, got ${keyBuffer.length}`)
    }

    // Import key for AES-GCM
    return crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false, // not extractable
      ['encrypt', 'decrypt']
    )
  } catch (error) {
    throw new EncryptionError('Failed to import encryption key', error)
  }
}

/**
 * Encrypt plaintext using AES-256-GCM
 *
 * @param plaintext - The text to encrypt
 * @returns Promise<EncryptedData> - Encrypted data with IV and authentication tag
 *
 * @example
 * ```typescript
 * const encrypted = await encryptData('sensitive-token-123')
 * console.log(encrypted.data) // Base64 encrypted data
 * ```
 */
export async function encryptData(plaintext: string): Promise<EncryptedData> {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new EncryptionError('Plaintext must be a non-empty string')
  }

  try {
    // Get encryption key
    const key = await getEncryptionKey()

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12))

    // Convert plaintext to bytes
    const encoder = new TextEncoder()
    const plaintextBytes = encoder.encode(plaintext)

    // Encrypt with AES-GCM
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
        tagLength: 128 // 128-bit authentication tag
      },
      key,
      plaintextBytes
    )

    // Extract ciphertext and tag
    const encryptedBytes = new Uint8Array(encrypted)
    const ciphertext = encryptedBytes.slice(0, -16) // All but last 16 bytes
    const tag = encryptedBytes.slice(-16) // Last 16 bytes are the tag

    // Return base64 encoded components
    return {
      data: btoa(String.fromCharCode(...ciphertext)),
      iv: btoa(String.fromCharCode(...iv)),
      tag: btoa(String.fromCharCode(...tag))
    }
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    throw new EncryptionError('Encryption failed', error)
  }
}

/**
 * Decrypt data encrypted with encryptData()
 *
 * @param encryptedData - The encrypted data structure
 * @returns Promise<string> - The decrypted plaintext
 *
 * @example
 * ```typescript
 * const plaintext = await decryptData(encrypted)
 * console.log(plaintext) // 'sensitive-token-123'
 * ```
 */
export async function decryptData(encryptedData: EncryptedData): Promise<string> {
  if (!encryptedData || typeof encryptedData !== 'object') {
    throw new EncryptionError('Invalid encrypted data structure')
  }

  const { data, iv, tag } = encryptedData

  if (!data || !iv || !tag) {
    throw new EncryptionError('Missing required fields: data, iv, or tag')
  }

  try {
    // Get encryption key
    const key = await getEncryptionKey()

    // Decode base64 components
    const ciphertext = Uint8Array.from(atob(data), c => c.charCodeAt(0))
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0))
    const tagBytes = Uint8Array.from(atob(tag), c => c.charCodeAt(0))

    // Validate IV length
    if (ivBytes.length !== 12) {
      throw new EncryptionError(`Invalid IV length: expected 12 bytes, got ${ivBytes.length}`)
    }

    // Validate tag length
    if (tagBytes.length !== 16) {
      throw new EncryptionError(`Invalid tag length: expected 16 bytes, got ${tagBytes.length}`)
    }

    // Combine ciphertext and tag for decryption
    const encryptedBytes = new Uint8Array(ciphertext.length + tagBytes.length)
    encryptedBytes.set(ciphertext)
    encryptedBytes.set(tagBytes, ciphertext.length)

    // Decrypt with AES-GCM
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128
      },
      key,
      encryptedBytes
    )

    // Convert bytes back to string
    const decoder = new TextDecoder()
    return decoder.decode(decrypted)

  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    // Authentication failure or decryption error
    if (error instanceof Error && error.message.includes('OperationError')) {
      throw new EncryptionError('Decryption failed: invalid data or key')
    }
    throw new EncryptionError('Decryption failed', error)
  }
}

/**
 * Utility function to generate a secure encryption key
 * Use this to generate a new MICROSOFT_TOKEN_ENCRYPTION_KEY
 *
 * @returns string - Base64 encoded 256-bit key
 *
 * @example
 * ```typescript
 * const newKey = generateEncryptionKey()
 * console.log('New encryption key:', newKey)
 * ```
 */
export function generateEncryptionKey(): string {
  const key = crypto.getRandomValues(new Uint8Array(32)) // 256 bits
  return btoa(String.fromCharCode(...key))
}

/**
 * Validate if a string appears to be encrypted data
 *
 * @param data - String to validate
 * @returns boolean - True if it looks like encrypted data
 */
export function isEncryptedFormat(data: string): boolean {
  try {
    const parsed = JSON.parse(data)
    return (
      typeof parsed === 'object' &&
      typeof parsed.data === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.tag === 'string'
    )
  } catch {
    return false
  }
}

/**
 * Serialize encrypted data to JSON string for storage
 *
 * @param encryptedData - Encrypted data structure
 * @returns string - JSON string representation
 */
export function serializeEncryptedData(encryptedData: EncryptedData): string {
  return JSON.stringify(encryptedData)
}

/**
 * Deserialize JSON string back to encrypted data structure
 *
 * @param serialized - JSON string from serializeEncryptedData
 * @returns EncryptedData - Parsed encrypted data structure
 */
export function deserializeEncryptedData(serialized: string): EncryptedData {
  try {
    const parsed = JSON.parse(serialized)

    if (!parsed.data || !parsed.iv || !parsed.tag) {
      throw new EncryptionError('Invalid serialized encrypted data')
    }

    return parsed as EncryptedData
  } catch (error) {
    if (error instanceof EncryptionError) {
      throw error
    }
    throw new EncryptionError('Failed to deserialize encrypted data', error)
  }
}