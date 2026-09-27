'use client';

import Link from 'next/link';

const TABS = [
  { href: '/trainer/analytics', label: 'Overview' },
  { href: '/trainer/courses', label: 'Courses' },
  { href: '/trainer/courses/create', label: 'Create Course' },
];

/**
 * Section navigation shared by the trainer screens.
 *
 * Takes the active href explicitly rather than reading the pathname, because
 * /trainer/courses/create is a child of /trainer/courses and a prefix match
 * would light up two tabs at once.
 */
export default function TrainerPanelTabs({ active }) {
  return (
    <div className="mt-8 border-b border-ink-100">
      <div className="flex gap-7 overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.href === active;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? 'page' : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-ink-900 text-ink-900'
                  : 'border-transparent text-ink-500 hover:text-ink-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
