import { Link } from 'react-router-dom';
import { TRACKS } from '../../game/tracks/index.js';
import './TrackSelect.css';

const VIEWBOX = 100;
const PADDING = 8;

function thumbnailPoints(curve) {
  const xs = curve.map((p) => p.x);
  const ys = curve.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const scale = Math.min((VIEWBOX - PADDING * 2) / spanX, (VIEWBOX - PADDING * 2) / spanY);
  const offsetX = (VIEWBOX - spanX * scale) / 2 - minX * scale;
  const offsetY = (VIEWBOX - spanY * scale) / 2 - minY * scale;

  return curve.map((p) => `${p.x * scale + offsetX},${p.y * scale + offsetY}`).join(' ');
}

export function TrackSelect() {
  return (
    <div className="track-select">
      {TRACKS.map((track) => (
        <Link key={track.id} to={`/play/${track.id}`} className="track-card">
          <svg
            className="track-card__thumbnail"
            viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
            aria-hidden="true"
          >
            <polyline
              points={thumbnailPoints(track.curve)}
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="track-card__title">{track.name}</span>
          <span className={`track-card__difficulty track-card__difficulty--${track.difficulty}`}>
            {track.difficulty} · {track.pointsMultiplier}x
          </span>
        </Link>
      ))}
    </div>
  );
}
