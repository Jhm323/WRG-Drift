import { useEffect, useMemo, useRef, useState } from 'react';
import { createEngine, computeTrackCanvasSize } from '../../game/engine.js';
import './GameCanvas.css';

// Below this canvas width the full hint sentence wraps onto several lines
// and looks cramped (Switchback Canyon's canvas is naturally this narrow —
// see computeTrackCanvasSize); Oval Loop and Figure-8 are both 700px+ wide
// and never hit this.
const COMPACT_HINT_CANVAS_WIDTH_PX = 300;

// Thin React wrapper around the framework-agnostic engine (apps/web/src/game).
// All game logic lives there — this component only owns the canvas element's
// lifecycle, forwards engine callbacks as props, and shows the pre-start hint.
export function GameCanvas({ track, onTick, onCrash }) {
  const canvasRef = useRef(null);
  const [started, setStarted] = useState(false);
  // Each track gets a canvas sized to its own bounding box (see
  // computeTrackCanvasSize) rather than one fixed size shared across
  // tracks — Switchback Canyon's tall narrow shape and Figure-8's wide one
  // otherwise end up squeezed into a box that doesn't fit either well.
  const { width: canvasWidth, height: canvasHeight } = useMemo(
    () => computeTrackCanvasSize(track),
    [track],
  );

  useEffect(() => {
    const engine = createEngine({
      canvas: canvasRef.current,
      track,
      onTick: (stats) => {
        setStarted(stats.started);
        onTick?.(stats);
      },
      onCrash,
    });
    engine.start();
    return () => engine.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when the track changes, not on every callback identity change
  }, [track]);

  const compactHint = canvasWidth < COMPACT_HINT_CANVAS_WIDTH_PX;

  return (
    <div className="game-canvas-wrap">
      <canvas ref={canvasRef} className="game-canvas" width={canvasWidth} height={canvasHeight} />
      {!started && (
        <p className={compactHint ? 'game-canvas__hint game-canvas__hint--compact' : 'game-canvas__hint'}>
          {compactHint ? 'Hold ← / →' : 'Hold ← / → to drift — press either to start.'}
        </p>
      )}
    </div>
  );
}
