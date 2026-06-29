import React from 'react';
import { Card, CardColor } from '../types';

interface UnoCardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
  playable?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  isFlipped?: boolean;
}

const cardColorBg: Record<CardColor, string> = {
  red: '#dc2626',
  yellow: '#d97706',
  green: '#16a34a',
  blue: '#2563eb',
  wild: '#1e1b4b',
};

const cardColorLight: Record<CardColor, string> = {
  red: '#fca5a5',
  yellow: '#fcd34d',
  green: '#6ee7b7',
  blue: '#93c5fd',
  wild: '#a5b4fc',
};

const cardColorDark: Record<CardColor, string> = {
  red: '#991b1b',
  yellow: '#92400e',
  green: '#14532d',
  blue: '#1e3a8a',
  wild: '#312e81',
};

export const UnoCard: React.FC<UnoCardProps> = ({
  card,
  onClick,
  disabled = false,
  playable = true,
  size = 'md',
  isFlipped = false,
}) => {
  const sizeConfig = {
    sm: { w: 52, h: 76, r: 8, border: 2, fontSize: 12, symbolSize: 18 },
    md: { w: 88, h: 128, r: 14, border: 3, fontSize: 18, symbolSize: 36 },
    lg: { w: 112, h: 164, r: 18, border: 4, fontSize: 24, symbolSize: 48 },
  }[size];

  const { w, h, r, border, fontSize, symbolSize } = sizeConfig;
  const bg = cardColorBg[card.color];
  const light = cardColorLight[card.color];
  const dark = cardColorDark[card.color];

  const renderSymbol = (small = false) => {
    const s = small ? symbolSize * 0.38 : symbolSize;
    const color = card.color === 'wild' ? '#ffffff' : bg;

    switch (card.type) {
      case 'number':
        return (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={small ? fontSize * 0.7 : fontSize * 1.8}
            fontWeight="900"
            fill={color}
            fontFamily="Arial Black, sans-serif"
            stroke={small ? 'none' : 'rgba(0,0,0,0.2)'}
            strokeWidth={small ? 0 : 1}
          >
            {card.value !== undefined ? card.value : ''}
          </text>
        );
      case 'skip':
        return (
          <g>
            <circle cx="0" cy="0" r={s * 0.85} fill="none" stroke={color} strokeWidth={s * 0.22} />
            <line
              x1={-s * 0.55} y1={s * 0.55}
              x2={s * 0.55} y2={-s * 0.55}
              stroke={color} strokeWidth={s * 0.22} strokeLinecap="round"
            />
          </g>
        );
      case 'reverse':
        return (
          <g fill={color}>
            <path d={`M ${-s*0.6} ${-s*0.25} L ${-s*0.1} ${-s*0.7} L ${-s*0.1} ${-s*0.42} Q ${s*0.6} ${-s*0.42} ${s*0.6} ${s*0.2} Q ${s*0.6} ${s*0.55} ${s*0.1} ${s*0.55} L ${s*0.1} ${s*0.28} Q ${-s*0.15} ${s*0.28} ${-s*0.15} ${-s*0.08} L ${-s*0.6} ${-s*0.08} Z`} />
            <path d={`M ${s*0.6} ${s*0.25} L ${s*0.1} ${s*0.7} L ${s*0.1} ${s*0.42} Q ${-s*0.6} ${s*0.42} ${-s*0.6} ${-s*0.2} Q ${-s*0.6} ${-s*0.55} ${-s*0.1} ${-s*0.55} L ${-s*0.1} ${-s*0.28} Q ${s*0.15} ${-s*0.28} ${s*0.15} ${s*0.08} L ${s*0.6} ${s*0.08} Z`} />
          </g>
        );
      case 'draw_2':
        return (
          <g>
            <rect x={-s*0.55} y={-s*0.75} width={s*0.8} height={s*1.1} rx={s*0.12} fill="white" stroke={color} strokeWidth={s*0.1} />
            <rect x={-s*0.25} y={-s*0.55} width={s*0.8} height={s*1.1} rx={s*0.12} fill="white" stroke={color} strokeWidth={s*0.1} />
            <rect x={-s*0.25} y={-s*0.55} width={s*0.8} height={s*1.1} rx={s*0.12} fill={color} />
            <text x={s*0.15} y={s*0.08} textAnchor="middle" dominantBaseline="central" fontSize={s*0.45} fontWeight="900" fill="white" fontFamily="Arial Black, sans-serif">+2</text>
          </g>
        );
      case 'wild':
        return (
          <g>
            <path d={`M 0 ${-s} L ${s*0.866} ${s*0.5} L ${-s*0.866} ${s*0.5} Z`} fill="none" />
            <clipPath id={`wclip-${card.id}-${small ? 's' : 'l'}`}>
              <circle cx="0" cy="0" r={s * 0.9} />
            </clipPath>
            <g clipPath={`url(#wclip-${card.id}-${small ? 's' : 'l'})`}>
              <rect x={-s} y={-s} width={s} height={s} fill="#dc2626" />
              <rect x={0} y={-s} width={s} height={s} fill="#2563eb" />
              <rect x={-s} y={0} width={s} height={s} fill="#16a34a" />
              <rect x={0} y={0} width={s} height={s} fill="#d97706" />
            </g>
            <circle cx="0" cy="0" r={s * 0.9} fill="none" stroke="white" strokeWidth={s * 0.12} />
          </g>
        );
      case 'draw_4':
        return (
          <g>
            {[
              { dx: -s*0.45, dy: -s*0.4, rot: -18, fill: '#2563eb' },
              { dx: -s*0.15, dy: -s*0.55, rot: -6, fill: '#dc2626' },
              { dx: s*0.15, dy: -s*0.45, rot: 6, fill: '#16a34a' },
              { dx: s*0.38, dy: -s*0.3, rot: 18, fill: '#d97706' },
            ].map((c, i) => (
              <g key={i} transform={`translate(${c.dx}, ${c.dy}) rotate(${c.rot})`}>
                <rect x={-s*0.22} y={-s*0.32} width={s*0.44} height={s*0.62} rx={s*0.06} fill={c.fill} stroke="white" strokeWidth={s*0.05} />
              </g>
            ))}
            <rect x={-s*0.25} y={s*0.05} width={s*0.5} height={s*0.48} rx={s*0.08} fill="white" />
            <text x="0" y={s*0.32} textAnchor="middle" dominantBaseline="central" fontSize={s*0.35} fontWeight="900" fill="#1e1b4b" fontFamily="Arial Black, sans-serif">+4</text>
          </g>
        );
      default:
        return null;
    }
  };

  if (isFlipped) {
    return (
      <svg
        width={w} height={h}
        viewBox={`0 0 ${w} ${h}`}
        onClick={!disabled ? onClick : undefined}
        style={{ cursor: disabled ? 'default' : 'pointer', flexShrink: 0 }}
      >
        {/* Card shadow */}
        <rect x={2} y={3} width={w-4} height={h-3} rx={r} fill="rgba(0,0,0,0.35)" />
        {/* Card body - deep red back */}
        <rect x={0} y={0} width={w} height={h} rx={r} fill="#7f1d1d" />
        <rect x={border} y={border} width={w-border*2} height={h-border*2} rx={r-2} fill="#991b1b" />
        {/* Inner frame */}
        <rect x={border*3} y={border*3} width={w-border*6} height={h-border*6} rx={r-4} fill="none" stroke="#fbbf24" strokeWidth={1.5} />
        {/* UNO badge */}
        <ellipse cx={w/2} cy={h/2} rx={w*0.32} ry={h*0.16} fill="#7f1d1d" transform={`rotate(-25, ${w/2}, ${h/2})`} />
        <ellipse cx={w/2} cy={h/2} rx={w*0.30} ry={h*0.14} fill="#dc2626" transform={`rotate(-25, ${w/2}, ${h/2})`} />
        <text
          x={w/2} y={h/2}
          textAnchor="middle" dominantBaseline="central"
          fontSize={fontSize * 1.1} fontWeight="900"
          fill="#fbbf24" fontFamily="Arial Black, sans-serif"
          transform={`rotate(-25, ${w/2}, ${h/2})`}
        >UNO</text>
        {/* Gloss */}
        <rect x={0} y={0} width={w} height={h*0.45} rx={r} fill="url(#gloss)" opacity={0.15} />
        <defs>
          <linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  const isWild = card.color === 'wild';
  const gradId = `grad-${card.id}`;
  const ovalId = `oval-${card.id}`;

  const pulseStyle = playable && !disabled ? {
    filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.9))',
    animation: 'none',
  } : {};

  const hoverStyle = disabled ? { opacity: 0.55 } : {};

  return (
    <svg
      width={w} height={h}
      viewBox={`0 0 ${w} ${h}`}
      onClick={!disabled ? onClick : undefined}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        transition: 'transform 0.2s, filter 0.2s',
        ...pulseStyle,
        ...hoverStyle,
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={light} />
          <stop offset="50%" stopColor={bg} />
          <stop offset="100%" stopColor={dark} />
        </linearGradient>
        <linearGradient id="gloss2" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="60%" stopColor="white" stopOpacity="0.05" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
        {isWild && (
          <linearGradient id={`wg-${card.id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#312e81" />
            <stop offset="100%" stopColor="#1e1b4b" />
          </linearGradient>
        )}
      </defs>

      {/* Drop shadow */}
      <rect x={3} y={4} width={w-6} height={h-4} rx={r} fill="rgba(0,0,0,0.4)" />

      {/* Card body */}
      <rect
        x={0} y={0} width={w} height={h} rx={r}
        fill={isWild ? `url(#wg-${card.id})` : `url(#${gradId})`}
      />

      {/* White border frame */}
      <rect x={border} y={border} width={w-border*2} height={h-border*2} rx={r-1}
        fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth={border === 2 ? 1.5 : 2} />

      {/* Oval in center */}
      <ellipse
        cx={w/2} cy={h/2}
        rx={w * 0.38} ry={h * 0.30}
        fill="white"
        transform={`rotate(-25, ${w/2}, ${h/2})`}
        opacity={0.95}
      />
      <ellipse
        cx={w/2} cy={h/2}
        rx={w * 0.36} ry={h * 0.28}
        fill={isWild ? `url(#wg-${card.id})` : bg}
        transform={`rotate(-25, ${w/2}, ${h/2})`}
        opacity={0.08}
      />

      {/* Center symbol */}
      <g transform={`translate(${w/2}, ${h/2})`}>
        {renderSymbol(false)}
      </g>

      {/* Top-left corner badge */}
      <g transform={`translate(${border*2 + 4}, ${border*2 + 4})`}>
        {renderSymbol(true)}
      </g>

      {/* Bottom-right corner badge (rotated 180) */}
      <g transform={`translate(${w - border*2 - 4}, ${h - border*2 - 4}) rotate(180)`}>
        {renderSymbol(true)}
      </g>

      {/* Gloss overlay */}
      <rect x={0} y={0} width={w} height={h*0.5} rx={r} fill="url(#gloss2)" />

      {/* Playable ring */}
      {playable && !disabled && (
        <rect
          x={-3} y={-3} width={w+6} height={h+6} rx={r+2}
          fill="none" stroke="#fbbf24" strokeWidth={3}
          opacity={0.85}
        />
      )}
    </svg>
  );
};
