'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ChatAvatar from '@/components/ChatAvatar';
import { formatConversationTime } from '@/lib/chatTime';

/**
 * Sidebar list of the people the signed-in user may message.
 *
 * Every eligible pairing appears here, including ones with no messages yet, so
 * a first message can always be started. The parent owns the data and the
 * selection; this component only renders and reports clicks.
 */
export default function ChatConversationList({
  conversations,
  selectedId,
  onSelect,
  isLoading,
}) {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return conversations;

    return conversations.filter(
      (conversation) =>
        conversation.partner.name.toLowerCase().includes(trimmed) ||
        conversation.course.title.toLowerCase().includes(trimmed)
    );
  }, [conversations, query]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner h-8 w-8" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="p-6 text-center">
        <h2 className="display text-base">No conversations yet</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          Once you enrol in a course you can message its trainer here. Trainers can
          message everyone enrolled in their courses.
        </p>
        <Link href="/courses" className="btn btn-primary btn-sm mt-5">
          Browse courses
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Trainers can accumulate a lot of students, so filtering earns its place. */}
      <div className="border-b border-ink-100 p-3">
        <label htmlFor="chat-search" className="sr-only">
          Search conversations
        </label>
        <input
          id="chat-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people or courses"
          className="field py-2 text-[13px]"
        />
      </div>

      {visible.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-ink-500">
          Nothing matches “{query.trim()}”.
        </p>
      ) : (
        <ul className="flex-1 divide-y divide-ink-100 overflow-y-auto">
          {visible.map((conversation) => {
            const isSelected = conversation.id === selectedId;
            const { partner, course, lastMessage, unreadCount } = conversation;

            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => onSelect(conversation)}
                  aria-current={isSelected ? 'true' : undefined}
                  className={`flex w-full items-start gap-3 px-3 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-bone shadow-[inset_2px_0_0_0_#e63e22]'
                      : 'hover:bg-bone/60'
                  }`}
                >
                  <ChatAvatar name={partner.name} avatar={partner.avatar} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[13px] text-ink-900 ${
                          unreadCount > 0 ? 'font-bold' : 'font-semibold'
                        }`}
                      >
                        {partner.name}
                      </span>
                      {lastMessage && (
                        <span className="shrink-0 text-[11px] text-ink-400">
                          {formatConversationTime(lastMessage.createdAt)}
                        </span>
                      )}
                    </span>

                    <span className="mt-0.5 block truncate text-[11px] text-primary-600">
                      {course.title}
                    </span>

                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span
                        className={`truncate text-[13px] ${
                          unreadCount > 0
                            ? 'font-medium text-ink-900'
                            : 'text-ink-500'
                        }`}
                      >
                        {lastMessage ? (
                          <>
                            {lastMessage.mine && (
                              <span className="text-ink-400">You: </span>
                            )}
                            {lastMessage.message}
                          </>
                        ) : (
                          <span className="italic text-ink-400">No messages yet</span>
                        )}
                      </span>

                      {unreadCount > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                          <span className="sr-only"> unread messages</span>
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
