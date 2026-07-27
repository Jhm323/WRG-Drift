import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas/GameCanvas.jsx';
import { getTrackById } from '../game/tracks/index.js';
import { submitRun } from '../api/scores.js';
import './PlayPage.css';

export function PlayPage() {
  const { trackId } = useParams();
  const track = getTrackById(trackId);
  const gameCanvasRef = useRef(null);

  const [runKey, setRunKey] = useState(0);
  const [live, setLive] = useState({ score: 0, elapsedMs: 0, started: false });
  const [result, setResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'failed'

  const handleTick = useCallback((stats) => {
    setLive(stats);
  }, []);

  // Shared by both ways a run can end — crashing and a voluntary "End run"
  // (button or Escape) — so score submission is identical either way; the
  // engine itself unifies the two into this single callback (see
  // engine.js's `finish()`), so there's only one path here to begin with.
  const handleRunEnd = useCallback(
    (payload) => {
      setResult(payload);
      setSaveStatus('saving');
      submitRun({
        trackId,
        keyEvents: payload.keyEvents,
        score: payload.score,
        stopAtMs: payload.stopAtMs,
      })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('failed'));
    },
    [trackId],
  );

  const endRun = useCallback(() => {
    gameCanvasRef.current?.endRun();
  }, []);

  // Escape ends the run without reaching for the mouse — the game is
  // otherwise entirely keyboard-driven (Arrow keys). Engine.js's endRun()
  // already no-ops if the run hasn't started or already ended, so no need
  // to duplicate that guard here.
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') endRun();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [endRun]);

  function playAgain() {
    setResult(null);
    setSaveStatus(null);
    setLive({ score: 0, elapsedMs: 0, started: false });
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
        {live.started && !result && (
          <button type="button" className="play-page__end-run" onClick={endRun}>
            End run (Esc)
          </button>
        )}
      </div>

      <div className="play-page__canvas-wrap">
        <GameCanvas
          ref={gameCanvasRef}
          key={`${track.id}-${runKey}`}
          track={track}
          onTick={handleTick}
          onEnd={handleRunEnd}
        />
      </div>

      {result && (
        <div
          className={
            result.crashed
              ? 'play-page__result play-page__result--crashed'
              : 'play-page__result play-page__result--ended'
          }
        >
          <p className="play-page__result-headline">
            {result.crashed
              ? `Crashed! Final score ${result.score} (${(result.durationMs / 1000).toFixed(1)}s survived)`
              : `Run ended! Final score ${result.score} (${(result.durationMs / 1000).toFixed(1)}s)`}
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
