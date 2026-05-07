/**
 * Material colour overrides for the GLB characters.
 *
 * The Blender source uses shader-node setups that don't survive glTF export
 * (only baseColorFactor, normal, etc. round-trip — not procedural shader
 * graphs). Many of the materials in our six .glb files therefore have NO
 * baseColorFactor and load as plain white. This table fills the gap by
 * mapping material names to brand-aligned colours, applied at clone time.
 *
 * Colours intentionally echo the procedural-character palette (`src/style.ts`
 * + the original `characters.ts` + `enemies.ts`) so the GLB upgrade reads as
 * the same characters, not a different set.
 *
 * Materials NOT listed here keep whatever the GLB exported (e.g., the Gold,
 * GoldGlow, EyeRed, EmberHot variants do have explicit colours).
 */

import type { CharacterAssetId } from './assets';

type Hex = number;

const BROWN_LEATHER  = 0x4a2e15;
const BROWN_WOOD     = 0x6b4318;
const BROWN_WOOD_LT  = 0x8a5a2e;
const SKIN           = 0xe6c9a0;
const PALE_WOOD      = 0xd4c8a8;
const CREAM          = 0xfff0d0;
const BANDAGE        = 0xe8dfc8;
const KNIGHT_BLUE    = 0x3b6dd1;
const KNIGHT_BLUE_DK = 0x2a3b5c;
const NAVY_DEEP      = 0x0c1322;
const NAVY           = 0x1a2238;
const NAVY_SHADOW    = 0x141a2c;
const HUNTER_GREEN   = 0x3a5a2e;
const HUNTER_TUNIC   = 0x6b4f2a;
const HUNTER_PANTS   = 0x3a2515;
const RUNNER_MOSS    = 0x88c34a;       // matches enemies.ts runner.color
const RUNNER_MOSS_DK = 0x4a5a25;
const BRUTE_BLOOD    = 0xc94f3a;       // matches enemies.ts brute.color
const BRUTE_BLOOD_DK = 0x6a2818;
const BOSS_PURPLE    = 0x3a2858;
const BOSS_PURPLE_DK = 0x1f1430;
const JOINT_DARK     = 0x2a1a14;
const GRIMY_CLOTH    = 0x6a4a3a;

export const MATERIAL_OVERRIDES: Record<CharacterAssetId, Record<string, Hex>> = {
  sir_pommelry: {
    M_Tunic:    KNIGHT_BLUE,
    M_DarkWood: BROWN_WOOD,
    M_Shield:   0xc99844,              // goldDeep — heraldic shield
    M_Belt:     BROWN_LEATHER,
    M_Legs:     KNIGHT_BLUE_DK,
  },
  mistress_quill: {
    M_Robe:      NAVY,
    M_RobeSkirt: NAVY_SHADOW,
    M_Hat:       NAVY_DEEP,
    M_Skin:      SKIN,
    M_Belt:      BROWN_LEATHER,
    M_DarkWood:  BROWN_WOOD,
    M_Wood:      BROWN_WOOD_LT,
  },
  margate_tossworthy: {
    M_Cloak:        HUNTER_GREEN,
    M_TunicHunter:  HUNTER_TUNIC,
    M_PantsHunter:  HUNTER_PANTS,
    M_Skin:         SKIN,
    M_DarkWood:     BROWN_WOOD,
    M_Wood:         BROWN_WOOD_LT,
    M_Belt:         BROWN_LEATHER,
    M_Strap:        BROWN_LEATHER,
  },
  runner: {
    M_RunnerBody:  RUNNER_MOSS,
    M_RunnerPale:  PALE_WOOD,
    M_RunnerDark:  RUNNER_MOSS_DK,
    M_JointDark:   JOINT_DARK,
    M_Tooth:       CREAM,
    M_ClothGrimy:  GRIMY_CLOTH,
  },
  brute: {
    M_BruteBody:  BRUTE_BLOOD,
    M_BrutePale:  PALE_WOOD,
    M_BruteDark:  BRUTE_BLOOD_DK,
    M_BruteWrap:  BANDAGE,
    M_JointDark:  JOINT_DARK,
    M_Tooth:      CREAM,
    M_ClothGrimy: GRIMY_CLOTH,
  },
  boss: {
    M_BossBody:   BOSS_PURPLE,
    M_BossDark:   BOSS_PURPLE_DK,
    M_BossPale:   PALE_WOOD,
    M_BossPale2:  BANDAGE,
    M_BossWrap:   BANDAGE,
    M_JointDark:  JOINT_DARK,
    M_Tooth:      CREAM,
    M_ClothGrimy: GRIMY_CLOTH,
  },
};
