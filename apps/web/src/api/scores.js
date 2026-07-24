import { apiFetch } from './client.js';

// POST /api/v1/scores (Phase 6): the server recomputes the authoritative
// score from trackId + clickTimestamps using the same shared scoring
// function — `score` here is only sent as a tamper/drift check, never
// trusted as the persisted value (build plan §7).
export function submitRun({ trackId, clickTimestamps, score }) {
  return apiFetch('/api/v1/scores', {
    method: 'POST',
    body: JSON.stringify({ trackId, clickTimestamps, score }),
  });
}
