/**
 * Custom SVG glyphs for upgrade cards and HUD weapon slots. Hand-drawn line-art
 * style, rendered in gold (var(--gold)). Replacing the emoji icons removed the
 * "AI Slop" feel — emoji as design elements is a top tell that an interface
 * was generated, not designed.
 *
 * All icons are 48×48 viewBox, intended to render at any size via CSS. Stroke
 * is 2.5 to read crisp at 56px (HUD slot) and 56px (card icon).
 */

const SVG_OPEN = `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">`;

export const ICONS = {
  // Orbiting Blades — twin curved blades around a central pivot
  blades: `${SVG_OPEN}
    <circle cx="24" cy="24" r="3" fill="currentColor"/>
    <path d="M24 8 C 18 14, 18 22, 24 24 C 30 22, 30 14, 24 8 Z" fill="currentColor" fill-opacity="0.18"/>
    <path d="M24 40 C 18 34, 18 26, 24 24 C 30 26, 30 34, 24 40 Z" fill="currentColor" fill-opacity="0.18"/>
    <path d="M24 6 C 18 12, 18 22, 24 24"/>
    <path d="M24 6 C 30 12, 30 22, 24 24"/>
    <path d="M24 42 C 18 36, 18 26, 24 24"/>
    <path d="M24 42 C 30 36, 30 26, 24 24"/>
  </svg>`,

  // Auto-Pistol — small futuristic blaster silhouette
  pistol: `${SVG_OPEN}
    <path d="M10 22 L34 22 L34 18 L40 18 L40 26 L34 26 L34 30 L20 30 L18 36 L12 36 L14 30 L10 30 Z"/>
    <line x1="34" y1="22" x2="40" y2="22" stroke-width="1.5"/>
    <circle cx="20" cy="26" r="1.5" fill="currentColor"/>
  </svg>`,

  // Shockwave — concentric expanding rings
  shockwave: `${SVG_OPEN}
    <circle cx="24" cy="24" r="3" fill="currentColor"/>
    <circle cx="24" cy="24" r="9" stroke-opacity="0.85"/>
    <circle cx="24" cy="24" r="15" stroke-opacity="0.55" stroke-dasharray="2 3"/>
    <circle cx="24" cy="24" r="21" stroke-opacity="0.3" stroke-dasharray="1 4"/>
  </svg>`,

  // Vitality — heart shape
  hp: `${SVG_OPEN}
    <path d="M24 40 C 12 32, 6 22, 12 14 C 17 9, 22 12, 24 16 C 26 12, 31 9, 36 14 C 42 22, 36 32, 24 40 Z" fill="currentColor" fill-opacity="0.18"/>
  </svg>`,

  // Move speed — chevron motion lines
  speed: `${SVG_OPEN}
    <path d="M8 14 L16 24 L8 34"/>
    <path d="M20 14 L28 24 L20 34"/>
    <path d="M32 14 L40 24 L32 34"/>
  </svg>`,

  // Magnet — classic horseshoe magnet
  magnet: `${SVG_OPEN}
    <path d="M14 8 L14 28 a10 10 0 0 0 20 0 L34 8" stroke-linecap="square"/>
    <path d="M14 8 L22 8" stroke-linecap="square"/>
    <path d="M26 8 L34 8" stroke-linecap="square"/>
    <line x1="14" y1="14" x2="22" y2="14"/>
    <line x1="26" y1="14" x2="34" y2="14"/>
  </svg>`,

  // Damage — crossed swords
  damage: `${SVG_OPEN}
    <path d="M10 10 L24 24 L34 22 L36 12 L26 14 L24 24 L38 38"/>
    <path d="M38 10 L24 24 L14 22 L12 12 L22 14 L24 24 L10 38"/>
    <line x1="34" y1="38" x2="38" y2="38"/>
    <line x1="10" y1="38" x2="14" y2="38"/>
  </svg>`,

  // Cooldown — clock with sweep
  cooldown: `${SVG_OPEN}
    <circle cx="24" cy="24" r="14"/>
    <path d="M24 14 L24 24 L32 28"/>
    <line x1="24" y1="6" x2="24" y2="10"/>
    <line x1="24" y1="38" x2="24" y2="42"/>
    <line x1="6" y1="24" x2="10" y2="24"/>
    <line x1="38" y1="24" x2="42" y2="24"/>
  </svg>`,

  // Full heal — plus sign within heart outline
  heal: `${SVG_OPEN}
    <path d="M24 40 C 12 32, 6 22, 12 14 C 17 9, 22 12, 24 16 C 26 12, 31 9, 36 14 C 42 22, 36 32, 24 40 Z"/>
    <line x1="24" y1="20" x2="24" y2="32"/>
    <line x1="18" y1="26" x2="30" y2="26"/>
  </svg>`,

  // Lightning Bolt — classic jagged bolt
  lightning: `${SVG_OPEN}
    <path d="M28 6 L14 26 L22 26 L18 42 L34 20 L26 20 Z" fill="currentColor" fill-opacity="0.22"/>
  </svg>`,

  // Boomerang — curved double-arc with motion lines
  boomerang: `${SVG_OPEN}
    <path d="M10 32 Q 24 6, 38 32 Q 30 26, 24 26 Q 18 26, 10 32 Z" fill="currentColor" fill-opacity="0.18"/>
    <path d="M8 38 L14 36" stroke-opacity="0.55"/>
    <path d="M40 38 L34 36" stroke-opacity="0.55"/>
  </svg>`,
} as const;

export type IconKey = keyof typeof ICONS;
