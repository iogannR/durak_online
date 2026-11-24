import React from 'react';
import { Card } from '../types/durak';
import { isRedSuit, RANK_LABELS, SUIT_SYMBOLS } from '../utils/durakEngine';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  playable?: boolean;
  selected?: boolean;
  dimmed?: boolean;
  isTrump?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onPointerDown?: (e: React.PointerEvent<HTMLButtonElement>) => void;
  style?: React.CSSProperties;
  className?: string;
  overlayText?: string | number;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-9 h-13 sm:w-11 sm:h-16 rounded-md',
  sm: 'w-14 h-20 sm:w-16 sm:h-24 rounded-lg',
  md: 'w-16 h-24 sm:w-22 sm:h-32 md:w-24 md:h-34 rounded-xl',
  lg: 'w-20 h-28 sm:w-26 sm:h-38 rounded-xl',
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  playable = false,
  selected = false,
  dimmed = false,
  isTrump = false,
  size = 'md',
  onClick,
  onPointerDown,
  style,
  className = '',
  overlayText,
}) => {
  const sizeClass = SIZE_CLASSES[size];

  if (faceDown || !card) {
    return (
      <div
        style={style}
        className={`${sizeClass} shrink-0 relative select-none bg-[#1B2B24] border border-[#D6A954]/45 shadow-[0_6px_16px_rgba(0,0,0,0.45)] overflow-hidden ${className}`}
      >
        <div
          className="absolute inset-1 rounded-[inherit] border border-[#D6A954]/25"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, rgba(214,169,84,0.13) 0px, rgba(214,169,84,0.13) 1px, transparent 1px, transparent 5px), repeating-linear-gradient(-45deg, rgba(214,169,84,0.13) 0px, rgba(214,169,84,0.13) 1px, transparent 1px, transparent 5px)',
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          {overlayText !== undefined ? (
            <span className="font-mono font-bold text-lg sm:text-xl text-[#F3EFE6] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] tabular-nums">
              {overlayText}
            </span>
          ) : (
            <span className="text-[#D6A954]/55 text-sm font-display">♠</span>
          )}
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const rankText = RANK_LABELS[card.rank];
  const suitSymbol = SUIT_SYMBOLS[card.suit];
  const colorClass = red ? 'text-[#C93838]' : 'text-[#181B19]';

  const interactiveClasses = onClick
    ? playable
      ? 'cursor-grab active:cursor-grabbing touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D6A954]'
      : 'cursor-not-allowed'
    : '';

  const stateBorder = selected
    ? 'ring-2 ring-[#D6A954] -translate-y-4 shadow-xl'
    : playable
    ? 'border-[#D6A954]/85 shadow-[0_8px_20px_rgba(0,0,0,0.5)]'
    : 'border-stone-300 shadow-[0_4px_12px_rgba(0,0,0,0.38)]';

  return (
    <button
      type="button"
      style={style}
      onPointerDown={onPointerDown}
      onClick={playable && onClick ? onClick : undefined}
      disabled={!onClick || !playable}
      aria-label={`${rankText} ${suitSymbol}${isTrump ? ' (Козырь)' : ''}`}
      className={`${sizeClass} shrink-0 relative select-none bg-[#FCF9F2] border text-left transition-opacity duration-150 ${stateBorder} ${interactiveClasses} ${
        dimmed ? 'opacity-55' : 'opacity-100'
      } ${className}`}
    >
      {/* Top-left corner index */}
      <div className={`absolute top-1.5 left-1.5 sm:left-2 flex flex-col items-center leading-none ${colorClass}`}>
        <span className="font-bold tracking-tight text-xs sm:text-base tabular-nums">{rankText}</span>
        <span className="text-[11px] sm:text-sm -mt-0.5">{suitSymbol}</span>
      </div>

      {/* Center emblem */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${colorClass}`}>
        {card.rank >= 11 && card.rank <= 13 ? (
          <div className="flex flex-col items-center">
            <span className="font-display font-bold text-xl sm:text-3xl leading-none">{rankText}</span>
            <span className="text-xs sm:text-base opacity-80">{suitSymbol}</span>
          </div>
        ) : (
          <span className="text-xl sm:text-3xl leading-none">{suitSymbol}</span>
        )}
      </div>

      {/* Bottom-right inverted corner index */}
      <div
        className={`absolute bottom-1.5 right-1.5 sm:right-2 flex flex-col items-center leading-none rotate-180 ${colorClass}`}
      >
        <span className="font-bold tracking-tight text-xs sm:text-base tabular-nums">{rankText}</span>
        <span className="text-[11px] sm:text-sm -mt-0.5">{suitSymbol}</span>
      </div>

      {isTrump && (
        <span
          className="absolute top-1.5 right-1.5 text-[10px] font-semibold text-[#9A6E1D]"
          title="Козырная масть"
        >
          ★
        </span>
      )}
    </button>
  );
};
