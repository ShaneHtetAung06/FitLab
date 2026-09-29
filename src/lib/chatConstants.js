/**
 * Chat constants shared by the API layer and the browser.
 *
 * Separate from lib/chat.js so client components can import the limit without
 * pulling Mongoose and the models into the bundle.
 */

/** Mirrors the maxlength on the ChatMessage schema. */
export const MESSAGE_MAX_LENGTH = 2000;

/** How often the UI refetches while the socket is down. */
export const THREAD_POLL_MS = 8000;
export const CONVERSATIONS_POLL_MS = 20000;
