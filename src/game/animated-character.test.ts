import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { AnimatedCharacter } from './animated-character';

function makeMockAsset(extras: string[] = []) {
  const scene = new THREE.Group();
  const track = new THREE.NumberKeyframeTrack('.scale[x]', [0, 1], [1, 1]);
  const clips = [
    new THREE.AnimationClip('Idle', 1, [track]),
    new THREE.AnimationClip('Run', 1, [track]),
  ];
  if (extras.includes('Attack')) clips.push(new THREE.AnimationClip('Attack', 22 / 24, [track]));
  if (extras.includes('Hit'))    clips.push(new THREE.AnimationClip('Hit', 14 / 24, [track]));
  if (extras.includes('Death'))  clips.push(new THREE.AnimationClip('Death', 30 / 24, [track]));
  return { scene, clips };
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

describe('AnimatedCharacter — combat', () => {
  it('fires onStrike exactly once after the strike-frame elapses', () => {
    const ac = new AnimatedCharacter(makeMockAsset(['Attack', 'Hit', 'Death']),
      { strikeFrame: 12, attackTotalFrames: 22 });
    const onStrike = vi.fn();
    ac.playAttack(onStrike);
    ac.update(0.4); expect(onStrike).not.toHaveBeenCalled();
    ac.update(0.2); expect(onStrike).toHaveBeenCalledTimes(1);
    ac.update(1.0); expect(onStrike).toHaveBeenCalledTimes(1);
  });

  it('fires onStrike immediately if no Attack clip is bound', () => {
    const ac = new AnimatedCharacter(makeMockAsset()); // no Attack clip
    const onStrike = vi.fn();
    ac.playAttack(onStrike);
    expect(onStrike).toHaveBeenCalledTimes(1);
  });

  it('Death state is terminal — playAttack/setMoving become no-ops', () => {
    const ac = new AnimatedCharacter(makeMockAsset(['Attack', 'Hit', 'Death']),
      { strikeFrame: 12, attackTotalFrames: 22 });
    ac.playDeath(() => {});
    ac.setMoving(true);
    ac.playAttack(() => {});
    expect(ac.currentState()).toBe('death');
  });

  it('reset() returns to Idle and clears state', () => {
    const ac = new AnimatedCharacter(makeMockAsset(['Attack', 'Hit', 'Death']),
      { strikeFrame: 12, attackTotalFrames: 22 });
    ac.playDeath(() => {});
    ac.reset();
    expect(ac.currentState()).toBe('idle');
  });
});
