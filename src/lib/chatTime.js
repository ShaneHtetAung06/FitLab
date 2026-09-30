/**
 * Date formatting for the chat UI.
 *
 * Kept in its own module rather than in lib/chat.js: that file imports Mongoose
 * models, and pulling it into a client component would drag the whole data layer
 * into the browser bundle.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Clock time for a single message bubble, e.g. "14:03". */
export function formatMessageTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/** Compact timestamp for the conversation list preview line. */
export function formatConversationTime(value) {
  if (!value) return '';

  const date = new Date(value);
  const elapsed = Date.now() - date.getTime();

  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;

  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);

  if (days === 0) return formatMessageTime(date);
  if (days === 1) return 'Yesterday';
  if (days < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Heading text for a day separator inside a thread. */
export function formatDayDivider(value) {
  if (!value) return '';

  const date = new Date(value);
  const days = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY);

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

/** True when two messages fall on different calendar days. */
export function isNewDay(previous, current) {
  if (!previous) return true;
  return startOfDay(previous).getTime() !== startOfDay(current).getTime();
}
