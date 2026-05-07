import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

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
  cloneFor(id: CharacterAssetId): { scene: THREE.Group; clips: THREE.AnimationClip[] } {
    const src = this.get(id);
    const scene = SkeletonUtils.clone(src.scene) as THREE.Group;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone());
        } else {
          mesh.material = mesh.material.clone();
        }
        mesh.castShadow = true;
      }
    });
    return { scene, clips: src.clips };
  }
}

// Process-wide singleton. Lives here (not in main.ts) so domain modules
// import it without creating a circular dependency back through main.ts.
export const assets = new AssetCache();
