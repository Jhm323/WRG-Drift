import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createEngine, computeTrackCanvasSize } from '../../game/engine.js';
import { PRE_START_HINT } from '../../content/messages.js';
import './GameCanvas.css';

// Below this canvas width, the hint gets a smaller font/padding so a
// several-line wrap (tone messages vary in length; some run long) still
// looks intentional rather than cramped — Switchback Canyon's canvas is
// naturally this narrow (see computeTrackCanvasSize); Oval Loop and
// Figure-8 are both 700px+ wide and never hit this.
const COMPACT_HINT_CANVAS_WIDTH_PX = 300;

// Thin React wrapper around the framework-agnostic engine (apps/web/src/game).
// All game logic lives there — this component only owns the canvas element's
// lifecycle, forwards engine callbacks as props, and shows the pre-start hint.
// Exposes `endRun()` via ref so a parent-owned control (button, Escape key)
// can trigger a voluntary end without reaching into the engine itself.
export const GameCanvas = forwardRef(function GameCanvas({ track, onTick, onEnd, toneLevel }, ref) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const [started, setStarted] = useState(false);
  // Each track gets a canvas sized to its own bounding box (see
  // computeTrackCanvasSize) rather than one fixed size shared across
  // tracks — Switchback Canyon's tall narrow shape and Figure-8's wide one
  // otherwise end up squeezed into a box that doesn't fit either well.
  const { width: canvasWidth, height: canvasHeight } = useMemo(
    () => computeTrackCanvasSize(track),
    [track],
  );

  // Picked once per mount (a fresh run, since PlayPage remounts this
  // component via a `key` change on every restart) rather than on every
  // render, or it would re-roll on every unrelated re-render while the
  // hint is still showing.
  const hintText = useMemo(() => {
    const variants = PRE_START_HINT[toneLevel] ?? PRE_START_HINT.professional;
    return variants[Math.floor(Math.random() * variants.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pick once per mount, not on every toneLevel identity change
  }, []);

  useImperativeHandle(ref, () => ({
    endRun: () => engineRef.current?.endRun(),
  }));

  useEffect(() => {
    const engine = createEngine({
      canvas: canvasRef.current,
      track,
      onTick: (stats) => {
        setStarted(stats.started);
        onTick?.(stats);
      },
      onEnd,
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the track changes, not on every callback identity change
  }, [track]);

  const compactHint = canvasWidth < COMPACT_HINT_CANVAS_WIDTH_PX;

  return (
    <div className="game-canvas-wrap">
      <canvas ref={canvasRef} className="game-canvas" width={canvasWidth} height={canvasHeight} />
      {!started && (
        <p className={compactHint ? 'game-canvas__hint game-canvas__hint--compact' : 'game-canvas__hint'}>
          {hintText}
        </p>
      )}
    </div>
  );
});
