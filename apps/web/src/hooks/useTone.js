import { useAuth } from './useAuth.js';

// Reads the current player's character/tone preference and exposes
// getMessage() to pull a random, interpolated line from one of the message
// banks in apps/web/src/content/messages.js. Falls back to 'professional'
// for signed-in users who haven't set one yet (pre-migration accounts, or
// any bank lookup miss) rather than erroring.
export function useTone() {
  const { user } = useAuth();
  const toneLevel = user?.toneLevel ?? 'professional';

  function getMessage(bank, vars = {}) {
    const variants = bank[toneLevel] ?? bank.professional;
    const template = variants[Math.floor(Math.random() * variants.length)];
    return template.replace(/\{(\w+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match,
    );
  }

  return { toneLevel, getMessage };
}
