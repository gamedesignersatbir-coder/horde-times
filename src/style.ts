/**
 * Signature visual identity. The whole game pulls colors from this single source —
 * UI, weapons VFX, character emissive accents, lighting, particles — so the look
 * stays coherent across menus and gameplay.
 *
 * Palette: deep navy + warm gold + electric cyan. Three colors carry the brand.
 *  - NAVY     deep midnight, used for UI panels, fog, ambient shadow
 *  - GOLD     warm runic accent, used for hero text, highlights, ranger weapons
 *  - CYAN     electric arcane, used for blades, lightning, mage weapons
 *  - EMBER    warm fire orange, used for boss accents and impact bursts
 *  - GRASS    sun-warmed olive, base ground tone (slightly desaturated)
 */
export const PALETTE = {
  navyDeep:   0x0c1322,
  navy:       0x1a2238,
  navySoft:   0x2a3550,
  gold:       0xffd166,
  goldDeep:   0xc99844,
  goldGlow:   0xffe9a8,
  cyan:       0x4cc9f0,
  cyanDeep:   0x1f8fc4,
  cyanGlow:   0xb4eaff,
  ember:      0xff7a3c,
  emberGlow:  0xffb784,
  grass:      0x8fc46e,
  grassDeep:  0x4a7a36,
  haze:       0xdde8e2,
  ivory:      0xf4f6fb,
} as const;
