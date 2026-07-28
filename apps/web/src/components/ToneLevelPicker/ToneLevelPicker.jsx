import { TONE_LEVELS, TONE_LABELS } from '../../content/messages.js';
import './ToneLevelPicker.css';

export function ToneLevelPicker({ value, onChange }) {
  return (
    <div className="tone-level-picker" role="radiogroup" aria-label="Choose a character">
      {TONE_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          className={
            value === level
              ? 'tone-level-picker__option tone-level-picker__option--selected'
              : 'tone-level-picker__option'
          }
          onClick={() => onChange(level)}
        >
          {TONE_LABELS[level]}
        </button>
      ))}
    </div>
  );
}
