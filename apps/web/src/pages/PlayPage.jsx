import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas/GameCanvas.jsx';
import { getTrackById } from '../game/tracks/index.js';
import { submitRun } from '../api/scores.js';
import './PlayPage.css';

export function PlayPage() {
  const { trackId } = useParams();
  const track = getTrackById(trackId);

  const [runKey, setRunKey] = useState(0);
  const [live, setLive] = useState({ score: 0, elapsedMs: 0 });
  const [result, setResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'failed'

  const handleTick = useCallback((stats) => {
    setLive(stats);
  }, []);

  const handleCrash = useCallback(
    (payload) => {
      setResult(payload);
      setSaveStatus('saving');
      submitRun({ trackId, keyEvents: payload.keyEvents, score: payload.score })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('failed'));
    },
    [trackId],
  );

  function playAgain() {
    setResult(null);
    setSaveStatus(null);
    setLive({ score: 0, elapsedMs: 0 });
    setRunKey((key) => key + 1);
  }

  if (!track) {
    return (
      <div className="play-page">
        <h1>Track not found</h1>
        <Link to="/tracks">Back to tracks</Link>
      </div>
    );
  }

  return (
    <div className="play-page">
      <h1>{track.name}</h1>

      <div className="play-page__hud">
        <span>Score: {live.score}</span>
        <span>Time: {(live.elapsedMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="play-page__canvas-wrap">
        <GameCanvas key={`${track.id}-${runKey}`} track={track} onTick={handleTick} onCrash={handleCrash} />
      </div>

      {result && (
        <div className="play-page__result play-page__result--crashed">
          <p className="play-page__result-headline">
            Crashed! Final score {result.score} ({(result.durationMs / 1000).toFixed(1)}s survived)
          </p>
          {saveStatus === 'saving' && <p className="play-page__save-status">Saving…</p>}
          {saveStatus === 'failed' && (
            <p className="play-page__save-status">Could not save this run — score not recorded.</p>
          )}
          <div className="play-page__actions">
            <button type="button" onClick={playAgain}>
              Play again
            </button>
            <Link to="/tracks">Back to tracks</Link>
          </div>
        </div>
      )}
    </div>
  );
}
