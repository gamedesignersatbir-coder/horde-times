import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { AnimatedCharacter } from './animated-character';

// Mock GLB-shaped object: a group with two named clips. Single-track is
// enough — the mixer just needs SOMETHING to play.
function makeMockAsset() {
  const scene = new THREE.Group();
  const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 1]);
  const idle = new THREE.AnimationClip('Idle', 1, [track]);
  const run = new THREE.AnimationClip('Run', 1, [track]);
  return { scene, clips: [idle, run] };
}

describe('AnimatedCharacter — locomotion', () => {
  it('starts in Idle', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    expect(ac.currentState()).toBe('idle');
  });

  it('switches to Run when setMoving(true)', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    ac.setMoving(true);
    expect(ac.currentState()).toBe('run');
  });

  it('returns to Idle when setMoving(false)', () => {
    const ac = new AnimatedCharacter(makeMockAsset());
    ac.setMoving(true);
    ac.setMoving(false);
    expect(ac.currentState()).toBe('idle');
  });
});
