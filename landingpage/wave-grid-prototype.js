// landingpage/wave-grid-prototype.js
//
// Fourth test sketch for the sketch-loader (see js/sketch-loader.js).
// A grid of small instanced cubes rippling in a slow sine wave, with an
// extra bump that follows the pointer. No external assets — mounts
// instantly, same as cube-prototype.js and typography-prototype.js.
//
// Same contract as the other sketches: export mount(container) that builds
// its own DOM/scene and returns an unmount() cleanup function.

import * as THREE from "three";

const SCENE_BG_COLOR = 0x0c0f14;
const CUBE_COLOR = 0x9fe870;

const GRID_COUNT_X = 28;
const GRID_COUNT_Z = 18;
const GRID_SPACING = 0.45;
const CUBE_SIZE = 0.16;

const WAVE_SPEED = 0.8; // radians/sec
const WAVE_HEIGHT = 0.35; // world units
const WAVE_FREQUENCY = 0.6; // spatial frequency across the grid

const POINTER_BUMP_RADIUS = 2.2; // world units
const POINTER_BUMP_HEIGHT = 1.1;
const POINTER_LERP = 0.08; // how quickly the bump target catches up to the pointer

export function mount(container) {
  const mountEl = document.createElement("div");
  Object.assign(mountEl.style, { width: "100%", height: "100%" });
  container.appendChild(mountEl);

  // Trust the viewport size rather than racing #grass-bg's
  // display:none -> block toggle (see grass-prototype.js for why).
  const initialWidth = mountEl.clientWidth || window.innerWidth;
  const initialHeight = mountEl.clientHeight || window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BG_COLOR);

  const camera = new THREE.PerspectiveCamera(
    50,
    initialWidth / initialHeight,
    0.1,
    100
  );
  camera.position.set(0, 4.5, 6);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialWidth, initialHeight);
  mountEl.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  // ---- Instanced grid ----
  const count = GRID_COUNT_X * GRID_COUNT_Z;
  const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
  const material = new THREE.MeshBasicMaterial({ color: CUBE_COLOR, wireframe: true });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  scene.add(mesh);

  const gridOffsetX = ((GRID_COUNT_X - 1) * GRID_SPACING) / 2;
  const gridOffsetZ = ((GRID_COUNT_Z - 1) * GRID_SPACING) / 2;

  // Precompute each instance's base (x, z) so the animation loop only has
  // to solve for y each frame.
  const basePositions = [];
  const dummy = new THREE.Object3D();
  let idx = 0;
  for (let ix = 0; ix < GRID_COUNT_X; ix++) {
    for (let iz = 0; iz < GRID_COUNT_Z; iz++) {
      const x = ix * GRID_SPACING - gridOffsetX;
      const z = iz * GRID_SPACING - gridOffsetZ;
      basePositions.push({ x, z });
      dummy.position.set(x, 0, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
      idx++;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;

  // ---- Pointer -> ground-plane raycast, so the bump follows the cursor
  // in world space rather than screen space. ----
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2(0, 0);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerTarget = new THREE.Vector3();
  const pointerCurrent = new THREE.Vector3();
  let hasPointer = false;

  function onPointerMove(e) {
    const rect = mountEl.getBoundingClientRect();
    pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    hasPointer = raycaster.ray.intersectPlane(groundPlane, pointerTarget) !== null;
  }
  window.addEventListener("pointermove", onPointerMove);

  function onResize() {
    const w = mountEl.clientWidth || window.innerWidth;
    const h = mountEl.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  let rafId;
  function animate() {
    rafId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    if (hasPointer) {
      pointerCurrent.lerp(pointerTarget, POINTER_LERP);
    }

    for (let i = 0; i < count; i++) {
      const { x, z } = basePositions[i];

      const wave =
        Math.sin(x * WAVE_FREQUENCY + t * WAVE_SPEED) *
        Math.cos(z * WAVE_FREQUENCY * 0.7 + t * WAVE_SPEED * 0.8) *
        WAVE_HEIGHT;

      let bump = 0;
      if (hasPointer) {
        const dx = x - pointerCurrent.x;
        const dz = z - pointerCurrent.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const falloff = Math.max(0, 1 - dist / POINTER_BUMP_RADIUS);
        bump = falloff * falloff * POINTER_BUMP_HEIGHT;
      }

      dummy.position.set(x, wave + bump, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  return function unmount() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onResize);
    geometry.dispose();
    material.dispose();
    mesh.dispose();
    renderer.dispose();
    if (container.contains(mountEl)) container.removeChild(mountEl);
  };
}