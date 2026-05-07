import * as THREE from 'three';
import { GLTFLoader }  from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const gsap          = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
if (gsap && ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

/* ─── Renderer ─── */
const canvas   = document.getElementById('hero-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.6;

/* ─── Scene / Camera ─── */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x060606);
scene.fog        = new THREE.FogExp2(0x060606, 0.045);

const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(0, 0.05, 3.8);

/* ─── Lighting ─── */
scene.add(new THREE.AmbientLight(0xfff8f0, 2.2));
const key = new THREE.DirectionalLight(0xfff0d0, 4.5);
key.position.set(3, 5, 5);
scene.add(key);
const fill = new THREE.DirectionalLight(0xc0d8ff, 1.2);
fill.position.set(-5, 2, 3);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 2.2);
rim.position.set(-1, -3, -5);
scene.add(rim);

/* ─────────────────────────────────────────────────────────────────────
   PERSISTENT CLEAN MASK — local-space projection

   HOW IT WORKS:
   • One 512×512 canvas mask covers the whole bag in bagGroup LOCAL space.
   • The shader converts each fragment's world position → bagGroup local
     position using uGroupInvMat (updated every frame so it rotates with
     the bag). It then normalises the local XY to [0,1] to sample the mask.
   • CPU hit points are transformed the same way via bagGroup.worldToLocal().
   • Because everything is in the SAME rotating local space, circles painted
     on the mask appear as true circles on the 3D surface with no UV
     distortion and no seam artefacts.
   • Painted pixels are permanent — page refresh resets to all-dirty.
───────────────────────────────────────────────────────────────────────*/

const MASK_SIZE    = 512;
const BAG_HALFEXT  = 1.1;   // half-extent of bagGroup in local units (slight padding beyond 0.95)
const BRUSH_PX     = 52;    // brush radius in mask pixels ≈ 0.22 world units

/* Single shared mask canvas for the whole bag */
const maskCvs = document.createElement('canvas');
maskCvs.width = maskCvs.height = MASK_SIZE;
const maskCtx = maskCvs.getContext('2d');
maskCtx.fillStyle = '#000';
maskCtx.fillRect(0, 0, MASK_SIZE, MASK_SIZE);
const maskTex = new THREE.CanvasTexture(maskCvs);
maskTex.wrapS = maskTex.wrapT = THREE.ClampToEdgeWrapping;

function paintAt(localX, localY) {
  /* localX/Y are in bagGroup local space — normalize to canvas pixels */
  const px = (localX / BAG_HALFEXT) * 0.5 + 0.5;   // [0,1]
  const py = (localY / BAG_HALFEXT) * 0.5 + 0.5;   // [0,1] — Y same direction (local space, no flip)
  const cx = px * MASK_SIZE;
  const cy = (1.0 - py) * MASK_SIZE;                // canvas Y is flipped

  const g = maskCtx.createRadialGradient(cx, cy, 0, cx, cy, BRUSH_PX);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.5,  'rgba(255,255,255,0.9)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  maskCtx.fillStyle = g;
  maskCtx.beginPath();
  maskCtx.arc(cx, cy, BRUSH_PX, 0, Math.PI * 2);
  maskCtx.fill();
  maskTex.needsUpdate = true;
}

/* ─── Shared uniforms — one matrix + mask referenced by every material ─── */
const sharedGroupInvMat = { value: new THREE.Matrix4() };
const sharedMask        = { value: maskTex };

/* ─── Shader ─── */
const vertexShader = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vec4 wp    = modelMatrix * vec4(position, 1.0);
    vWorldPos  = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uMap;           // original Meshy texture
  uniform sampler2D uMask;          // persistent clean mask
  uniform mat4      uGroupInvMat;   // bagGroup inverse world matrix (rotates with bag)

  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec4 clean = texture2D(uMap, vUv);

    /* Convert world pos → bagGroup local space → normalised [0,1] for mask */
    vec3  local   = (uGroupInvMat * vec4(vWorldPos, 1.0)).xyz;
    vec2  maskUV  = local.xy / ${BAG_HALFEXT.toFixed(2)} * 0.5 + 0.5;
    maskUV = clamp(maskUV, 0.0, 1.0);
    float maskVal = texture2D(uMask, maskUV).r;

    /* Dirty: desaturate + warm dust tint — same luminance, different colour */
    float lum  = dot(clean.rgb, vec3(0.299, 0.587, 0.114));
    vec3  dust = vec3(0.60, 0.54, 0.45);
    vec3  dirty = mix(vec3(lum), dust, 0.50);
    dirty        = mix(clean.rgb, dirty, 0.82);

    vec3 col = mix(dirty, clean.rgb, maskVal);
    gl_FragColor = vec4(col, clean.a);
  }
