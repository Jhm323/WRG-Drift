import { ovalGeometry } from './geometry.js';

export const ovalLoopTrack = {
  id: 'oval-loop',
  name: 'Oval Loop',
  difficulty: 'easy',
  pointsMultiplier: 1.0,
  ...ovalGeometry(),
};
