import { apiFetch } from './client.js';

export function fetchLeaderboard({ period, trackId }) {
  const params = new URLSearchParams({ period });
  if (trackId) params.set('trackId', trackId);
  return apiFetch(`/api/v1/leaderboard?${params.toString()}`);
}
