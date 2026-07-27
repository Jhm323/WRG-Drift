import { useEffect, useState } from 'react';

// Desktop-only experience: below this width the game canvas and UI don't
// have room to work with, so App.jsx gates every route behind this check
// rather than trying to responsively scale down for phones/small tablets.
export const MIN_SUPPORTED_VIEWPORT_WIDTH = 1024;

function matchesMinWidth() {
  return window.matchMedia(`(min-width: ${MIN_SUPPORTED_VIEWPORT_WIDTH}px)`).matches;
}

export function useIsViewportSupported() {
  const [supported, setSupported] = useState(matchesMinWidth);

  useEffect(() => {
    const mediaQuery = window.matchMedia(`(min-width: ${MIN_SUPPORTED_VIEWPORT_WIDTH}px)`);
    const handleChange = (event) => setSupported(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return supported;
}
