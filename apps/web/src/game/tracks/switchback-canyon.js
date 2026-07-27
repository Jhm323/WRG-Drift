import { switchbackCanyonGeometry } from './geometry.js';

export const switchbackCanyonTrack = {
  id: 'switchback-canyon',
  name: 'Switchback Canyon',
  difficulty: 'hard',
  pointsMultiplier: 2.0,
  // Non-looping path: the run continues past the final waypoint by
  // teleporting back to the start instead of ending, so a run doesn't
  // artificially crash just because the drivable polyline ran out.
  wrapAtEnd: true,
  ...switchbackCanyonGeometry(),
};
