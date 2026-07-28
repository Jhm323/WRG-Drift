import { TRACKS } from '@dirtcar-drift/shared';

export { TRACKS };

export function getTrackById(id) {
  return TRACKS.find((track) => track.id === id) ?? null;
}
