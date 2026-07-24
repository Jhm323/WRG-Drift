import { apiFetch } from './client.js';

// Backend implementation lands in Phase 6 (POST /api/v1/scores recomputes
// the score server-side from clickTimestamps — see build plan §6/§7). Until
// then this 404s; callers should treat a failure here as "not saved yet",
// not as a reason to hide the client-computed result from the player.
export function submitRun({ trackId, clickTimestamps }) {
  return apiFetch('/api/v1/scores', {
    method: 'POST',
    body: JSON.stringify({ trackId, clickTimestamps }),
  });
}
