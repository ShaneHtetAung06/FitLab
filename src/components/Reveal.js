'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reveals its content as it scrolls into view.
 *
 * A thin client wrapper on purpose: it takes already-rendered children, so a
 * server component can wrap a whole section (or a grid of server-rendered
 * course cards) without any of that markup crossing into the client bundle.
 *
 * The visual work lives in `globals.css` (`.reveal` / `.reveal-stagger`), gated
 * behind the `.motion-ready` flag on <html>. This component only decides when to
 * add `is-revealed`.
 *
 * @param {object}  props
 * @param {string}  [props.as]       element to render, defaults to a div
 * @param {boolean} [props.stagger]  animate the children in sequence instead of
 *                                   the container as one block
 * @param {number}  [props.delay]    ms to hold before starting
 * @param {number}  [props.amount]   fraction of the element that must be visible
 */
export default function Reveal({
  as: Tag = 'div',
  stagger = false,
  delay = 0,
  amount = 0.12,
  className = '',
  style,
  children,
  ...rest
}) {
  const ref = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || revealed) return undefined;

    // No observer, or motion turned down: show it and stop.
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (typeof IntersectionObserver === 'undefined' || prefersReduced) {
      setRevealed(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      // Pulled in slightly from the bottom edge so content animates while
      // entering the viewport rather than exactly as it clips it.
      { threshold: amount, rootMargin: '0px 0px -6% 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount, revealed]);

  return (
    <Tag
      ref={ref}
      className={`${stagger ? 'reveal-stagger' : 'reveal'} ${
        revealed ? 'is-revealed' : ''
      } ${className}`}
      style={delay ? { transitionDelay: `${delay}ms`, ...style } : style}
      {...rest}
    >
      {children}
    </Tag>
  );
}
