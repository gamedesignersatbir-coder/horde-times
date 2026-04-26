import * as THREE from 'three';
import { PALETTE } from '../style';
import type { TodPreset } from './timeofday';
import { makeSkyGradientFor } from './timeofday';

export const ARENA_RADIUS = 40;

/** Builds the playable arena: ground, sky, lighting, and decorative props.
 *  Pass a TOD preset to drive the time-of-day mood. */
export function buildArena(scene: THREE.Scene, tod: TodPreset): THREE.Group {
  const root = new THREE.Group();
  root.name = 'arena';

  // ---------- per-run sky + fog from TOD preset ----------
  scene.background = makeSkyGradientFor(tod);
  scene.fog = new THREE.Fog(tod.fogColor, tod.fogNear, tod.fogFar);

  // ---------- per-TOD lighting ----------
  const sun = new THREE.DirectionalLight(tod.sunColor, tod.sunIntensity);
  sun.position.set(...tod.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  const s = 30;
  sun.shadow.camera.left = -s;
  sun.shadow.camera.right = s;
  sun.shadow.camera.top = s;
  sun.shadow.camera.bottom = -s;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.05;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(tod.hemiTop, tod.hemiBottom, tod.hemiIntensity);
  scene.add(hemi);

  const rim = new THREE.DirectionalLight(tod.rimColor, tod.rimIntensity);
  rim.position.set(-14, 16, -12);
  scene.add(rim);

  const bounce = new THREE.DirectionalLight(tod.bounceColor, tod.bounceIntensity);
  bounce.position.set(0, -10, 0);
  scene.add(bounce);

  // ---------- ground ----------
  // Extends well past both mountain rings (72m and 95m) so distant mountains
  // sit ON the ground instead of floating in the sky. ARENA_RADIUS + 90 = 130m.
  const groundGeo = new THREE.CircleGeometry(ARENA_RADIUS + 90, 96);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x8fc46e,
    roughness: 0.92,
    metalness: 0.0,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  // darker grass ring inside the play area to subtly mark the boundary
  const ringGeo = new THREE.RingGeometry(ARENA_RADIUS - 0.3, ARENA_RADIUS + 0.3, 96);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x2a3a1f,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  root.add(ring);

  // grass tufts (instanced) — sparse, brighter, smaller — texture not silhouette
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.35, 4);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0x6ba84a, roughness: 1, flatShading: true });
  const tuftCount = 600;
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, tuftCount);
  tufts.castShadow = false;
  tufts.receiveShadow = true;
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const sc = new THREE.Vector3();
  for (let i = 0; i < tuftCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * (ARENA_RADIUS + 5);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    e.set(0, Math.random() * Math.PI * 2, 0);
    q.setFromEuler(e);
    const s = 0.7 + Math.random() * 0.9;
    sc.set(s, s * (0.6 + Math.random() * 0.7), s);
    m.compose(new THREE.Vector3(x, 0.2, z), q, sc);
    tufts.setMatrixAt(i, m);
  }
  tufts.instanceMatrix.needsUpdate = true;
  root.add(tufts);

  // scattered rocks (a few stylized pyramids) — lighter stone color
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x9a9da2, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 8 + Math.random() * (ARENA_RADIUS - 6);
    const rk = new THREE.Mesh(rockGeo, rockMat);
    rk.position.set(Math.cos(a) * r, 0.4 + Math.random() * 0.3, Math.sin(a) * r);
    const sc = 0.6 + Math.random() * 1.4;
    rk.scale.set(sc, sc * 0.7, sc);
    rk.rotation.y = Math.random() * Math.PI * 2;
    rk.castShadow = true;
    rk.receiveShadow = true;
    root.add(rk);
  }

  // trees — stylized pines, brighter so they don't read as black silhouettes
  // when the sun is on the cool side of golden hour or at lower angles.
  const trunkGeo = new THREE.CylinderGeometry(0.15, 0.22, 1.2, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.95, flatShading: true });
  const leafGeo = new THREE.ConeGeometry(0.9, 2.2, 6);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x4a8a4a, roughness: 0.85, flatShading: true });
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 12 + Math.random() * (ARENA_RADIUS + 18);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.6;
    trunk.castShadow = true;
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.y = 2.2;
    leaves.castShadow = true;
    tree.add(trunk);
    tree.add(leaves);
    const sc = 1 + Math.random() * 0.6;
    tree.scale.setScalar(sc);
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI * 2;
    root.add(tree);
  }

  // soft glowing boundary ring (visible faintly always, brighter when player nears edge)
  const boundaryGeo = new THREE.RingGeometry(ARENA_RADIUS - 0.05, ARENA_RADIUS + 0.05, 96);
  const boundaryMat = new THREE.MeshBasicMaterial({
    color: PALETTE.gold,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  });
  const boundary = new THREE.Mesh(boundaryGeo, boundaryMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.05;
  boundary.name = 'boundary';
  root.add(boundary);

  // ---------- horizon mountain silhouette ----------
  // A jagged ring of distant mountain wedges far past the play area. Sits in
  // the fog so it reads as a dark distant silhouette, not a solid wall. Adds
  // a strong sense of "place" — the arena feels like it's IN somewhere.
  const mountainGroup = new THREE.Group();
  const mountainMat = new THREE.MeshStandardMaterial({
    color: tod.mountainColor,
    roughness: 1,
    metalness: 0,
    flatShading: true,
    fog: true,
  });
  // Two rings of mountains: an inner ring sits inside the fog where the dark
  // material still partially reads (jagged silhouette) and an outer ring further
  // back that fades into the haze (depth without fighting the foreground).
  const placeRing = (radius: number, count: number, hScale: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.1;
      const h = (6 + Math.random() * 10) * hScale;
      const w = 4 + Math.random() * 7;
      const geo = new THREE.ConeGeometry(w, h, 4 + Math.floor(Math.random() * 3));
      const m = new THREE.Mesh(geo, mountainMat);
      // bury the base ~2m below the ground plane so the mountain sits on
      // solid earth rather than perching on a single point.
      m.position.set(Math.cos(a) * radius, h * 0.5 - 2, Math.sin(a) * radius);
      m.rotation.y = Math.random() * Math.PI;
      mountainGroup.add(m);
    }
  };
  placeRing(72, 24, 1.0);   // closer, more visible
  placeRing(95, 28, 1.4);   // farther, fades into haze
  root.add(mountainGroup);

  // ---------- floating ambient motes ----------
  // Slow-rising glowing particles in the air around the play area. Cyan + gold
  // alternating. Sells "atmosphere" with almost no perf cost (single Points).
  // Sparse, dim, small. Motes are atmosphere, not a focal element. Bright/dense
  // motes blow out the bloom pass and turn the screen white. Keep them subtle.
  const moteCount = 90;
  const motePos = new Float32Array(moteCount * 3);
  const moteCol = new Float32Array(moteCount * 3);
  const moteSize = new Float32Array(moteCount);
  const moteSeed = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * (ARENA_RADIUS - 2);
    motePos[i * 3 + 0] = Math.cos(a) * r;
    motePos[i * 3 + 1] = 0.5 + Math.random() * 7;
    motePos[i * 3 + 2] = Math.sin(a) * r;
    const isCyan = Math.random() < 0.55;
    const c = isCyan ? new THREE.Color(PALETTE.cyanGlow) : new THREE.Color(PALETTE.goldGlow);
    // intensity scales by time-of-day — at night motes are much brighter so the
    // arena feels alive in the dark; at noon they're barely there.
    const intensity = 0.18 * tod.moteIntensity;
    moteCol[i * 3 + 0] = c.r * intensity;
    moteCol[i * 3 + 1] = c.g * intensity;
    moteCol[i * 3 + 2] = c.b * intensity;
    moteSize[i] = 2 + Math.random() * 4;
    moteSeed[i] = Math.random() * Math.PI * 2;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  moteGeo.setAttribute('aColor', new THREE.BufferAttribute(moteCol, 3));
  moteGeo.setAttribute('aSize', new THREE.BufferAttribute(moteSize, 1));
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(moteSeed, 1));
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */`
      attribute vec3 aColor;
      attribute float aSize;
      attribute float aSeed;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = aColor;
        vec3 p = position;
        // gentle vertical drift + horizontal sway
        float t = uTime * 0.4 + aSeed;
        p.y += sin(t) * 0.4 + uTime * 0.15;
        p.x += sin(t * 0.7) * 0.3;
        p.z += cos(t * 0.8) * 0.3;
        // wrap height back down so motes loop
        p.y = mod(p.y - 0.5, 9.0) + 0.5;
        vAlpha = 0.45 + 0.55 * (sin(t * 1.3) * 0.5 + 0.5);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = aSize * (220.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - 0.5;
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.05, r) * vAlpha * 0.5;
        gl_FragColor = vec4(vColor * 0.6, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  motes.frustumCulled = false;
  motes.name = 'motes';
  (motes as any).userData.update = (dt: number) => {
    moteMat.uniforms.uTime.value += dt;
  };
  root.add(motes);

  scene.add(root);
  return root;
}
