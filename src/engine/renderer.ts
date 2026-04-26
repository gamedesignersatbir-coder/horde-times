import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import type { QualityPreset } from './quality';

/** Procedural top-down sky gradient as a CanvasTexture. */
function makeSkyGradient(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 8; c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#5b9fe6');   // zenith
  grad.addColorStop(0.55, '#a9d4f5');  // mid
  grad.addColorStop(0.85, '#e8efe5');  // horizon haze
  grad.addColorStop(1.0, '#dfe6d8');
  g.fillStyle = grad;
  g.fillRect(0, 0, 8, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/**
 * Final color-grade + vignette pass. Subtle: warmer highlights, cooler shadows,
 * gentle radial darkening at frame edges.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.85 },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.12 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uContrast;
    uniform float uSaturation;
    varying vec2 vUv;

    vec3 saturate(vec3 c, float s) {
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(l), c, s);
    }

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 col = src.rgb;
      // contrast around mid-grey
      col = (col - 0.5) * uContrast + 0.5;
      // saturation
      col = saturate(col, uSaturation);
      // tonal warmth
      col.r += 0.015;
      col.b -= 0.01;
      // vignette
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d));
      col *= mix(1.0, v, 1.0 - uVignette);
      gl_FragColor = vec4(col, src.a);
    }
  `,
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private gradePass: ShaderPass;

  /**
   * Visual-viewport-aware dimensions. iOS standalone PWAs report
   * `window.innerHeight` shorter than the actual screen (it excludes the
   * home-indicator unsafe area), which would size the WebGL backbuffer
   * smaller than the CSS canvas — leaving a black band at the bottom.
   * `visualViewport.height` returns the true painted height including the
   * unsafe area when `viewport-fit=cover` is set.
   */
  private dims(): { w: number; h: number } {
    const vv = window.visualViewport;
    return {
      w: Math.round(vv?.width ?? window.innerWidth),
      h: Math.round(vv?.height ?? window.innerHeight),
    };
  }

  constructor(canvas: HTMLCanvasElement, preset: QualityPreset) {
    this.canvas = canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, preset.dprCap);
    const { w: initW, h: initH } = this.dims();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(initW, initH, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = preset.shadowType;

    this.scene = new THREE.Scene();
    // sky + fog are set by buildArena() per-run from the time-of-day preset.
    // Default to a neutral mid-blue until a run starts.
    this.scene.background = new THREE.Color('#5b9fe6');
    this.scene.fog = new THREE.Fog('#b9c8c4', 38, 130);

    this.camera = new THREE.PerspectiveCamera(58, initW / initH, 0.1, 200);
    this.camera.position.set(0, 12, 12);
    this.camera.lookAt(0, 0, 0);

    this.composer = new EffectComposer(this.renderer);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(initW, initH);
    this.composer.addPass(new RenderPass(this.scene, this.camera));

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(initW, initH),
      preset.bloomStrength,
      preset.bloomRadius,
      preset.bloomThreshold,
    );
    this.composer.addPass(this.bloomPass);

    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);

    // SMAA receives logical dimensions — the EffectComposer handles DPR
    // internally. Multiplying again here was double-applying device pixel
    // ratio, doubling the effective AA resolution and wasting GPU.
    //
    // Always added regardless of quality preset. On iOS WebGL, removing it
    // from the chain (so GradePass becomes the last pass) caused the entire
    // 3D scene to render black — a driver/composer interaction we haven't
    // fully diagnosed. Cost is small relative to bloom; not worth the risk.
    this.composer.addPass(new SMAAPass(initW, initH));

    window.addEventListener('resize', () => this.onResize());
    // iOS standalone PWAs don't always fire `resize` on rotation or when the
    // visual viewport changes (e.g. status-bar appearing). Hook these too.
    window.addEventListener('orientationchange', () => {
      // iOS reports stale dimensions during the rotation animation — re-poll
      // a couple of frames later so we get the post-rotation visual viewport.
      setTimeout(() => this.onResize(), 250);
    });
    window.visualViewport?.addEventListener('resize', () => this.onResize());
  }

  private onResize() {
    const { w, h } = this.dims();
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
  }

  render() {
    this.composer.render();
  }
}
