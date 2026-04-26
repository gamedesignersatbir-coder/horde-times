import * as THREE from 'three';
import type { WeaponKind } from './types';
import { PALETTE } from '../style';

/**
 * Character archetypes. Each one has different stats AND a different starting
 * weapon, forcing a different playstyle (Brotato model). Visually they share
 * the same low-poly silhouette language and signature gold/cyan accent palette
 * so they read as part of the same world.
 */

export type CharacterId = 'knight' | 'sorceress' | 'hunter';

export interface CharacterStats {
  maxHp: number;
  moveSpeed: number;
  magnetRadius: number;
  damageMult: number;
  cooldownMult: number;
}

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;          // short class title
  blurb: string;          // 1-line flavor for the select screen
  startingWeapon: WeaponKind;
  stats: CharacterStats;
  build: () => THREE.Group;
}

const flat = (color: number, rough = 0.6) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });

const emissive = (color: number, glow = 0.9) =>
  new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: glow,
    roughness: 0.3, metalness: 0.2, flatShading: true,
  });

interface Limbs {
  armL: THREE.Mesh; armR: THREE.Mesh;
  legL: THREE.Mesh; legR: THREE.Mesh;
  body: THREE.Mesh;
}

/** Tag the limbs we want the walk-cycle animation to drive. */
function tag(g: THREE.Group, limbs: Limbs) {
  (g as any).limbs = limbs;
}

// ---------- KNIGHT — balanced melee, signature blue + steel ----------
function buildKnight(): THREE.Group {
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.7, 4, 8), flat(0x3b6dd1, 0.5));
  body.position.y = 1.05; body.castShadow = true; g.add(body);

  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 12), flat(0x6b4318, 0.5));
  belt.position.y = 0.78; belt.castShadow = true; g.add(belt);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), flat(0xe6c9a0, 0.55));
  head.position.y = 1.78; head.castShadow = true; g.add(head);

  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2 + 0.2),
    flat(0xb8babd, 0.35),
  );
  helmet.position.y = 1.85; helmet.castShadow = true; g.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.08), flat(0x111418, 0.2));
  visor.position.set(0, 1.78, 0.27); g.add(visor);

  const shoulderGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const shoulderMat = flat(0xb8babd, 0.35);
  const shL = new THREE.Mesh(shoulderGeo, shoulderMat);
  shL.position.set(-0.46, 1.36, 0); shL.castShadow = true; g.add(shL);
  const shR = shL.clone(); shR.position.x = 0.46; g.add(shR);

  const armGeo = new THREE.CapsuleGeometry(0.12, 0.45, 4, 6);
  const armMat = flat(0x3b6dd1, 0.5);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.5, 1.05, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.5; g.add(armR);

  const legGeo = new THREE.CapsuleGeometry(0.15, 0.5, 4, 6);
  const legMat = flat(0x2a3b5c, 0.6);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.18, 0.4, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.18; g.add(legR);

  const footGeo = new THREE.BoxGeometry(0.22, 0.1, 0.34);
  const footMat = flat(0x2a1a10, 0.7);
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(-0.18, 0.07, 0.04); g.add(footL);
  const footR = footL.clone(); footR.position.x = 0.18; g.add(footR);

  // signature gold crest — ties to the UI accent color
  const crest = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), emissive(PALETTE.gold, 1.4));
  crest.position.set(0, 1.25, 0.43); g.add(crest);

  // Scabbard at the hip — gives the knight visible character. He IS literally a
  // knight; he should carry a sword even when his actual weapon is the orbiting
  // blades. The scabbard reads as silhouette and class identity.
  const scabbard = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.7, 0.04),
    flat(0x3a2418, 0.85),
  );
  scabbard.position.set(0.42, 0.55, 0.05);
  scabbard.rotation.z = -0.18;
  scabbard.castShadow = true;
  g.add(scabbard);

  // Sword hilt poking out of the scabbard
  const hilt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.18, 6),
    flat(0x5a3818, 0.85),
  );
  hilt.position.set(0.5, 0.95, 0.08);
  hilt.rotation.z = -0.18;
  g.add(hilt);

  // Pommel — small gold ball, ties to crest + UI accent
  const pommel = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 6),
    emissive(PALETTE.gold, 0.5),
  );
  pommel.position.set(0.52, 1.05, 0.08);
  g.add(pommel);

  // Round shield slung on the back — gives him a strong silhouette from behind
  // (which is the camera angle), and makes him read as Knight at a glance.
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.06, 16),
    flat(0xc7c8cc, 0.5),
  );
  shield.position.set(0, 1.1, -0.4);
  shield.rotation.x = Math.PI / 2;
  shield.castShadow = true;
  g.add(shield);
  // Gold cross emblem on the shield (visible from behind)
  const emblemV = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.32, 0.02),
    emissive(PALETTE.gold, 0.4),
  );
  emblemV.position.set(0, 1.1, -0.43);
  g.add(emblemV);
  const emblemH = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.08, 0.02),
    emissive(PALETTE.gold, 0.4),
  );
  emblemH.position.set(0, 1.1, -0.43);
  g.add(emblemH);

  tag(g, { armL, armR, legL, legR, body });
  return g;
}

