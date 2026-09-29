'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import useChatUnread from '@/hooks/useChatUnread';
import usePresence from '@/hooks/usePresence';

function UnreadDot({ count, className = '' }) {
  if (count <= 0) return null;

  return (
 
    <span
      key={count}
      className={`relative inline-flex h-[18px] min-w-[18px] animate-pop items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white ${className}`}
    >
      {/* Outline, not a fill: it expands past the badge without darkening it. */}
      <span
        className="absolute inset-0 animate-ping-twice rounded-full border border-primary-600"
        aria-hidden="true"
      />
      {count > 9 ? '9+' : count}
      <span className="sr-only"> unread messages</span>
    </span>
  );
}

export default function Navbar() {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);
  const profileRef = useRef(null);

  const dropdown = usePresence(profileDropdown, 150);
  const mobilePanel = usePresence(mobileMenuOpen, 300);

  const canChat = Boolean(user) && user.role !== 'admin';
  const unreadCount = useChatUnread({ enabled: canChat });

  useEffect(() => {
    if (!profileDropdown) return undefined;

    const handlePointer = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileDropdown(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setProfileDropdown(false);
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [profileDropdown]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setProfileDropdown(false);
  }, [pathname]);

  /**
   * Primary navigation, derived from the signed-in role.
   *
   * Everything past "Browse Courses" requires an account, so a visitor never
   * sees a link that would just bounce them to the login page.
   */
  const links = useMemo(() => {
    const items = [{ href: '/courses', label: 'Browse Courses' }];

    if (!user) return items;

    if (user.role === 'admin') {
      items.push({ href: '/admin', label: 'Admin' });
      return items;
    }

    items.push({ href: '/dashboard/enrollments', label: 'My Learning' });

    if (user.role === 'trainer') {
      items.push({ href: '/trainer/courses', label: 'My Courses' });
      items.push({ href: '/trainer/analytics', label: 'Dashboard' });
    }

    return items;
  }, [user]);

  const isActive = useCallback(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname]
  );

  /* ------------------------------------------------------------------ scroll */

  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const read = () => {
      frame = 0;
      const offset = window.scrollY;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;

      setScrolled(offset > 4);
      setScrollProgress(scrollable > 40 ? Math.min(1, offset / scrollable) : 0);
    };

    const handleScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };

    read();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [pathname]);

  /* --------------------------------------------------------------- indicator */

  /**
   * One underline shared by every desktop link.
   *
   * Replaces the per-link pseudo-element so the mark travels between links
   * instead of cutting, and follows the pointer to preview where a click will
   * take you. It is measured from the DOM rather than guessed, so it stays
   * correct whatever the labels say. Until the first measurement lands the CSS
   * fallback underline is still in charge.
   */
  const listRef = useRef(null);
  const itemRefs = useRef(new Map());
  const [hoveredHref, setHoveredHref] = useState(null);
  const [indicator, setIndicator] = useState(null);

  const registerItem = useCallback(
    (href) => (node) => {
      if (node) itemRefs.current.set(href, node);
      else itemRefs.current.delete(href);
    },
    []
  );

  const activeHref = useMemo(() => {
    const candidates = canChat ? [...links, { href: '/chat' }] : links;

    return (
      candidates
        .filter((link) => isActive(link.href))
        .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
    );
  }, [links, canChat, isActive]);

  const indicatorHref = hoveredHref || activeHref;

  useEffect(() => {
    const list = listRef.current;
    const node = indicatorHref ? itemRefs.current.get(indicatorHref) : null;

    if (!list || !node) {
      setIndicator(null);
      return undefined;
    }

    const measure = () => {
      const listBox = list.getBoundingClientRect();
      const itemBox = node.getBoundingClientRect();
      setIndicator({ left: itemBox.left - listBox.left, width: itemBox.width });
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(node);

    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    return () => observer.disconnect();
  }, [indicatorHref, links, canChat, unreadCount]);

  return (
    <nav
      className={`sticky top-0 z-50 border-b border-ink-100 bg-white/95 backdrop-blur transition-shadow duration-300 ${
        scrolled ? 'shadow-nav' : 'shadow-none'
      }`}
    >
      <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2.5">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-600 text-sm font-bold text-white transition-transform duration-300 ease-soft group-hover:-rotate-6 group-hover:scale-110"
              aria-hidden="true"
            >
              F
            </span>
            <span className="text-lg font-bold tracking-tight text-ink-900">FitLab</span>
          </Link>

          {/* Desktop navigation */}
          <div
            ref={listRef}
            onMouseLeave={() => setHoveredHref(null)}
            className={`relative hidden items-center gap-7 md:flex ${
              indicator ? 'has-nav-indicator' : ''
            }`}
          >
            {links.map((link) => (
              <Link
                key={link.href}
                ref={registerItem(link.href)}
                href={link.href}
                onMouseEnter={() => setHoveredHref(link.href)}
                onFocus={() => setHoveredHref(link.href)}
                onBlur={() => setHoveredHref(null)}
                className={`nav-link ${isActive(link.href) ? 'nav-link-active' : ''}`}
              >
                {link.label}
              </Link>
            ))}

            {canChat && (
              <Link
                ref={registerItem('/chat')}
                href="/chat"
                onMouseEnter={() => setHoveredHref('/chat')}
                onFocus={() => setHoveredHref('/chat')}
                onBlur={() => setHoveredHref(null)}
                className={`nav-link flex items-center gap-1.5 ${
                  isActive('/chat') ? 'nav-link-active' : ''
                }`}
              >
                Messages
                <UnreadDot count={unreadCount} />
              </Link>
            )}

            <span
              className="nav-indicator"
              style={{
                left: indicator?.left ?? 0,
                width: indicator?.width ?? 0,
                opacity: indicator ? 1 : 0,
              }}
              aria-hidden="true"
            />
          </div>

          {/* Account area. Held blank while auth resolves so the bar does not
              flash a "Sign in" button at someone who is already signed in. */}
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="skeleton hidden h-9 w-32 md:block" />
            ) : user ? (
              <div className="relative hidden md:block" ref={profileRef}>
                <button
                  type="button"
                  onClick={() => setProfileDropdown((open) => !open)}
                  aria-expanded={profileDropdown}
                  aria-haspopup="menu"
                  className="group flex items-center gap-2 rounded-full border border-ink-100 py-1 pl-1 pr-3 transition-colors hover:border-ink-300"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-700 transition-transform duration-300 ease-soft group-hover:scale-105">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-[9rem] truncate text-sm font-medium text-ink-900">
                    {user.name}
                  </span>
                  <svg
                    className={`h-3.5 w-3.5 text-ink-400 transition-transform duration-300 ease-soft ${
                      profileDropdown ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {dropdown.mounted && (
                  <div
                    role="menu"
                    data-state={dropdown.state}
                    className="pop-panel menu-stagger absolute right-0 mt-2 w-56 origin-top-right overflow-hidden rounded-card border border-ink-100 bg-white shadow-float"
                  >
                    <div className="border-b border-ink-100 px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {user.name}
                      </p>
                      <p className="truncate text-xs text-ink-500">{user.email}</p>
                      <span className="mt-1.5 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-700">
                        {user.role}
                      </span>
                    </div>
                    <Link
                      href="/dashboard"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-bone"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard/profile"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-bone"
                    >
                      Profile
                    </Link>
                    {user.role === 'customer' && (
                      <Link
                        href="/dashboard/become-trainer"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm text-ink-700 transition-colors hover:bg-bone"
                      >
                        Become a trainer
                      </Link>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setProfileDropdown(false);
                        logout();
                      }}
                      className="block w-full border-t border-ink-100 px-4 py-2.5 text-left text-sm font-medium text-primary-600 transition-colors hover:bg-primary-50"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="hidden items-center gap-4 md:flex">
                <Link
                  href="/login"
                  className="text-sm font-medium text-ink-600 transition-colors hover:text-ink-900"
                >
                  Sign in
                </Link>
                <Link href="/register" className="btn btn-dark btn-sm">
                  Get started
                </Link>
              </div>
            )}

            {/* Mobile trigger. The three bars fold into the close cross rather
                than being swapped for a different icon. */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-expanded={mobileMenuOpen}
              aria-label="Toggle navigation"
              className="relative -mr-1 p-2 text-ink-700 md:hidden"
            >
              {canChat && !mobileMenuOpen && unreadCount > 0 && (
                <span
                  key={unreadCount}
                  className="absolute right-1 top-1 h-2 w-2 animate-pop rounded-full bg-primary-600"
                  aria-hidden="true"
                >
                  <span className="absolute inset-0 animate-ping-twice rounded-full border border-primary-600" />
                </span>
              )}
              <span className="relative block h-5 w-5" aria-hidden="true">
                <span
                  className={`absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-soft ${
                    mobileMenuOpen ? 'top-1/2 -translate-y-1/2 rotate-45' : 'top-[6px]'
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 block h-[2px] w-5 -translate-y-1/2 rounded-full bg-current transition-all duration-200 ease-soft ${
                    mobileMenuOpen ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100'
                  }`}
                />
                <span
                  className={`absolute left-0 block h-[2px] w-5 rounded-full bg-current transition-all duration-300 ease-soft ${
                    mobileMenuOpen
                      ? 'top-1/2 -translate-y-1/2 -rotate-45'
                      : 'top-[13px]'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Reading position. Sits on the bar's own bottom edge and is only there
          once the page has moved, so the navbar at rest is unchanged. */}
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary-600 transition-opacity duration-300"
        style={{
          transform: `scaleX(${scrollProgress})`,
          opacity: scrolled ? 1 : 0,
        }}
        aria-hidden="true"
      />

      {/* Mobile panel. Mirrors the desktop role logic rather than listing every
          link and hiding some, so the two cannot drift apart. */}
      {mobilePanel.mounted && (
        <div
          data-state={mobilePanel.state}
          className="collapse-grid bg-white md:hidden"
        >
          {/* The border lives on the scrolling child so it is clipped away with
              the rest of the panel instead of leaving a stray line behind. */}
          <div className="overflow-hidden border-t border-ink-100">
            <div
              data-state={mobilePanel.state}
              className="menu-stagger mx-auto max-w-shell space-y-1 px-4 py-4 sm:px-6"
            >
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive(link.href)
                      ? 'bg-bone text-ink-900'
                      : 'text-ink-600 hover:bg-bone'
                  }`}
                >
                  {link.label}
                </Link>
              ))}

              {canChat && (
                <Link
                  href="/chat"
                  className={`flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive('/chat')
                      ? 'bg-bone text-ink-900'
                      : 'text-ink-600 hover:bg-bone'
                  }`}
                >
                  Messages
                  <UnreadDot count={unreadCount} />
                </Link>
              )}

              {!loading && (
                <div className="mt-3 border-t border-ink-100 pt-3">
                  {user ? (
                    <>
                      <Link
                        href="/dashboard"
                        className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-bone"
                      >
                        Dashboard
                      </Link>
                      <Link
                        href="/dashboard/profile"
                        className="block rounded-md px-3 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-bone"
                      >
                        Profile
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          logout();
                        }}
                        className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-semibold text-primary-600 transition-colors hover:bg-primary-50"
                      >
                        Sign out
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col gap-2 px-1">
                      <Link href="/login" className="btn btn-outline">
                        Sign in
                      </Link>
                      <Link href="/register" className="btn btn-dark">
                        Get started
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
