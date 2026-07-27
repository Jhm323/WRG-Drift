// Keyboard-driven turning input. Tracks ArrowLeft/ArrowRight hold state via
// window-level keydown/keyup listeners — not the canvas — so losing canvas
// focus never drops input, and reports each press/release as a
// { type, key } event so callers (engine.js) can timestamp and log it for
// the server-side anti-cheat replay. preventDefault on the two arrow keys
// stops the page from scrolling while a run is active.
const TURN_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

export function attachKeyboardInput(onKeyEvent) {
  const held = { ArrowLeft: false, ArrowRight: false };

  function handleKeyDown(event) {
    if (!TURN_KEYS.has(event.key)) return;
    event.preventDefault();
    if (held[event.key]) return; // ignore OS key-repeat while held
    held[event.key] = true;
    onKeyEvent({ type: 'down', key: event.key });
  }

  function handleKeyUp(event) {
    if (!TURN_KEYS.has(event.key)) return;
    event.preventDefault();
    held[event.key] = false;
    onKeyEvent({ type: 'up', key: event.key });
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}
