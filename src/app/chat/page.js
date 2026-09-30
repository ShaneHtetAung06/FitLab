'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useSocket } from '@/context/SocketContext';
import ChatConversationList from '@/components/ChatConversationList';
import ChatThread from '@/components/ChatThread';
import { CONVERSATIONS_POLL_MS } from '@/lib/chatConstants';

/**
 * Same ordering the API applies, reapplied locally so a live message moves its
 * conversation to the top without refetching the list.
 */
function sortConversations(a, b) {
  if (a.lastMessage && b.lastMessage) {
    return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
  }
  if (a.lastMessage) return -1;
  if (b.lastMessage) return 1;
  return a.partner.name.localeCompare(b.partner.name);
}

function ChatWorkspace() {
  const { user, loading: authLoading } = useAuth();
  const { socket, connected } = useSocket();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const meId = user?._id ? String(user._id) : null;

  // The open conversation lives in the URL, so a thread can be linked to and the
  // browser back button steps back through the list on mobile.
  const courseId = searchParams.get('courseId') || '';
  const partnerId = searchParams.get('userId') || '';
  const selectedId = courseId && partnerId ? `${courseId}:${partnerId}` : '';

  // Read inside socket handlers, which must not be re-bound on every change.
  const conversationsRef = useRef(conversations);
  const selectedIdRef = useRef(selectedId);

  useEffect(() => {
    conversationsRef.current = conversations;
    selectedIdRef.current = selectedId;
  });

  const fetchConversations = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setIsLoading(true);

    try {
      const res = await fetch('/api/chat/conversations');
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations);
      } else if (!silent) {
        toast.error(data.message || 'Could not load your conversations');
      }
    } catch (error) {
      if (!silent) toast.error('Could not load your conversations');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchConversations();
  }, [user, fetchConversations]);

  /**
   * Keeps the sidebar in step with traffic across every conversation, including
   * the ones that are not open. The thread component handles its own messages;
   * this is what makes another conversation's unread badge tick up live.
   */
  useEffect(() => {
    if (!socket || !meId) return undefined;

    const handleNew = (payload) => {
      const message = payload?.message;
      if (!message) return;

      const otherId =
        String(message.sender) === meId
          ? String(message.receiver)
          : String(message.sender);
      const key = `${String(message.course)}:${otherId}`;
      const inbound = String(message.receiver) === meId;
      const isOpen = key === selectedIdRef.current;

      // A pair that isn't listed yet, for instance the first message from someone
      // who enrolled after this page loaded. Cheaper to resync than to guess the
      // course and partner details.
      if (!conversationsRef.current.some((item) => item.id === key)) {
        fetchConversations({ silent: true });
        return;
      }

      setConversations((previous) =>
        [...previous]
          .map((item) =>
            item.id === key
              ? {
                  ...item,
                  lastMessage: {
                    message: message.message,
                    createdAt: message.createdAt,
                    sender: String(message.sender),
                    read: Boolean(message.read),
                    mine: String(message.sender) === meId,
                  },
                  // An open thread marks itself read, so counting there would
                  // produce a badge that immediately disappears.
                  unreadCount:
                    inbound && !isOpen ? item.unreadCount + 1 : item.unreadCount,
                }
              : item
          )
          .sort(sortConversations)
      );
    };

    socket.on('message:new', handleNew);
    return () => socket.off('message:new', handleNew);
  }, [socket, meId, fetchConversations]);

  // Without a socket the sidebar would go stale, so it polls on the same basis
  // the thread does.
  useEffect(() => {
    if (connected || !user) return undefined;

    const interval = setInterval(
      () => fetchConversations({ silent: true }),
      CONVERSATIONS_POLL_MS
    );
    return () => clearInterval(interval);
  }, [connected, user, fetchConversations]);

  /**
   * Called by the thread for every message it gains, sent or received. Duplicates
   * the socket path on purpose: when the socket is down this is the only thing
   * keeping the preview line current.
   */
  const handleActivity = useCallback(
    ({ courseId: activityCourseId, partnerId: activityPartnerId, message }) => {
      const key = `${activityCourseId}:${activityPartnerId}`;

      setConversations((previous) =>
        [...previous]
          .map((item) => {
            if (item.id !== key) return item;
            // Guards against an out-of-order arrival overwriting a newer preview.
            if (
              item.lastMessage &&
              new Date(item.lastMessage.createdAt) >= new Date(message.createdAt)
            ) {
              return item;
            }

            return {
              ...item,
              lastMessage: {
                message: message.message,
                createdAt: message.createdAt,
                sender: String(message.sender),
                read: Boolean(message.read),
                mine: String(message.sender) === meId,
              },
            };
          })
          .sort(sortConversations)
      );
    },
    [meId]
  );

  const handleRead = useCallback((conversationId) => {
    setConversations((previous) =>
      previous.map((item) =>
        item.id === conversationId && item.unreadCount > 0
          ? { ...item, unreadCount: 0 }
          : item
      )
    );
  }, []);

  const handleSelect = useCallback(
    (conversation) => {
      const params = new URLSearchParams({
        courseId: conversation.course._id,
        userId: conversation.partner._id,
      });
      router.push(`/chat?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) || null,
    [conversations, selectedId]
  );

  const totalUnread = conversations.reduce((sum, item) => sum + item.unreadCount, 0);

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="spinner h-10 w-10" />
      </div>
    );
  }

  // Middleware already redirected unauthenticated visitors.
  if (!user) return null;

  return (
    <div className="mx-auto max-w-shell sm:px-6 sm:py-6 lg:px-8">
      <div className="flex h-[calc(100vh-64px)] overflow-hidden border-y border-ink-100 bg-white sm:h-[calc(100vh-112px)] sm:rounded-card sm:border">
        {/* One pane at a time on small screens, both side by side from md up. */}
        <aside
          className={`min-h-0 w-full shrink-0 flex-col border-r border-ink-100 md:w-80 lg:w-96 ${
            selectedId ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-3">
            <h1 className="display text-lg">Messages</h1>
            {totalUnread > 0 && (
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                {totalUnread} unread
              </span>
            )}
          </div>

          <ChatConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={handleSelect}
            isLoading={isLoading}
          />
        </aside>

        <section
          className={`flex-1 flex-col min-w-0 min-h-0 ${
            selectedId ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedId ? (
            // Remounting per conversation guarantees no state leaks between threads.
            <ChatThread
              key={selectedId}
              courseId={courseId}
              partnerId={partnerId}
              preview={
                selectedConversation
                  ? {
                      course: selectedConversation.course,
                      partner: selectedConversation.partner,
                    }
                  : null
              }
              onActivity={handleActivity}
              onRead={handleRead}
              onBack={() => router.push('/chat', { scroll: false })}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center bg-bone p-8">
              <div className="max-w-sm text-center">
                <h2 className="display text-lg">Pick a conversation</h2>
                <p className="mt-2 text-[13px] text-ink-500">
                  {conversations.length > 0
                    ? 'Choose someone on the left to start talking.'
                    : 'Enrol in a course to message its trainer.'}
                </p>
                {conversations.length === 0 && (
                  <Link href="/courses" className="btn btn-primary btn-sm mt-5">
                    Browse courses
                  </Link>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function ChatPage() {
  // useSearchParams opts the tree into client rendering, so the boundary has to
  // be explicit for the build to prerender this route.
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="spinner h-10 w-10" />
        </div>
      }
    >
      <ChatWorkspace />
    </Suspense>
  );
}