`;

function makeRevealMat(tex) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMap:         { value: tex },
      uMask:        sharedMask,           // same canvas texture reference
      uGroupInvMat: sharedGroupInvMat,    // same matrix reference
    },
    vertexShader,
    fragmentShader,
    side: THREE.FrontSide,
  });
}

/* ─── Particles ─── */
const pGeo = new THREE.BufferGeometry();
const pArr = new Float32Array(280 * 3);
for (let i = 0; i < 280; i++) {
  pArr[i*3]   = (Math.random()-0.5)*14;
  pArr[i*3+1] = (Math.random()-0.5)*10;
  pArr[i*3+2] = (Math.random()-0.5)*6;
}
pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3));
const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
  color: 0xC9A96E, size: 0.022, transparent: true, opacity: 0.45, sizeAttenuation: true,
}));
scene.add(particles);

/* ─── State ─── */
const bagGroup  = new THREE.Group();
scene.add(bagGroup);
let   rayTargets = [];
let   scrollRotY = 0;
let   time       = 0;

/* ─── Load GLB ─── */
const loaderEl = document.getElementById('model-loader');
const barEl    = document.getElementById('loader-bar');

const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

gltfLoader.load(
  'assets/models/bag.glb',

  (gltf) => {
    const model = gltf.scene;

    /* Centre + scale to fit */
    const box = new THREE.Box3().setFromObject(model);
    const sz  = new THREE.Vector3();
    const ctr = new THREE.Vector3();
    box.getSize(sz);
    box.getCenter(ctr);
    const s = 1.9 / Math.max(sz.x, sz.y, sz.z);
    model.scale.setScalar(s);
    model.position.sub(ctr.multiplyScalar(s));

    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow    = true;
      child.receiveShadow = true;
      rayTargets.push(child);

      const orig = Array.isArray(child.material) ? child.material[0] : child.material;
      const tex  = orig?.map ?? null;
      if (tex) {
        tex.colorSpace = THREE.SRGBColorSpace;
        child.material  = makeRevealMat(tex);
      }
    });

    bagGroup.add(model);

    /* Entrance */
    bagGroup.scale.setScalar(0.01);
    bagGroup.position.z = -2;
    gsap.to(bagGroup.scale,    { x:1, y:1, z:1, duration:1.5, delay:0.2, ease:'power3.out' });
    gsap.to(bagGroup.position, { z:0,           duration:1.5, delay:0.2, ease:'power3.out' });

    if (barEl) barEl.style.width = '100%';
    setTimeout(() => loaderEl?.classList.add('hidden'), 400);
  },

  (xhr) => {
    if (xhr.lengthComputable && barEl)
      barEl.style.width = `${(xhr.loaded / xhr.total) * 90}%`;
  },
  (err) => { console.error('GLB error:', err); loaderEl?.classList.add('hidden'); }
);

/* ─── Scroll ─── */
if (gsap && ScrollTrigger) {
  ScrollTrigger.create({
    trigger: '#hero', start: 'top top', end: 'bottom top', scrub: 1.5,
    onUpdate: (self) => { scrollRotY = self.progress * Math.PI * 1.6; },
  });
}

/* ─── Raycaster — paint in local space ─── */
const raycaster  = new THREE.Raycaster();
const mouse      = new THREE.Vector2(-10, -10);
const _localPt   = new THREE.Vector3();

function handlePointer(clientX, clientY) {
  if (rayTargets.length === 0) return;
  const rect = canvas.getBoundingClientRect();
  mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
  mouse.y = -((clientY - rect.top)  / rect.height)  * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(rayTargets, false);

  if (hits.length > 0) {
    /* Convert world hit → bagGroup local space — same space the shader uses */
    _localPt.copy(hits[0].point);
    bagGroup.worldToLocal(_localPt);
    paintAt(_localPt.x, _localPt.y);
  }
}

window.addEventListener('mousemove', (e) => handlePointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchmove', (e) => {
  handlePointer(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

/* ─── Render loop ─── */
function animate() {
  requestAnimationFrame(animate);
  time += 0.007;

  bagGroup.position.y = Math.sin(time * 0.7) * 0.04;
  bagGroup.rotation.y = Math.sin(time * 0.25) * 0.06 + scrollRotY;
  bagGroup.rotation.x = Math.sin(time * 0.2)  * 0.02;

  /* Update inverse matrix every frame so shader stays in sync with rotation */
  bagGroup.updateMatrixWorld();
  sharedGroupInvMat.value.copy(bagGroup.matrixWorld).invert();

  particles.rotation.y = time * 0.035;
  particles.rotation.x = time * 0.012;

  renderer.render(scene, camera);
}
animate();

/* ─── Resize ─── */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
