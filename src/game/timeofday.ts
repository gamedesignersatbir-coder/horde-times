import * as THREE from 'three';

/**
 * Time-of-day presets. Each one tints the entire scene — sun color/intensity,
 * hemisphere ambient, sky gradient stops, fog color, mountain silhouette tone.
 * One TOD is picked per run (random), giving each session a distinct visual
 * mood. The signature gold/cyan accents stay constant across all four so the
 * brand identity carries through.
 */

export type TimeOfDay = 'sunrise' | 'day' | 'sunset' | 'night';

export interface TodPreset {
  id: TimeOfDay;
  label: string;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
  hemiTop: number;
  hemiBottom: number;
  hemiIntensity: number;
  rimColor: number;
  rimIntensity: number;
  bounceColor: number;
  bounceIntensity: number;
  exposure: number;
  // Sky gradient — four stops, top to bottom (zenith → horizon)
  skyStops: [string, string, string, string];
  fogColor: number;
  fogNear: number;
  fogFar: number;
  mountainColor: number;
  // Mote tint multiplier (night = brighter motes for atmosphere)
  moteIntensity: number;
}

export const TOD_PRESETS: Record<TimeOfDay, TodPreset> = {
  sunrise: {
    id: 'sunrise', label: 'Sunrise',
    sunColor: 0xffd0a0, sunIntensity: 2.6, sunPosition: [12, 14, 22],
    hemiTop: 0xffd6c0, hemiBottom: 0x6e7a4a, hemiIntensity: 1.4,
    rimColor: 0xffaa88, rimIntensity: 0.8,
    bounceColor: 0xffb070, bounceIntensity: 0.4,
    exposure: 1.05,
    skyStops: ['#3d4a82', '#c98a64', '#ffc89a', '#ffd9a8'],
    fogColor: 0xe0c4a4, fogNear: 32, fogFar: 120,
    mountainColor: 0x2a2c40,
    moteIntensity: 0.9,
  },
  day: {
    id: 'day', label: 'High Noon',
    sunColor: 0xfff4d6, sunIntensity: 3.2, sunPosition: [22, 38, 18],
    hemiTop: 0xc8e4ff, hemiBottom: 0x6a8a4a, hemiIntensity: 1.6,
    rimColor: 0x88c8ff, rimIntensity: 0.5,
    bounceColor: 0xffd8a0, bounceIntensity: 0.3,
    exposure: 1.0,
    skyStops: ['#5b9fe6', '#a9d4f5', '#e8efe5', '#dfe6d8'],
    fogColor: 0xc8d6cc, fogNear: 38, fogFar: 130,
    mountainColor: 0x1c2436,
    moteIntensity: 0.6,
  },
  sunset: {
    id: 'sunset', label: 'Sunset',
    sunColor: 0xff7a3c, sunIntensity: 2.9, sunPosition: [-22, 12, 14],
    hemiTop: 0xff8a64, hemiBottom: 0x4a3a3a, hemiIntensity: 1.2,
    rimColor: 0xc880ff, rimIntensity: 0.9,
    bounceColor: 0xff8a3c, bounceIntensity: 0.5,
    exposure: 1.1,
    skyStops: ['#1f1450', '#6a3680', '#e96a4a', '#ffb070'],
    fogColor: 0xa8688a, fogNear: 30, fogFar: 110,
    mountainColor: 0x1a1230,
    moteIntensity: 1.1,
  },
  night: {
    id: 'night', label: 'Night',
    sunColor: 0x9ab8ff, sunIntensity: 0.9, sunPosition: [-10, 28, -8],
    hemiTop: 0x4a5e8a, hemiBottom: 0x1a2030, hemiIntensity: 0.7,
    rimColor: 0x6488ff, rimIntensity: 1.2,
    bounceColor: 0x3a4a6a, bounceIntensity: 0.2,
    exposure: 1.2,
    skyStops: ['#04060e', '#0a1430', '#1a2848', '#2a3858'],
    fogColor: 0x2a3450, fogNear: 28, fogFar: 90,
    mountainColor: 0x080a18,
    moteIntensity: 1.8,
  },
};

export const TOD_LIST: TimeOfDay[] = ['sunrise', 'day', 'sunset', 'night'];

export function pickRandomTod(): TimeOfDay {
  return TOD_LIST[Math.floor(Math.random() * TOD_LIST.length)];
}

/** Build a sky gradient texture from four color stops (zenith → horizon). */
export function makeSkyGradientFor(preset: TodPreset): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, preset.skyStops[0]);
  grad.addColorStop(0.55, preset.skyStops[1]);
  grad.addColorStop(0.85, preset.skyStops[2]);
  grad.addColorStop(1.0, preset.skyStops[3]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}
