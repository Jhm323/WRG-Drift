import { switchbackCanyonGeometry } from './geometry.js';

export const switchbackCanyonTrack = {
  id: 'switchback-canyon',
  name: 'Switchback Canyon',
  difficulty: 'hard',
  pointsMultiplier: 2.0,
  ...switchbackCanyonGeometry(),
};
