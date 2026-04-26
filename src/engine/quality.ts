import * as THREE from 'three';

/**
 * Graphics quality presets. Three levels trade GPU work for visual fidelity:
 *
 *   low    — for older phones or to keep cool on long sessions. Native pixel
 *            density, hard PCF shadows, weak bloom, no SMAA, 60 fps.
 *   medium — touch-device default. 1.5x DPR, hard shadows, moderate bloom,
 *            no SMAA, 60 fps. Looks nearly identical to high but cuts GPU
 *            pixel work roughly in half.
 *   high   — desktop default. 2x DPR, soft shadows, full bloom + SMAA, no
 *            framerate cap.
 *
 * The preset is captured once at construction time. Changing it requires a
 * page reload (the EffectComposer + post-processing chain is set up once and
 * re-creating it mid-run is more code than it's worth — a reload is fast).
 */

export type Quality = 'low' | 'medium' | 'high';

export interface QualityPreset {
  dprCap: number;
  shadowType: THREE.ShadowMapType;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  fpsCap: number;
}

export const PRESETS: Record<Quality, QualityPreset> = {
  low: {
    dprCap: 1.0,
    shadowType: THREE.PCFShadowMap,
    bloomStrength: 0.28,
    bloomRadius: 0.5,
    bloomThreshold: 0.9,
    fpsCap: 60,
  },
  medium: {
    dprCap: 1.5,
    shadowType: THREE.PCFShadowMap,
    bloomStrength: 0.38,
    bloomRadius: 0.65,
    bloomThreshold: 0.85,
    fpsCap: 60,
  },
  high: {
    dprCap: 2,
    shadowType: THREE.PCFSoftShadowMap,
    bloomStrength: 0.45,
    bloomRadius: 0.7,
    bloomThreshold: 0.82,
    fpsCap: 0,
  },
};

const STORAGE_KEY = 'horde-times-quality';

/** Detect whether we're on a touch device (used for the default preset). */
function isTouchHost(): boolean {
  return 'ontouchstart' in window || (navigator.maxTouchPoints ?? 0) > 0;
}

/** Read the user's saved quality choice, or fall back to the device default. */
export function getQuality(): Quality {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'low' || stored === 'medium' || stored === 'high') return stored;
  } catch { /* localStorage may be unavailable in private mode */ }
  return isTouchHost() ? 'medium' : 'high';
}

export function setQuality(q: Quality) {
  try { localStorage.setItem(STORAGE_KEY, q); } catch { /* ignore */ }
}

export function getPreset(q: Quality = getQuality()): QualityPreset {
  return PRESETS[q];
}
