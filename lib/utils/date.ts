/**
 * Centralized "now" function for testable date creation.
 * All code that needs the current date/time should use this
 * instead of `new Date()` directly.
 */
export function now(): Date {
  return new Date();
}
