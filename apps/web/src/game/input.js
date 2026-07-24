// Minimal click-to-drift input capture. Returns a detach function so
// callers (engine.js, or React's useEffect cleanup in Phase 5) can remove
// the listener without leaking it across re-renders.
export function attachClickInput(canvas, onClick) {
  function handlePointerDown(event) {
    event.preventDefault();
    onClick(event);
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  return () => canvas.removeEventListener('pointerdown', handlePointerDown);
}
