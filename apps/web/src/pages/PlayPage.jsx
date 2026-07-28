import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GameCanvas } from '../components/GameCanvas/GameCanvas.jsx';
import { getTrackById } from '../game/tracks/index.js';
import { submitRun } from '../api/scores.js';
import { useTone } from '../hooks/useTone.js';
import { CRASH_MESSAGES, PR_MESSAGES, NOT_PR_MESSAGES } from '../content/messages.js';
import './PlayPage.css';

export function PlayPage() {
  const { trackId } = useParams();
  const track = getTrackById(trackId);
  const gameCanvasRef = useRef(null);
  const { toneLevel, getMessage } = useTone();

  const [runKey, setRunKey] = useState(0);
  const [live, setLive] = useState({ score: 0, elapsedMs: 0, started: false });
  const [result, setResult] = useState(null);
  // null = not yet known (server PR check still in flight, or this was a
  // crash and it's simply irrelevant). Only ever set for non-crash results.
  const [isPersonalBest, setIsPersonalBest] = useState(null);
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
      setIsPersonalBest(null);
      setSaveStatus('saving');
      submitRun({
        trackId,
        keyEvents: payload.keyEvents,
        score: payload.score,
        stopAtMs: payload.stopAtMs,
      })
        .then((data) => {
          setSaveStatus('saved');
          // Crash messaging never distinguishes PR/non-PR, so there's no
          // point tracking it there — and skipping the update means this
          // resolving late can't retroactively change an already-shown
          // crash message (see resultMessage below).
          if (!payload.crashed) setIsPersonalBest(Boolean(data.isPersonalBest));
        })
        .catch(() => {
          setSaveStatus('failed');
          // Couldn't verify against the server, so don't claim a PR.
          if (!payload.crashed) setIsPersonalBest(false);
        });
    },
    [trackId],
  );

  const endRun = useCallback(() => {
    gameCanvasRef.current?.endRun();
  }, []);

  const playAgain = useCallback(() => {
    setResult(null);
    setIsPersonalBest(null);
    setSaveStatus(null);
    setLive({ score: 0, elapsedMs: 0, started: false });
    setRunKey((key) => key + 1);
  }, []);

  // Picked once per result (keyed on the `result`/`isPersonalBest` state
  // identities, not recomputed on every unrelated re-render like
  // saveStatus flipping to 'saved') so the chosen variant stays put for as
  // long as this result is showing, instead of re-rolling on every render.
  const resultMessage = useMemo(() => {
    if (!result) return null;
    const vars = { score: result.score, time: (result.durationMs / 1000).toFixed(1) };
    if (result.crashed) return getMessage(CRASH_MESSAGES, vars);
    if (isPersonalBest == null) return null; // still waiting on the server's PR check
    return getMessage(isPersonalBest ? PR_MESSAGES : NOT_PR_MESSAGES, vars);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick once per result, not on every getMessage re-creation
  }, [result, isPersonalBest]);

  // Escape ends the run without reaching for the mouse — the game is
  // otherwise entirely keyboard-driven (Arrow keys). Scoped to `!result` so
  // this is only ever attached during a live run. Combined with the
  // "any key restarts" effect below (scoped to `result`), exactly one of
  // these two keydown listeners is attached at any given moment, never
  // both — `result` and `!result` can't both hold, so the two can't fire
  // for the same keypress. This is enforced structurally by the effects'
  // own guards, not left to engine.js's endRun() no-op as a backstop.
  useEffect(() => {
    if (result) return undefined;
    function handleKeyDown(event) {
      if (event.key === 'Escape') endRun();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, endRun]);

  // Result screen: any key restarts, not just clicking "Play again" — a
  // quicker "one more go" loop once the game is over. Scoped to `result`
  // so it's only attached while a result is showing (never during live
  // gameplay, where arrow keys drive), and the effect cleanup removes it
  // the instant `result` clears — via playAgain() here, a crash/end
  // elsewhere, or the component unmounting — so it can't leak or fire late.
  // "Back to tracks" is deliberately NOT wired to this: it's a navigation
  // choice and still requires an actual click on the link.
  useEffect(() => {
    if (!result) return undefined;
    function handleKeyDown() {
      playAgain();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [result, playAgain]);

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
          toneLevel={toneLevel}
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
          {resultMessage && <p className="play-page__result-headline">{resultMessage}</p>}
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
