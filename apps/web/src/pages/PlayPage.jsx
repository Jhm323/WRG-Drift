import { useParams } from 'react-router-dom';

export function PlayPage() {
  const { trackId } = useParams();

  return (
    <div>
      <h1>Play: {trackId}</h1>
      <p>The game canvas lands in Phases 4–5.</p>
    </div>
  );
}
