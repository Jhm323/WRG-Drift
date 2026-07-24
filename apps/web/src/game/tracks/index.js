import { ovalLoopTrack } from './oval-loop.js';
import { figureEightTrack } from './figure-8.js';
import { switchbackCanyonTrack } from './switchback-canyon.js';

export const TRACKS = [ovalLoopTrack, figureEightTrack, switchbackCanyonTrack];

export function getTrackById(id) {
  return TRACKS.find((track) => track.id === id) ?? null;
}
