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
  const [live, setLive] = useState({ score: 0, gatesCleared: 0, gatesTotal: 0, elapsedMs: 0 });
  const [result, setResult] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'failed'

  const handleTick = useCallback((stats) => {
    setLive(stats);
  }, []);

  const handleRunEnd = useCallback(
    (payload, crashed) => {
      setResult({ ...payload, crashed });
      setSaveStatus('saving');
      submitRun({ trackId, clickTimestamps: payload.clickTimestamps, score: payload.score })
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('failed'));
    },
    [trackId],
  );

  const handleCrash = useCallback((payload) => handleRunEnd(payload, true), [handleRunEnd]);
  const handleFinish = useCallback((payload) => handleRunEnd(payload, false), [handleRunEnd]);

  function playAgain() {
    setResult(null);
    setSaveStatus(null);
    setLive({ score: 0, gatesCleared: 0, gatesTotal: 0, elapsedMs: 0 });
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
        <span>
          Gates: {live.gatesCleared}/{live.gatesTotal || track.gates.length}
        </span>
        <span>Time: {(live.elapsedMs / 1000).toFixed(1)}s</span>
      </div>

      <div className="play-page__canvas-wrap">
        <GameCanvas
          key={runKey}
          track={track}
          onTick={handleTick}
          onCrash={handleCrash}
          onFinish={handleFinish}
        />
      </div>

      {result && (
        <div
          className={
            result.crashed
              ? 'play-page__result play-page__result--crashed'
              : 'play-page__result play-page__result--finished'
          }
        >
          <p className="play-page__result-headline">
            {result.crashed ? 'Crashed!' : 'Finished!'} Final score {result.score} (
            {result.gatesCleared}/{result.gatesTotal} gates)
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
