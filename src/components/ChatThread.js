'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import ChatAvatar from '@/components/ChatAvatar';
import { MESSAGE_MAX_LENGTH, THREAD_POLL_MS } from '@/lib/chatConstants';
import { formatDayDivider, formatMessageTime, isNewDay } from '@/lib/chatTime';

/** Distance from the bottom, in px, still treated as "following the conversation". */
const STICK_THRESHOLD = 120;

/** How long a typing indicator survives without a refresh from the other side. */
const TYPING_TIMEOUT_MS = 5000;

/** Idle gap after which we tell the other side we stopped typing. */
const TYPING_IDLE_MS = 2000;

/**
 * Inserts or updates a message by id and keeps the list in chronological order.
 * Written to be idempotent because the same message can arrive twice: once as the
 * reply to POST /api/chat/messages, and once over the socket, with no guaranteed
 * order between them.
 */
function mergeMessage(list, incoming, removeId) {
  const base = removeId ? list.filter((item) => item._id !== removeId) : list;
  const index = base.findIndex((item) => item._id === incoming._id);

  const next =
    index >= 0
      ? base.map((item, position) =>
          position === index ? { ...item, ...incoming } : item
        )
      : [...base, incoming];

  return next.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * A single conversation: history, live updates, and the composer.
 *
 * Sending goes over HTTP rather than the socket, because that is where
 * authorization and persistence live. The socket only carries the resulting
 * broadcast, so the thread still works when the socket is down -- it falls back
 * to polling, and `connected` drives that choice.
 */
export default function ChatThread({
  courseId,
  partnerId,
  preview,
  onActivity,
  onRead,
  onBack,
}) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();

  const meId = user?._id ? String(user._id) : null;

  const [messages, setMessages] = useState([]);
  const [course, setCourse] = useState(preview?.course || null);
  const [partner, setPartner] = useState(preview?.partner || null);
  const [room, setRoom] = useState('');
  const [roomToken, setRoomToken] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [oldestCursor, setOldestCursor] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);

  const scrollRef = useRef(null);
  const roomRef = useRef('');
  const stickToBottomRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const wasConnectedRef = useRef(false);
  const typingIdleRef = useRef(null);
  const typingActiveRef = useRef(false);
  const partnerTypingRef = useRef(null);

  // Callbacks and the preview are read through refs so that a parent re-render
  // cannot invalidate loadThread and trigger a refetch loop.
  const onActivityRef = useRef(onActivity);
  const onReadRef = useRef(onRead);
  const previewRef = useRef(preview);

  useEffect(() => {
    onActivityRef.current = onActivity;
    onReadRef.current = onRead;
    previewRef.current = preview;
  });

  const conversationId = courseId && partnerId ? `${courseId}:${partnerId}` : '';

  const isNearBottom = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return true;
    return (
      element.scrollHeight - element.scrollTop - element.clientHeight < STICK_THRESHOLD
    );
  }, []);

  /**
   * Fetches the newest page. `silent` is used by polling and by reconnect
   * recovery: it merges instead of replacing, so an in-flight optimistic message
   * is not wiped out mid-send.
   */
  const loadThread = useCallback(
    async ({ silent = false } = {}) => {
      if (!courseId || !partnerId) return;

      if (!silent) {
        setIsLoading(true);
        setLoadError('');
      }

      try {
        const params = new URLSearchParams({ courseId, withUserId: partnerId });
        const res = await fetch(`/api/chat/messages?${params.toString()}`);
        const data = await res.json();

        if (!data.success) {
          if (!silent) {
            const message = data.message || 'Could not open this conversation';
            setLoadError(message);
            toast.error(message);
          }
          return;
        }

        setMessages((previous) =>
          silent
            ? data.messages.reduce((acc, item) => mergeMessage(acc, item), previous)
            : data.messages
        );
        setCourse(data.course);
        setPartner(data.partner);
        setRoom(data.room);
        roomRef.current = data.room;
        setRoomToken(data.roomToken);
        setHasMore(data.pagination.hasMore);
        setOldestCursor(data.pagination.nextCursor);
        setLoadError('');
        hasLoadedRef.current = true;

        // The GET cleared unread server-side, so the badge should follow.
        onReadRef.current?.(`${courseId}:${partnerId}`);
      } catch (error) {
        if (!silent) {
          setLoadError('Could not open this conversation');
          toast.error('Could not open this conversation');
        }
      } finally {
        if (!silent) setIsLoading(false);
      }
    },
    [courseId, partnerId]
  );

  // Switching conversations resets everything, including the optimistic-scroll
  // flag, so the new thread opens pinned to its newest message.
  useEffect(() => {
    setMessages([]);
    setRoom('');
    roomRef.current = '';
    setRoomToken('');
    setPartnerTyping(false);
    setHasMore(false);
    setOldestCursor(null);
    setDraft('');
    setLoadError('');
    setCourse(previewRef.current?.course || null);
    setPartner(previewRef.current?.partner || null);
    hasLoadedRef.current = false;
    stickToBottomRef.current = true;

    loadThread();
  }, [courseId, partnerId, loadThread]);

  const markRead = useCallback(async () => {
    if (!courseId || !partnerId) return;
    // Marking a message read while the tab is in the background would be a lie;
    // the visibility listener below picks it up when they come back.
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    try {
      await fetch('/api/chat/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, withUserId: partnerId }),
      });
      onReadRef.current?.(`${courseId}:${partnerId}`);
    } catch (error) {
      // Not worth interrupting the user: the next thread load clears it anyway.
    }
  }, [courseId, partnerId]);

  const stopTyping = useCallback(() => {
    clearTimeout(typingIdleRef.current);
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    if (socket && roomRef.current) {
      socket.emit('typing', { room: roomRef.current, isTyping: false });
    }
  }, [socket]);

  const signalTyping = useCallback(() => {
    if (!socket || !connected || !roomRef.current) return;

    // Only the transitions are sent, not a burst per keystroke.
    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      socket.emit('typing', { room: roomRef.current, isTyping: true });
    }

    clearTimeout(typingIdleRef.current);
    typingIdleRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
  }, [socket, connected, stopTyping]);

  // Joining the room is what makes typing indicators flow. The token proves the
  // server already checked entitlement, so no DB lookup happens on the socket
  // side. Re-runs after a reconnect because room membership is per-connection.
  useEffect(() => {
    if (!socket || !connected || !roomToken) return undefined;

    socket.emit('conversation:join', { roomToken }, (ack) => {
      if (!ack?.ok) {
        console.warn('Could not join chat room:', ack?.error);
      }
    });

    const joinedRoom = room;
    return () => {
      if (joinedRoom) socket.emit('conversation:leave', { room: joinedRoom });
    };
  }, [socket, connected, roomToken, room]);

  // Live events. Scoped to this conversation by course plus participant pair, so
  // traffic for the user's other threads is ignored here and handled by the page.
  useEffect(() => {
    if (!socket || !meId || !partnerId) return undefined;

    const belongsHere = (message) => {
      if (!message) return false;
      if (String(message.course) !== String(courseId)) return false;
      const pair = [String(message.sender), String(message.receiver)];
      return pair.includes(String(meId)) && pair.includes(String(partnerId));
    };

    const handleNew = (payload) => {
      const message = payload?.message;
      if (!belongsHere(message)) return;

      const mine = String(message.sender) === String(meId);
      // Own messages always scroll into view; someone else's only if the user has
      // not scrolled up to read history.
      stickToBottomRef.current = mine || isNearBottom();

      setMessages((previous) => mergeMessage(previous, message));

      if (!mine) {
        setPartnerTyping(false);
        markRead();
      }

      onActivityRef.current?.({
        courseId: String(courseId),
        partnerId: String(partnerId),
        message,
      });
    };

    const handleRead = (payload) => {
      if (String(payload?.readerId) !== String(partnerId)) return;
      if (String(payload?.courseId) !== String(courseId)) return;

      setMessages((previous) =>
        previous.map((item) =>
          String(item.sender) === String(meId) && !item.read
            ? { ...item, read: true }
            : item
        )
      );
    };

    const handleTyping = (payload) => {
      if (String(payload?.userId) !== String(partnerId)) return;
      if (roomRef.current && payload?.room !== roomRef.current) return;

      setPartnerTyping(Boolean(payload.isTyping));
      clearTimeout(partnerTypingRef.current);

      if (payload.isTyping) {
        // Guards against a missed "stopped" event leaving the dots on forever.
        partnerTypingRef.current = setTimeout(
          () => setPartnerTyping(false),
          TYPING_TIMEOUT_MS
        );
      }
    };

    socket.on('message:new', handleNew);
    socket.on('messages:read', handleRead);
    socket.on('typing', handleTyping);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('messages:read', handleRead);
      socket.off('typing', handleTyping);
    };
  }, [socket, courseId, partnerId, meId, isNearBottom, markRead]);

  // Messages sent while the socket was down were never broadcast to this client,
  // so recovering the connection has to be followed by a refetch.
  useEffect(() => {
    if (!connected) {
      wasConnectedRef.current = false;
      return;
    }
    if (wasConnectedRef.current) return;

    wasConnectedRef.current = true;
    if (hasLoadedRef.current) {
      loadThread({ silent: true });
    }
  }, [connected, loadThread]);

  // Polling only exists as the fallback for a missing or broken socket, which is
  // also the case when the app is served without the custom server.
  useEffect(() => {
    if (connected) return undefined;

    const interval = setInterval(() => loadThread({ silent: true }), THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [connected, loadThread]);

  // Coming back to the tab is the moment unread messages should clear.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (messages.some((item) => String(item.receiver) === String(meId) && !item.read)) {
        markRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [messages, meId, markRead]);

  useEffect(() => stopTyping, [stopTyping]);

  // Runs before paint so the jump to the newest message is never visible.
  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, partnerTyping, isLoading]);

  const loadOlder = async () => {
    if (!hasMore || isLoadingMore || !oldestCursor) return;

    setIsLoadingMore(true);
    const element = scrollRef.current;
    const previousHeight = element?.scrollHeight || 0;
    const previousTop = element?.scrollTop || 0;

    try {
      const params = new URLSearchParams({
        courseId,
        withUserId: partnerId,
        before: new Date(oldestCursor).toISOString(),
      });
      const res = await fetch(`/api/chat/messages?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(data.message || 'Could not load earlier messages');
        return;
      }

      // Prepending shifts everything down, so hold the reading position rather
      // than letting the browser keep scrollTop and appear to jump.
      stickToBottomRef.current = false;
      setMessages((previous) =>
        data.messages.reduce((acc, item) => mergeMessage(acc, item), previous)
      );
      setHasMore(data.pagination.hasMore);
      setOldestCursor(data.pagination.nextCursor);

      requestAnimationFrame(() => {
        const next = scrollRef.current;
        if (next) {
          next.scrollTop = previousTop + (next.scrollHeight - previousHeight);
        }
      });
    } catch (error) {
      toast.error('Could not load earlier messages');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();

    const text = draft.trim();
    if (!text || isSending || !partnerId) return;

    if (text.length > MESSAGE_MAX_LENGTH) {
      toast.error(`Message cannot be more than ${MESSAGE_MAX_LENGTH} characters`);
      return;
    }

    stopTyping();

    const tempId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimistic = {
      _id: tempId,
      course: String(courseId),
      sender: meId,
      receiver: String(partnerId),
      message: text,
      read: false,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    stickToBottomRef.current = true;
    setMessages((previous) => mergeMessage(previous, optimistic));
    setDraft('');
    setIsSending(true);

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, receiverId: partnerId, message: text }),
      });
      const data = await res.json();

      if (!data.success) {
        // Drop the bubble but hand the text back, so a rejected message is not
        // silently lost from the textarea.
        setMessages((previous) => previous.filter((item) => item._id !== tempId));
        setDraft((current) => current || text);
        toast.error(data.message || 'Message not sent');
        return;
      }

      setMessages((previous) => mergeMessage(previous, data.chatMessage, tempId));
      onActivityRef.current?.({
        courseId: String(courseId),
        partnerId: String(partnerId),
        message: data.chatMessage,
      });
    } catch (error) {
      setMessages((previous) => previous.filter((item) => item._id !== tempId));
      setDraft((current) => current || text);
      toast.error('Message not sent');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event) => {
    // Enter sends, Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  };

  const remaining = MESSAGE_MAX_LENGTH - draft.length;

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="spinner h-9 w-9" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h2 className="display text-lg">Conversation unavailable</h2>
          <p className="mt-2 text-[13px] text-ink-500">{loadError}</p>
          <button
            type="button"
            onClick={() => loadThread()}
            className="btn btn-outline btn-sm mt-5"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-ink-100 bg-white px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="-ml-1 p-1 text-ink-500 transition-colors hover:text-primary-600 md:hidden"
          aria-label="Back to conversations"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <ChatAvatar name={partner?.name} avatar={partner?.avatar} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-display text-base font-bold text-ink-900">
              {partner?.name || 'Conversation'}
            </h2>
            {partner?.role === 'trainer' && (
              <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                Trainer
              </span>
            )}
          </div>
          {course && (
            <Link
              href={`/courses/${course._id}`}
              className="block truncate text-[11px] text-ink-500 transition-colors hover:text-primary-600"
            >
              {course.title}
            </Link>
          )}
        </div>

        {/* Honest about the transport: when this shows, updates are arriving by
            polling rather than instantly. */}
        {!connected && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-600">
            <span className="h-1.5 w-1.5 rounded-full bg-ink-400" aria-hidden="true" />
            Reconnecting
          </span>
        )}
      </header>

      <div
        ref={scrollRef}
        onScroll={() => {
          stickToBottomRef.current = isNearBottom();
        }}
        className="flex-1 overflow-y-auto bg-bone px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${partner?.name || 'your contact'}`}
      >
        {hasMore && (
          <div className="mb-4 flex justify-center">
            <button
              type="button"
              onClick={loadOlder}
              disabled={isLoadingMore}
              className="btn btn-outline px-3 py-1.5 text-[12px]"
            >
              {isLoadingMore ? 'Loading…' : 'Load earlier messages'}
            </button>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="max-w-xs text-center text-[13px] text-ink-500">
              No messages yet. Say hello to {partner?.name || 'your contact'}.
            </p>
          </div>
        ) : (
          <ul className="space-y-1">
            {messages.map((item, index) => {
              const mine = String(item.sender) === String(meId);
              const previous = index > 0 ? messages[index - 1] : null;
              const showDivider = isNewDay(
                previous ? new Date(previous.createdAt) : null,
                new Date(item.createdAt)
              );

              return (
                <li key={item._id}>
                  {showDivider && (
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full border border-ink-100 bg-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                        {formatDayDivider(item.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] px-3.5 py-2 sm:max-w-[70%] ${
                        mine
                          ? 'rounded-[14px] rounded-br-[4px] bg-primary-600 text-white'
                          : 'rounded-[14px] rounded-bl-[4px] border border-ink-100 bg-white text-ink-900'
                      } ${item.pending ? 'opacity-70' : ''}`}
                    >
                      {/* Preserves the line breaks people actually type, without
                          rendering any markup from the message body. */}
                      <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">
                        {item.message}
                      </p>
                      <p
                        className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                          mine ? 'text-white/70' : 'text-ink-400'
                        }`}
                      >
                        <time dateTime={new Date(item.createdAt).toISOString()}>
                          {formatMessageTime(item.createdAt)}
                        </time>
                        {mine && (
                          <span>
                            {item.pending ? '· sending' : item.read ? '· read' : '· sent'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {partnerTyping && (
          <p className="mt-2 text-[12px] italic text-ink-500" aria-live="polite">
            {partner?.name || 'They'} is typing…
          </p>
        )}
      </div>

      <form
        onSubmit={sendMessage}
        className="flex items-end gap-2 border-t border-ink-100 bg-white px-3 py-3"
      >
        <label htmlFor="chat-composer" className="sr-only">
          Write a message
        </label>
        <textarea
          id="chat-composer"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            signalTyping();
          }}
          onBlur={stopTyping}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          placeholder={`Message ${partner?.name || ''}`.trim()}
          className="field max-h-32 flex-1 resize-none py-2"
        />

        <div className="flex flex-col items-end gap-1">
          {remaining <= 200 && (
            <span
              className={`text-[11px] ${
                remaining < 0 ? 'text-primary-600' : 'text-ink-400'
              }`}
            >
              {remaining}
            </span>
          )}
          <button
            type="submit"
            disabled={!draft.trim() || isSending}
            className="btn btn-primary btn-sm"
          >
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  );
}
