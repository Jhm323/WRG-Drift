import { apiFetch } from './client.js';

// POST /api/v1/scores (Phase 6): the server recomputes the authoritative
// score from trackId + keyEvents using the same shared scoring function —
// `score` here is only sent as a tamper/drift check, never trusted as the
// persisted value (build plan §7). `stopAtMs` is the client's own elapsed-
// time bound at the moment the run ended (crash or voluntary "End run") —
// the server replays keyEvents up to that same bound rather than trusting
// it as the final duration outright, so a voluntary end can't be extended
// by continuing the server-side replay past the point the player stopped.
export function submitRun({ trackId, keyEvents, score, stopAtMs }) {
  return apiFetch('/api/v1/scores', {
    method: 'POST',
    body: JSON.stringify({ trackId, keyEvents, score, stopAtMs }),
  });
}
