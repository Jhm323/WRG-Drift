import { useEffect, useRef, useState } from 'react';
import { createEngine } from '../../game/engine.js';
import './GameCanvas.css';

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

// Thin React wrapper around the framework-agnostic engine (apps/web/src/game).
// All game logic lives there — this component only owns the canvas element's
// lifecycle, forwards engine callbacks as props, and shows the pre-start hint.
export function GameCanvas({ track, onTick, onCrash }) {
  const canvasRef = useRef(null);
  const [started, setStarted] = useState(false);

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

  return (
    <div className="game-canvas-wrap">
      <canvas ref={canvasRef} className="game-canvas" width={CANVAS_WIDTH} height={CANVAS_HEIGHT} />
      {!started && (
        <p className="game-canvas__hint">Hold ← / → to drift — press either to start.</p>
      )}
    </div>
  );
}
