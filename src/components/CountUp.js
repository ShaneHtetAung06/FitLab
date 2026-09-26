'use client';

import { useEffect, useRef, useState } from 'react';

/** Ease-out: most of the distance is covered early, then it settles. */
function easeOut(t) {
  return 1 - Math.pow(1 - t, 3);
}

function format(value, decimals) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * A figure that counts up to its value the first time it is seen.
 *
 * The real number is what gets server-rendered, so the markup a crawler (or a
 * visitor without JavaScript) receives is the final figure. CSS hides it until
 * the animation takes over, which is why there is no flash of the end value
 * before the count starts -- see `.count-up` in globals.css.
 *
 * @param {number} props.value
 * @param {number} [props.decimals]  fixed decimal places, e.g. 1 for a rating
 * @param {string} [props.suffix]    trails the figure, e.g. '+' on an estimate
 * @param {number} [props.duration]
 */
export default function CountUp({
  value,
  decimals = 0,
  suffix = '',
  duration = 1400,
  className = '',
  ...rest
}) {
  const target = Number(value) || 0;
  const ref = useRef(null);
  // Starts at the target so the first client render matches the server HTML.
  const [shown, setShown] = useState(target);
  const [counting, setCounting] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || typeof IntersectionObserver === 'undefined' || target === 0) {
      setShown(target);
      setCounting(true);
      return undefined;
    }

    let frame = 0;
    let start = 0;

    const run = (now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      setShown(target * easeOut(progress));
      if (progress < 1) frame = requestAnimationFrame(run);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        setCounting(true);
        setShown(0);
        frame = requestAnimationFrame(run);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [target, duration]);

  return (
    <span
      ref={ref}
      className={`count-up ${counting ? 'is-counting' : ''} ${className}`}
      {...rest}
    >
      {/* `format` clamps to `decimals`, so intermediate frames never show more
          precision than the final figure. */}
      {format(shown, decimals)}
      {suffix}
    </span>
  );
}