// ---------- SORCERESS — robed, glowing cyan staff orb, hood ----------
function buildSorceress(): THREE.Group {
  const g = new THREE.Group();

  // Brighter purples — read as "purple robe", not "black void". Previous values
  // (0x2a1f4a etc.) were so dark they fell below the lighting threshold and
  // looked like a silhouette in screenshots.
  const robeColor = 0x6a4ea8;     // mid violet
  const sashColor = 0x8064c8;     // brighter accent
  const hoodColor = 0x4a2f8a;     // saturated dark violet (still readable)

  // robe (wider at base via cone)
  const robe = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 12, 1, true), flat(robeColor, 0.7));
  robe.position.y = 0.6; robe.castShadow = true; g.add(robe);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.45, 4, 8), flat(sashColor, 0.6));
  torso.position.y = 1.2; torso.castShadow = true; g.add(torso);

  // hood (cone tilted forward) — saturated violet, not near-black
  const hood = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 8), flat(hoodColor, 0.85));
  hood.position.set(0, 1.85, -0.03); hood.castShadow = true; g.add(hood);

  // shadowed face inside hood — slightly visible skin tone, not pitch black
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), flat(0x2a1830, 0.95));
  face.position.set(0, 1.72, 0.06); g.add(face);

  // glowing cyan eyes
  const eyeMat = emissive(PALETTE.cyan, 1.6);
  const eyeGeo = new THREE.SphereGeometry(0.04, 8, 6);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.07, 1.74, 0.18); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.07; g.add(eyeR);

  // sleeves — match torso so the silhouette reads as one figure
  const armGeo = new THREE.CapsuleGeometry(0.13, 0.45, 4, 6);
  const armMat = flat(sashColor, 0.6);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.42, 1.1, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.42; g.add(armR);

  // staff with glowing orb (held in right hand)
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6), flat(0x8a6840, 0.65));
  staff.position.set(0.55, 1.1, 0.15);
  staff.rotation.z = -0.18;
  staff.castShadow = true;
  g.add(staff);

  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), emissive(PALETTE.cyan, 2.2));
  orb.position.set(0.7, 1.85, 0.15);
  g.add(orb);
  // orb halo (additive sprite-ish — just a slightly bigger transparent sphere)
  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 14, 10),
    new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.18 }),
  );
  halo.position.copy(orb.position); g.add(halo);

  // legs (hidden under robe but animated for bob feel)
  const legGeo = new THREE.CapsuleGeometry(0.12, 0.3, 4, 6);
  const legMat = flat(hoodColor, 0.7);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.12, 0.3, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.12; g.add(legR);

  tag(g, { armL, armR, legL, legR, body: torso });
  return g;
}

