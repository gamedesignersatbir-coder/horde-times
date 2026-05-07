/**
 * Material colour overrides for the GLB characters.
 *
 * The Blender source stores its colours inside Color Ramp nodes feeding the
 * Principled BSDF Base Color input. glTF export only round-trips the BSDF's
 * own default value (the unlit grey 0.8) — Color Ramp graphs do not survive
 * export. So every "main" material in our six .glb files arrives with NO
 * baseColorFactor and renders as plain white.
 *
 * The colours here are the LIGHTER end of each Color Ramp in the .blend, in
 * linear-Blender working space. We feed them to MeshStandardMaterial.color
 * via setRGB(..., THREE.LinearSRGBColorSpace) at clone time so they display
 * the same way Blender's viewport showed them.
 *
 * Materials that already shipped a baseColorFactor (Gold, GoldGlow, Eye,
 * EyeAmber, EyeCyan, EyeRed, Helmet, Visor, Cyan, CrystalGlow, Ember,
 * EmberHot) are not overridden — the GLB carries them correctly.
 *
 * Source: extracted via headless Blender from
 * `horde_times_exports/horde_times_assetssaveanim02.blend`.
 */

export type LinearRGB = readonly [number, number, number];

export const MATERIAL_COLORS_LINEAR: Record<string, LinearRGB> = {
  // Knight (Sir Pommelry)
  M_Tunic:        [0.10, 0.22, 0.55],
  M_Legs:         [0.06, 0.13, 0.35],
  M_Shield:       [0.85, 0.84, 0.78],
  M_Belt:         [0.22, 0.12, 0.05],
  M_DarkWood:     [0.18, 0.10, 0.06],

  // Witch (Mistress Quill)
  M_Robe:         [0.07, 0.10, 0.28],
  M_RobeSkirt:    [0.05, 0.07, 0.20],
  M_Hat:          [0.04, 0.04, 0.10],
  M_Skin:         [0.62, 0.48, 0.34],
  M_Wood:         [0.45, 0.28, 0.12],

  // Hunter (Margate Tossworthy)
  M_Cloak:        [0.18, 0.20, 0.10],
  M_TunicHunter:  [0.32, 0.22, 0.13],
  M_PantsHunter:  [0.20, 0.13, 0.07],
  M_Strap:        [0.14, 0.08, 0.04],

  // Runner enemy
  M_RunnerBody:   [0.16, 0.20, 0.10],
  M_RunnerDark:   [0.10, 0.12, 0.05],
  M_RunnerPale:   [0.55, 0.42, 0.27],

  // Brute enemy
  M_BruteBody:    [0.32, 0.10, 0.07],
  M_BruteDark:    [0.16, 0.06, 0.04],
  M_BrutePale:    [0.55, 0.42, 0.27],
  M_BruteWrap:    [0.30, 0.20, 0.10],

  // Boss enemy
  M_BossBody:     [0.22, 0.10, 0.20],
  M_BossDark:     [0.10, 0.04, 0.09],
  M_BossPale:     [0.55, 0.42, 0.27],
  M_BossPale2:    [0.60, 0.50, 0.35],
  M_BossWrap:     [0.30, 0.20, 0.10],

  // Shared across enemies
  M_JointDark:    [0.08, 0.08, 0.06],
  M_Tooth:        [0.85, 0.78, 0.55],
  M_ClothGrimy:   [0.22, 0.16, 0.08],
};
