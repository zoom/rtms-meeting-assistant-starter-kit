// Utility functions for the RTMS meeting assistant

// Cap sanitized identifiers so pathological ids cannot create unbounded
// directory/file names.
const MAX_NAME_LENGTH = 128;

/**
 * Sanitize an external identifier (rtms_stream_id, user_id, ...) for safe use
 * in file paths and child_process arguments.
 *
 * Allowlist of [A-Za-z0-9._-]; everything else (including shell
 * metacharacters, slashes and whitespace) becomes an underscore.
 * @param {string} name - The filename or path to sanitize
 * @returns {string} - The sanitized filename
 */
export function sanitizeFileName(name) {
  const sanitized = String(name ?? '')
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_NAME_LENGTH);
  return sanitized || 'unnamed';
}