// ---------- HUNTER — leather + cloak, gold accents, horned mask ----------
function buildHunter(): THREE.Group {
  const g = new THREE.Group();

  // Brighter leather tones — was 0x4a3a26 (muddy near-black). Now a saturated
  // warm leather that reads under any lighting.
  const leather = 0xa07650;
  const darkLeather = 0x6b4a30;
  const cloakColor = 0x6e3328;     // burnt sienna cloak — was nearly black

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.7, 4, 8), flat(leather, 0.75));
  body.position.y = 1.05; body.castShadow = true; g.add(body);

  // chest harness with gold buckle
  const harness = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.15), flat(darkLeather, 0.85));
  harness.position.set(0, 1.2, 0.32); g.add(harness);
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), emissive(PALETTE.gold, 0.8));
  buckle.position.set(0, 1.2, 0.4); g.add(buckle);

  // cloak (back panel) — saturated red-brown, visible against the grass
  const cloak = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 1.3),
    new THREE.MeshStandardMaterial({ color: cloakColor, roughness: 1, side: THREE.DoubleSide, flatShading: true }),
  );
  cloak.position.set(0, 1.0, -0.3);
  cloak.castShadow = true;
  g.add(cloak);

  // head + horned mask
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), flat(0xc8956a, 0.65));
  head.position.y = 1.78; head.castShadow = true; g.add(head);

  // mask: dark but not black — deep mahogany with visible form
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2 + 0.1), flat(0x4a2812, 0.5));
  mask.position.set(0, 1.78, 0.02); g.add(mask);

  // mask horns — bone color, reads against dark mask
  const hornMat = flat(0xe8d8b0, 0.4);
  const hornGeo = new THREE.ConeGeometry(0.05, 0.22, 6);
  const hornL = new THREE.Mesh(hornGeo, hornMat);
  hornL.position.set(-0.15, 1.92, 0.04); hornL.rotation.z = 0.4; g.add(hornL);
  const hornR = hornL.clone(); hornR.position.x = 0.15; hornR.rotation.z = -0.4; g.add(hornR);

  // glowing gold eye-slits
  const eyeMat = emissive(PALETTE.gold, 1.8);
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.025, 0.02);
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.08, 1.82, 0.27); g.add(eyeL);
  const eyeR = eyeL.clone(); eyeR.position.x = 0.08; g.add(eyeR);

  // arms
  const armGeo = new THREE.CapsuleGeometry(0.12, 0.45, 4, 6);
  const armMat = flat(leather, 0.75);
  const armL = new THREE.Mesh(armGeo, armMat);
  armL.position.set(-0.48, 1.05, 0); armL.castShadow = true; g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.48; g.add(armR);

  // legs
  const legGeo = new THREE.CapsuleGeometry(0.14, 0.5, 4, 6);
  const legMat = flat(darkLeather, 0.7);
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(-0.16, 0.4, 0); legL.castShadow = true; g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legR);

  // boots
  const bootGeo = new THREE.BoxGeometry(0.22, 0.1, 0.34);
  const bootMat = flat(0x3a1f10, 0.7);
  const bootL = new THREE.Mesh(bootGeo, bootMat); bootL.position.set(-0.16, 0.07, 0.04); g.add(bootL);
  const bootR = bootL.clone(); bootR.position.x = 0.16; g.add(bootR);

  tag(g, { armL, armR, legL, legR, body });
  return g;
}

export const CHARACTERS: Record<CharacterId, CharacterDef> = {
  knight: {
    id: 'knight',
    name: 'Sir Pommelry',
    title: 'Knight, Probationary',
    blurb: 'Inherited a sword and a chronic sense of duty from an aunt. Has been meaning to put both down for some years now. Stands in the middle of trouble and lets it spin past him, which is, technically, a kind of strategy.',
    startingWeapon: 'blades',
    stats: { maxHp: 130, moveSpeed: 5.4, magnetRadius: 2.0, damageMult: 1.0, cooldownMult: 1.0 },
    build: buildKnight,
  },
  sorceress: {
    id: 'sorceress',
    name: 'Mistress Quill',
    title: 'Witch (Independent)',
    blurb: "Failed her wizard's exam on a technicality (gender), opened her own practice the following Tuesday. Business cards read: 'Lightning to Order, Reasonable Rates, No Refunds on Account of Weather.'",
    startingWeapon: 'lightning',
    stats: { maxHp: 90, moveSpeed: 6.2, magnetRadius: 2.6, damageMult: 1.25, cooldownMult: 0.92 },
    build: buildSorceress,
  },
  hunter: {
    id: 'hunter',
    name: 'Margate Tossworthy',
    title: 'Returns Specialist',
    blurb: "Fully paid-up member of the Boomerang Throwers' Guild (motto: 'They Come Back. They Always Come Back.'). Has lost three crossbows, two umbrellas, and one quite reasonable hat. Has never lost a boomerang.",
    startingWeapon: 'boomerang',
    stats: { maxHp: 110, moveSpeed: 5.8, magnetRadius: 2.4, damageMult: 1.1, cooldownMult: 0.95 },
    build: buildHunter,
  },
};

export const CHARACTER_LIST: CharacterDef[] = [CHARACTERS.knight, CHARACTERS.sorceress, CHARACTERS.hunter];
