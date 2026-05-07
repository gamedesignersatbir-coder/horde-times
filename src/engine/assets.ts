import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MATERIAL_COLORS_LINEAR } from './character-palette';

/**
 * Character GLB asset pipeline. Each character is a single .glb that bundles
 * geometry, bone-parented mesh hierarchy, and five animations (Idle, Run,
 * Attack, Hit, Death). Loaded once at boot, cloned per spawn.
 */

export type CharacterAssetId =
  | 'sir_pommelry' | 'mistress_quill' | 'margate_tossworthy'
  | 'runner' | 'brute' | 'boss';

interface AssetMeta {
  id: CharacterAssetId;
  url: string;
}

export const CHARACTER_ASSETS: AssetMeta[] = [
  { id: 'sir_pommelry',       url: '/assets/characters/sir_pommelry.glb' },
  { id: 'mistress_quill',     url: '/assets/characters/mistress_quill.glb' },
  { id: 'margate_tossworthy', url: '/assets/characters/margate_tossworthy.glb' },
  { id: 'runner',             url: '/assets/characters/runner.glb' },
  { id: 'brute',              url: '/assets/characters/brute.glb' },
  { id: 'boss',               url: '/assets/characters/boss.glb' },
];

export interface LoadedAsset {
  scene: THREE.Group;
  clips: THREE.AnimationClip[];
}

export class AssetCache {
  private cache = new Map<CharacterAssetId, LoadedAsset>();
  private loader = new GLTFLoader();

  async preloadAll(): Promise<void> {
    const jobs = CHARACTER_ASSETS.map(async ({ id, url }) => {
      const gltf = await this.loader.loadAsync(url);
      this.cache.set(id, { scene: gltf.scene, clips: gltf.animations });
    });
    await Promise.all(jobs);
  }

  get(id: CharacterAssetId): LoadedAsset {
    const a = this.cache.get(id);
    if (!a) throw new Error(`Asset "${id}" not preloaded — call preloadAll() first.`);
    return a;
  }

  // Independent skeleton clone per spawn. Materials are also cloned so the
  // existing per-instance hit-flash emissive patches (enemies.ts) don't leak
  // across pool slots.
  //
  // Three things happen at clone time:
  //
  //  1. Material colours from MATERIAL_COLORS_LINEAR are applied via
  //     LinearSRGBColorSpace — Blender Color Ramp setups don't survive glTF
  //     export, so most M_* materials arrive as plain white and we paint
  //     them back from the linear-space colour table.
  //  2. The cloned scene is wrapped in two groups:
  //       outer (returned)   — facing pivot
  //       └─ orient (rot=π)  — flips the GLB's authored -Z forward to +Z
  //          └─ inner (offset) — translated so visual X/Z centre is at 0
  //                              (some characters in the .blend are offset
  //                              from the world origin; the export carries
  //                              that into the GLB and would make the model
  //                              orbit a fake pivot when the player turned)
  //  3. Per-mesh shadow casting is enabled here too so we don't have to do
  //     it again in the consumer.
  cloneFor(id: CharacterAssetId): { scene: THREE.Group; clips: THREE.AnimationClip[] } {
    const src = this.get(id);
    const inner = SkeletonUtils.clone(src.scene) as THREE.Group;

    inner.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;
      const paintOne = (m: THREE.Material): THREE.Material => {
        const c = m.clone();
        const std = c as THREE.MeshStandardMaterial;
        if (std.isMeshStandardMaterial && std.name) {
          const lin = MATERIAL_COLORS_LINEAR[std.name];
          if (lin) std.color.setRGB(lin[0], lin[1], lin[2], THREE.LinearSRGBColorSpace);
          // Eyes are modelled coplanar with the visor / face plate; small
          // depth-precision wobble at typical camera distances makes them
          // appear to "blink" as the camera moves. Polygon-offset pushes
          // the eye fragments slightly toward the camera so the visor is
          // unambiguously behind them at every angle.
          if (std.name === 'M_Eye' || std.name === 'M_EyeAmber'
            || std.name === 'M_EyeCyan' || std.name === 'M_EyeRed') {
            std.polygonOffset = true;
            std.polygonOffsetFactor = -2;
            std.polygonOffsetUnits = -2;
          }
        }
        return c;
      };
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map(paintOne)
        : paintOne(mesh.material);
      mesh.castShadow = true;
    });

    // Centre the visual mesh on (0, _, 0). Compute the world-space bounding
    // box of the cloned scene; offset the inner group by -centerX, -centerZ
    // so rotation pivots through the visible centre. Y minimum is pinned to
    // 0 (feet on ground).
    const box = new THREE.Box3().setFromObject(inner);
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    inner.position.set(-cx, -box.min.y, -cz);

    // Orient layer: rotate 180° on Y so the character's authored -Z forward
    // becomes +Z, matching player.ts's atan2(moveX, moveZ) convention.
    const orient = new THREE.Group();
    orient.rotation.y = Math.PI;
    orient.add(inner);

    const scene = new THREE.Group();
    scene.add(orient);
    return { scene, clips: src.clips };
  }
}

// Process-wide singleton. Lives here (not in main.ts) so domain modules
// import it without creating a circular dependency back through main.ts.
export const assets = new AssetCache();
