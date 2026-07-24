import './AvatarPicker.css';

export const AVATAR_OPTIONS = Array.from({ length: 8 }, (_, i) => `/avatars/avatar-${i + 1}.svg`);

export function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-picker" role="radiogroup" aria-label="Choose an avatar">
      {AVATAR_OPTIONS.map((avatarUrl) => (
        <button
          key={avatarUrl}
          type="button"
          role="radio"
          aria-checked={value === avatarUrl}
          className={
            value === avatarUrl
              ? 'avatar-picker__option avatar-picker__option--selected'
              : 'avatar-picker__option'
          }
          onClick={() => onChange(avatarUrl)}
        >
          <img className="avatar-picker__image" src={avatarUrl} alt="" />
        </button>
      ))}
    </div>
  );
}
