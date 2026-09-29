'use client';

import { useEffect, useState } from 'react';

/**
 * Keeps a conditionally rendered element mounted long enough to animate out.
 *
 * `{open && <Panel />}` can only ever animate an entrance -- the moment the flag
 * flips the element is gone, so a closing animation has nothing to run on. This
 * holds the element for `exitDuration` after close and reports a `state` of
 * 'open' or 'closed' for CSS to key off, while still unmounting afterwards so
 * closed menus stay out of the tab order.
 *
 * @param   {boolean} open
 * @param   {number}  [exitDuration]  must match the CSS exit duration
 * @returns {{ mounted: boolean, state: 'open' | 'closed' }}
 */
export default function usePresence(open, exitDuration = 160) {
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);

      // Two frames: the first paints the element in its closed state, the second
      // flips it open so the transition has a starting point to travel from.
      // Without this an opening panel jumps straight to its final size.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setEntered(true));
      });

      return () => {
        cancelAnimationFrame(outer);
        if (inner) cancelAnimationFrame(inner);
      };
    }

    setEntered(false);
    const timer = setTimeout(() => setMounted(false), exitDuration);
    return () => clearTimeout(timer);
  }, [open, exitDuration]);

  return { mounted, state: entered ? 'open' : 'closed' };
}
