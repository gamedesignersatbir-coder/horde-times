import { describe, it, expect } from 'vitest';
import { isInsideArc } from './weapons';

// Facing convention here matches player.ts: Math.atan2(moveX, moveZ).
// At facing == 0 the character points along +Z, so a point at (0, 0, +1)
// is directly in front.

describe('swordswing arc geometry', () => {
  it('point directly in front, within range, is inside the arc', () => {
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
      { x: 0, z: 1.5 },
    )).toBe(true);
  });

  it('point behind the swinger is outside', () => {
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
      { x: 0, z: -1.5 },
    )).toBe(false);
  });

  it('point sideways beyond half-angle is outside', () => {
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 6 },
      { x: 1.4, z: 0.1 },
    )).toBe(false);
  });

  it('point past max range is outside', () => {
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: 0, range: 2.5, halfAngleRad: Math.PI / 3 },
      { x: 0, z: 5.0 },
    )).toBe(false);
  });

  it('rotated facing: a point along the new forward is inside', () => {
    // facing 90° (atan2(1,0) = π/2) → forward is +X
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: Math.PI / 2, range: 2.5, halfAngleRad: Math.PI / 3 },
      { x: 1.5, z: 0 },
    )).toBe(true);
    // and the old +Z direction is now sideways/behind, outside
    expect(isInsideArc(
      { ox: 0, oz: 0, facing: Math.PI / 2, range: 2.5, halfAngleRad: Math.PI / 6 },
      { x: 0, z: 1.5 },
    )).toBe(false);
  });
});
