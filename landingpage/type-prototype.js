// landingpage/typography-prototype.js
//
// Third test sketch for the sketch-loader (see js/sketch-loader.js).
// Renders "BE A STEREOTYPE" as a 3D-floating text plane (drawn to a canvas
// texture — no font file/loader needed) surrounded by a few simple
// wireframe shapes slowly orbiting around it. No external assets, so it
// mounts instantly, same as cube-prototype.js.
//
// Same contract as the other sketches: export mount(container) that builds
// its own DOM/scene and returns an unmount() cleanup function.

import * as THREE from "three";

const SCENE_BG_COLOR = 0x0e0e14;
const TEXT_STRING = "BE A STEREOTYPE";
const TEXT_COLOR = "#f2f2f2";
const TEXT_WORLD_WIDTH = 6; // world units wide

const ORBIT_COUNT = 5;
const ORBIT_RADIUS_MIN = 2.4;
const ORBIT_RADIUS_MAX = 3.4;
const ORBIT_SPEED = 0.15; // radians/sec, varies slightly per shape
const SHAPE_COLOR = 0x9fe870;

const PARALLAX_STRENGTH = 0.4;

function createTextTexture(text) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const probeSize = 200;
  ctx.font = `italic bold ${probeSize}px Arial`;
  const textWidth = ctx.measureText(text).width;

  canvas.width = Math.ceil(textWidth) + 80;
  canvas.height = Math.ceil(probeSize * 1.4);

  ctx.font = `italic bold ${probeSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return { texture, aspect: canvas.width / canvas.height };
}

const SHAPE_GEOMETRIES = [
  () => new THREE.IcosahedronGeometry(0.35, 0),
  () => new THREE.TorusGeometry(0.3, 0.1, 8, 16),
  () => new THREE.BoxGeometry(0.4, 0.4, 0.4),
  () => new THREE.OctahedronGeometry(0.35, 0),
  () => new THREE.TetrahedronGeometry(0.4, 0),
];

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
    45,
    initialWidth / initialHeight,
    0.1,
    100
  );
  camera.position.set(0, 0, 7);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialWidth, initialHeight);
  mountEl.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 1));

  // ---- Text plane ----
  const { texture, aspect } = createTextTexture(TEXT_STRING);
  const textHeight = TEXT_WORLD_WIDTH / aspect;
  const textMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
  });
  const textPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(TEXT_WORLD_WIDTH, textHeight),
    textMaterial
  );
  scene.add(textPlane);

  // ---- Orbiting shapes ----
  const orbitGroup = new THREE.Group();
  scene.add(orbitGroup);

  const shapes = Array.from({ length: ORBIT_COUNT }, (_, i) => {
    const geometry = SHAPE_GEOMETRIES[i % SHAPE_GEOMETRIES.length]();
    const material = new THREE.MeshBasicMaterial({
      color: SHAPE_COLOR,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const angleOffset = (i / ORBIT_COUNT) * Math.PI * 2;
    const radius =
      ORBIT_RADIUS_MIN + Math.random() * (ORBIT_RADIUS_MAX - ORBIT_RADIUS_MIN);
    const speed = ORBIT_SPEED * (0.7 + Math.random() * 0.6);
    orbitGroup.add(mesh);
    return { mesh, geometry, material, angleOffset, radius, speed };
  });

  // ---- Pointer parallax (desktop-friendly, harmless on touch) ----
  const pointerNDC = new THREE.Vector2(0, 0);
  function onPointerMove(e) {
    pointerNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
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

    shapes.forEach(({ mesh, angleOffset, radius, speed }) => {
      const angle = angleOffset + t * speed;
      mesh.position.set(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.6, 0);
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.015;
    });

    // Whole scene drifts gently toward the pointer.
    scene.position.x += (pointerNDC.x * PARALLAX_STRENGTH - scene.position.x) * 0.04;
    scene.position.y += (pointerNDC.y * PARALLAX_STRENGTH - scene.position.y) * 0.04;

    renderer.render(scene, camera);
  }
  animate();

  return function unmount() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onResize);
    textMaterial.dispose();
    textPlane.geometry.dispose();
    texture.dispose();
    shapes.forEach(({ geometry, material }) => {
      geometry.dispose();
      material.dispose();
    });
    renderer.dispose();
    if (container.contains(mountEl)) container.removeChild(mountEl);
  };
}