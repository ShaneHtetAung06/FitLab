'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import { CONVERSATIONS_POLL_MS } from '@/lib/chatConstants';

/**
 * Total unread message count for the signed-in user, kept current.
 *
 * Refetching a counted index scan is preferred over adding and subtracting
 * locally: the count has to stay right across multiple tabs and after reading a
 * thread elsewhere, and guessing the delta drifts. The API emits `messages:read`
 * back to the reader too, which is what makes the badge clear when a thread is
 * opened in another tab.
 */
export default function useChatUnread({ enabled = true } = {}) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [unread, setUnread] = useState(0);

  // `enabled` keeps the navbar from spending a request on accounts that have no
  // conversations to begin with, such as admins.
  const meId = user?._id && enabled ? String(user._id) : null;

  const refresh = useCallback(async () => {
    if (!meId) {
      setUnread(0);
      return;
    }

    try {
      const res = await fetch('/api/chat/unread');
      const data = await res.json();
      if (data.success) setUnread(data.totalUnread);
    } catch (error) {
      // A stale badge is not worth a toast; the next event or poll corrects it.
    }
  }, [meId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !meId) return undefined;

    const handleNew = (payload) => {
      if (String(payload?.message?.receiver) === meId) refresh();
    };

    const handleRead = (payload) => {
      if (String(payload?.readerId) === meId) refresh();
    };

    socket.on('message:new', handleNew);
    socket.on('messages:read', handleRead);

    return () => {
      socket.off('message:new', handleNew);
      socket.off('messages:read', handleRead);
    };
  }, [socket, meId, refresh]);

  // Only polls when live events are unavailable.
  useEffect(() => {
    if (connected || !meId) return undefined;

    const interval = setInterval(refresh, CONVERSATIONS_POLL_MS);
    return () => clearInterval(interval);
  }, [connected, meId, refresh]);

  return unread;
}
