// ui/gameNotifications.js

/**
 * @file Displays UI notifications and alerts to the user.
 * This module will contain functions to show success, error, and info messages.
 */

/**
 * Shows a success message.
 * @param {string} message - The message to display.
 */
export function showSuccess(message) {
  // TODO: Implement a proper notification UI
  console.log(`SUCCESS: ${message}`);
  alert(`SUCCESS: ${message}`);
}

/**
 * Shows an error message.
 * @param {string} message - The message to display.
 */
export function showError(message) {
  // TODO: Implement a proper notification UI
  console.error(`ERROR: ${message}`);
  alert(`ERROR: ${message}`);
}
