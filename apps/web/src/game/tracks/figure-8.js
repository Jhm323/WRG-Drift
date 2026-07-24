import { figureEightGeometry } from './geometry.js';

export const figureEightTrack = {
  id: 'figure-8',
  name: 'Figure-8',
  difficulty: 'medium',
  pointsMultiplier: 1.5,
  ...figureEightGeometry(),
};
