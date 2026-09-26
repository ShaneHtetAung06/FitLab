'use client';

import { useState } from 'react';

function Star({ filled, half = false }) {
  if (half) {
    return (
      <span className="relative inline-block h-4 w-4" aria-hidden="true">
        <span className="absolute inset-0 text-ink-200">★</span>
        <span className="absolute inset-0 w-1/2 overflow-hidden text-primary-600">★</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-block h-4 w-4 leading-4 ${
        filled ? 'text-primary-600' : 'text-ink-200'
      }`}
      aria-hidden="true"
    >
      ★
    </span>
  );
}


export default function StarRating({ value = 0, count = null, showValue = true }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));

  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-flex items-center leading-none">
        {[1, 2, 3, 4, 5].map((position) => (
          <Star
            key={position}
            filled={rating >= position}
            half={rating < position && rating > position - 1}
          />
        ))}
      </span>
      {showValue && rating > 0 && (
        <span className="text-sm font-medium text-gray-900">{rating.toFixed(1)}</span>
      )}
      {count !== null && (
        <span className="text-sm text-gray-500">
          ({count} review{count === 1 ? '' : 's'})
        </span>
      )}
      <span className="sr-only">
        {rating > 0 ? `Rated ${rating.toFixed(1)} out of 5` : 'Not yet rated'}
      </span>
    </span>
  );
}
export function StarRatingInput({ value, onChange, disabled = false, name = 'rating' }) {
  const [hovered, setHovered] = useState(null);
  const shown = hovered ?? value;

  return (
    <fieldset
      className="border-0 p-0 m-0"
      onMouseLeave={() => setHovered(null)}
      disabled={disabled}
    >
      <legend className="sr-only">Your rating</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((position) => (
          <label
            key={position}
            className={`cursor-pointer text-2xl leading-none transition-colors ${
              shown >= position ? 'text-primary-600' : 'text-ink-200'
            } ${disabled ? 'cursor-not-allowed' : 'hover:scale-110'}`}
            onMouseEnter={() => !disabled && setHovered(position)}
          >
            <input
              type="radio"
              name={name}
              value={position}
              checked={value === position}
              disabled={disabled}
              onChange={() => onChange(position)}
              className="sr-only"
            />
            <span aria-hidden="true">★</span>
            <span className="sr-only">
              {position} star{position === 1 ? '' : 's'}
            </span>
          </label>
        ))}
        {value > 0 && (
          <span className="ml-2 text-sm text-gray-600">{value} of 5</span>
        )}
      </div>
    </fieldset>
  );
}
