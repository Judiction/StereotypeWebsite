// landingpage/cube-prototype.js
//
// Minimal test sketch for the sketch-loader (see js/sketch-loader.js).
// A rotating wireframe icosahedron that drifts slightly toward the mouse —
// no external assets (no fonts, models, or images), so it mounts instantly
// and is easy to tell apart from the grass sketch while testing.
//
// Same contract as grass-prototype.js: export mount(container) that builds
// its own DOM/scene and returns an unmount() cleanup function.

import * as THREE from "three";

const SCENE_BG_COLOR = 0x0a0a12;
const SHAPE_COLOR = 0x9fe870;
const ROTATE_SPEED = 0.25; // radians/sec on each axis
const PARALLAX_STRENGTH = 0.6; // how far the shape drifts toward the pointer

export function mount(container) {
  const mountEl = document.createElement("div");
  Object.assign(mountEl.style, {
    width: "100%",
    height: "100%",
  });
  container.appendChild(mountEl);

  // Same "fixed background, trust the viewport" approach as grass-prototype —
  // avoids racing the display:none -> block toggle on #grass-bg.
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
  camera.position.set(0, 0, 6);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(initialWidth, initialHeight);
  mountEl.appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(1.6, 0);
  const material = new THREE.MeshBasicMaterial({
    color: SHAPE_COLOR,
    wireframe: true,
  });
  const shape = new THREE.Mesh(geometry, material);
  scene.add(shape);

  const light = new THREE.AmbientLight(0xffffff, 1);
  scene.add(light);

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
    const dt = clock.getDelta();

    shape.rotation.x += ROTATE_SPEED * dt;
    shape.rotation.y += ROTATE_SPEED * 1.3 * dt;

    // Gentle drift toward the pointer, eased rather than snapping to it.
    shape.position.x += (pointerNDC.x * PARALLAX_STRENGTH - shape.position.x) * 0.05;
    shape.position.y += (pointerNDC.y * PARALLAX_STRENGTH - shape.position.y) * 0.05;

    renderer.render(scene, camera);
  }
  animate();

  return function unmount() {
    cancelAnimationFrame(rafId);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("resize", onResize);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
    if (container.contains(mountEl)) container.removeChild(mountEl);
  };
}