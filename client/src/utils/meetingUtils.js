/**
 * Utility functions for handling meeting UUIDs
 */

/**
 * Sanitize a meeting UUID for use in filenames (matches backend logic)
 * Replaces special characters with underscores
 */
export function sanitizeMeetingId(uuid) {
  if (!uuid) return ''
  return uuid.replace(/[<>:"\/\\|?*=\s]/g, '_')
}

/**
 * Encode a meeting UUID for use in URLs
 * Uses encodeURIComponent to handle special characters like = and /
 */
export function encodeMeetingId(uuid) {
  if (!uuid) return ''
  return encodeURIComponent(uuid)
}

/**
 * Decode a meeting UUID from URL parameter
 */
export function decodeMeetingId(encodedUuid) {
  if (!encodedUuid) return ''
  return decodeURIComponent(encodedUuid)
}
