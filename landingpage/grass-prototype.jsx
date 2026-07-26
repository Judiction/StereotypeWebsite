import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";

const BLADE_COUNT = 40000;
const PATCH_RADIUS = 10;

// Scene fog/background color for the 3D scene itself (unrelated to the
// loading screen below, which is white).
const SCENE_BG_COLOR = 0x14260c;

// ---- Loading screen ----------------------------------------------------
// Covers the canvas with a white background and "BE A STEREOTYPE" in light
// grey while the fonts, skybox, and 3D models are still being fetched (this
// can take a couple seconds), then fills the letters in black from left to
// right as those assets actually arrive, tracked via a THREE.LoadingManager
// below. The overlay only fades away once everything is loaded, so the
// grass scene is already fully ready the moment it's revealed.
const LOADING_BG_COLOR = "#ffffff";
const LOADING_TEXT = "BE A STEREOTYPE";
const LOADING_TEXT_BASE_COLOR = "#b0b0b0";
const LOADING_TEXT_FILL_COLOR = "#000000";

// ---- Asset base path --------------------------------------------------
// All the local asset files (skybox, font, .glb models, window images)
// live next to this .jsx. When the scene is loaded straight from
// landingpage/index.html the relative filenames already resolve correctly,
// so ASSET_BASE stays "". When the scene is mounted as the background of
// the main site (served from the repo root), the host page sets
// window.__GRASS_ASSET_BASE__ = "./landingpage/" so every asset URL below
// gets pointed at the right folder without touching the loaders.
const ASSET_BASE =
  (typeof window !== "undefined" && window.__GRASS_ASSET_BASE__) || "";

// ---- Touch / mobile detection -----------------------------------------
// True when the primary input is touch (no hover-capable pointer). Drives
// the mobile-specific behavior: the text wraps to two lines, and the hand
// cursor follows the active touch instead of a hovering mouse. Evaluated
// once at startup; a device that can both touch and mouse (e.g. a laptop
// with a touchscreen) is treated as desktop, since it still has hover.
const IS_TOUCH =
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// ---- Text config -----------------------------------------------------
const TEXT_STRING = "BE A STEREOTYPE";
// On touch devices the text is split across these lines instead (top line
// then bottom line); on desktop the single TEXT_STRING above is used.
const TEXT_LINES_MOBILE = ["BE A", "STEREOTYPE"];
const TEXT_WORLD_WIDTH = 10; // how wide the text should be in world units
// Vertical gap between the two mobile lines, as a fraction of a line's
// height (0.2 = a 20%-of-line-height gap between them).
const TEXT_LINE_GAP_RATIO = 0.25;

// ---- Mobile camera framing --------------------------------------------
// On touch there's no parallax to pull the camera around, and the text is
// stacked into two lines, so it needs a different (usually further-back and
// higher) static framing to fit everything on a portrait screen. These are
// only used when IS_TOUCH is true; desktop keeps its own values further
// below. Position is where the camera sits; look-at is the point it aims
// at; FOV widens/narrows the view (bigger = more in frame, more distortion).
const MOBILE_CAMERA_POSITION = { x: 3.5, y: 5, z: 2 };
const MOBILE_CAMERA_LOOK_AT = { x: -18, y: -45, z: -10 };
const MOBILE_CAMERA_FOV = 80;

// How far the "grass got pressed down" effect spreads outward beyond the
// literal letter outlines, in canvas pixels. 0 = grass only presses down
// exactly under the letter shapes. Higher values feather the press further
// out into the surrounding grass, like the letters are pressing down on a
// wider patch than their own silhouette. Try values roughly between 0 and 80.
const TEXT_PRESS_SPREAD = 10;

// ---- Letter press (clicking directly on the metallic text) ------------
// When the left mouse button is held down while the cursor is over the
// letters themselves, the nearby letters sink into the grass, with the
// effect fading out for letters further along the line. Rises back up
// (and stops if you move off the letters, or let go) using the same
// pressAmount easing as the hand cursor's own drop, via CURSOR_PRESS_LERP.
const LETTER_PRESS_DEPTH_RATIO = 0.8; // fraction of a letter's height it sinks by
const LETTER_PRESS_SPREAD = 1.5; // how far along the line neighboring letters are affected (world units)

// ---- Metallic text material tuning ------------------------------------
// Lower roughness = sharper, more mirror-like reflections (clouds read as
// clouds). Higher roughness = blurrier, hazier reflections (clouds blend
// into a soft gradient). 0 is a perfect mirror; 0.05–0.15 is a good range
// for a "polished metal" look that still shows sky detail.
const TEXT_ROUGHNESS = 0.05;
const TEXT_METALNESS = 1.0;
const TEXT_ENV_MAP_INTENSITY = 1.5;
// Rotates the sky horizontally before it's used as the reflection source,
// in the range 0–1 (wraps around). Use this to choose which part of the
// skybox panorama — e.g. the part with the most visible clouds — ends up
// facing the camera in the text's reflection.
const SKY_ROTATION = 0;

// Local font file for the extruded 3D geometry. Three.js needs a
// "typeface.json" font, not a regular .ttf/.otf. To get a real Arial Bold
// Italic version:
//   1. Go to https://gero3.github.io/facetype.js/
//   2. Upload your licensed Arial Bold Italic font file (.ttf)
//   3. Download the generated JSON and save it at the path below
// Until that file exists, the code falls back to a bundled three.js
// font (Helvetiker Bold) fetched from the same CDN as three.js itself,
// just so you have something to look at while testing.
const LOCAL_FONT_URL = ASSET_BASE + "arialbi.json";
const FALLBACK_FONT_URL =
  "https://cdn.jsdelivr.net/npm/three@0.150.1/examples/fonts/helvetiker_bold.typeface.json";

// Equirectangular sky image used both as the reflection source for the
// metallic text and (optionally) as the scene background. Keep this file
// next to index.html / grass-prototype.jsx.
const SKYBOX_URL = ASSET_BASE + "skybox2.png";

// ---- Hand cursor (3D model that follows the mouse) --------------------
// Exported from Blender as glTF Binary (.glb). Keep it next to
// index.html / grass-prototype.jsx.
const CURSOR_MODEL_URL = ASSET_BASE + "hand-cursor.glb";
// Uniform scale applied after load. Blender units rarely match this scene's
// world units 1:1, so this is almost always the first thing you'll tune.
const CURSOR_SCALE = 0.25;
// How far above the raycast hit point the model's origin sits, in world
// units. 0 means the model's Blender-side "contact point" sits exactly on
// the grass; nudge up slightly (e.g. 0.05–0.15) if it visually clips into
// the blades.
const CURSOR_Y_OFFSET = 1.25;
// How quickly the model catches up to the raycast hit point each frame.
// Lower = laggier/floatier, higher = snappier. Kept separate from the
// camera's own lerp so you can tune them independently.
const CURSOR_LERP = 0.18;
// Gentle idle wiggle on the model's X axis (a slow "resting hand" motion),
// independent of the actual mouse movement.
const CURSOR_WIGGLE_AMPLITUDE_DEG = -10; // how far it tilts, in degrees
const CURSOR_WIGGLE_SPEED = 1.2; // radians/sec fed into the sine wave — higher = faster

// ---- Hand cursor brightness (independent of scene lights / bloom) -----
// The model's materials automatically pick up the same bright sky
// environment map used for the metallic text's reflections (via
// scene.environment), which is likely why it's reading as overexposed —
// these two knobs dial back the model's *own* materials without touching
// the global lights or the bloom pass.
const CURSOR_ENV_MAP_INTENSITY = 0.35; // how strongly it reflects the sky env map (1.0 = untouched/full)
const CURSOR_COLOR_MULTIPLIER = 1; // multiplies each material's base color — 1.0 = untouched, lower = darker

// ---- Hand cursor "press" state (left mouse button held down) ----------
// While the button is held: the hand drops down toward the grass and tilts
// forward, and the grass actually gets pushed. Releasing brings the hand
// back up and lets any already-pushed grass rise back up on its own.
const CURSOR_PRESS_Y_RATIO = 0.5; // fraction of CURSOR_Y_OFFSET while pressed (0.5 = half height)
const CURSOR_PRESS_TILT_DEG = -35; // extra forward tilt on top of the idle wiggle, in degrees
const CURSOR_PRESS_LERP = 0.1; // how quickly the press/release transition itself settles in

// ---- "Touched grass today" speech bubble ------------------------------
// A flat image plane that appears the first time the user clicks the grass
// and then trails the hand cursor. Faces straight up (lying flat on the
// grass like everything else), offset to one side of the cursor.
const BUBBLE_IMAGE_URL = ASSET_BASE + "TouchGrass.png";
const BUBBLE_IMAGE_ASPECT = 956 / 250; // width / height of TouchGrass.png
const BUBBLE_WIDTH = 2; // world units wide; height is derived from the aspect
// Offset from the cursor's ground position, in world units. X is sideways,
// Z is toward/away from the camera — tuned so the bubble sits beside the
// hand rather than under it.
const BUBBLE_OFFSET_X = 1.5;
const BUBBLE_OFFSET_Z = 0;
// How high above the grass the plane floats, to avoid z-fighting with the
// ground and being buried in the blades.
const BUBBLE_Y_OFFSET = 0.3;
// Follow smoothing — kept a touch laggier than the hand so it trails
// behind rather than moving in lockstep.
const BUBBLE_LERP = 0.1;
// Degrees to rotate the bubble flat on the grass (around the vertical
// axis), so it reads at a jaunty angle rather than axis-aligned.
const BUBBLE_ROTATION_DEG = 0;

// ---- Computer window spawner: jumps up from below the ground -----------
// Exported from Blender as glTF Binary (.glb), same conventions as the
// hand cursor: apply all transforms before export. Unlike the hand cursor
// though, this one is meant to stand upright (like a monitor), not lie
// flat — WINDOW_UPRIGHT_ROTATION_X below handles that correction.
const WINDOW_MODEL_URL = ASSET_BASE + "window.glb";
// Uniform scale applied to every spawned window.
const WINDOW_SIZE = 0.075;
// A fixed rotation (radians) applied once at spawn, on top of the model's
// own authored orientation, so it reads as "standing up" rather than
// "lying flat." If it lands standing on the wrong edge, try Math.PI/2 with
// the opposite sign, or move the correction to rotation.z instead.
const WINDOW_UPRIGHT_ROTATION_X = Math.PI / 2;

// ---- Jump animation -----------------------------------------------------
// On click: the window starts below the ground, launches upward with some
// sideways drift (both randomized per spawn), tumbles continuously around
// a random axis while airborne, and despawns once it's fallen well below
// the ground again — plain projectile motion (velocity + gravity), no
// physics engine involved.
const WINDOW_SPAWN_DEPTH = 2; // how far below the ground it starts, in world units
const WINDOW_DESPAWN_DEPTH = 4; // how far below the ground it must fall before being removed
const WINDOW_JUMP_SPEED_MIN = 8; // initial upward velocity, world units/sec (randomized per spawn)
const WINDOW_JUMP_SPEED_MAX = 10;
const WINDOW_GRAVITY = 9; // downward acceleration, world units/sec² — bigger = falls back down sooner
const WINDOW_HORIZONTAL_DRIFT_SPEED = 2; // max sideways speed while airborne, world units/sec (random direction)
const WINDOW_SPIN_SPEED_MIN = 1; // tumble speed while airborne, radians/sec (randomized per spawn, direction too)
const WINDOW_SPIN_SPEED_MAX = 4;

// ---- Window spawn trigger -----------------------------------------------
// Windows now spawn continuously while the left mouse button is held down
// AND the cursor is over the grass — roughly one every WINDOW_SPAWN_INTERVAL
// seconds, at wherever the cursor currently is (not just where the click
// started). Releasing, or moving off the canvas, resets the timer, so the
// next hold always starts its own fresh countdown.
const WINDOW_SPAWN_INTERVAL = 0.6; // seconds between spawns while held + hovering

// ---- Randomized window texture ----------------------------------------
// Each spawned window gets one of these applied to its "WindowInterior"
// child, chosen at random. Keep the images next to index.html /
// grass-prototype.jsx, same as the other asset files.
const WINDOW_IMAGE_URLS = [
  "window_img_1.png",
  "window_img_2.png",
  "window_img_3.png",
  "window_img_4.png",
  "window_img_5.png",
  "window_img_6.png",
  "window_img_7.png",
  "window_img_8.png",
  "window_img_9.png",
  "window_img_10.png",
  "window_img_11.png",
  "window_img_12.png",
  "window_img_13.png",
  "window_img_14.png",
  "window_img_15.png"
].map((name) => ASSET_BASE + name);
const WINDOW_INTERIOR_NODE_NAME = "Window_Interior";
// Independent flip controls for the interior image, applied when each
// texture is drawn — toggle either on its own, or both together, to match
// however Window_Interior's UVs are actually laid out.
const WINDOW_IMAGE_FLIP_HORIZONTAL = false;
const WINDOW_IMAGE_FLIP_VERTICAL = false;

// ---- Grass push (mouse hover) ------------------------------------------
// Radius of the circular area of grass that gets pushed down around the
// mouse/cursor position, in world units. Larger = a wider patch of grass
// reacts to the hand at once.
const MOUSE_PUSH_RADIUS = 1;

// ---- Post-processing: bloom + depth of field ---------------------------
// Both run through one shared EffectComposer pass chain, added only if at
// least one of them is enabled — if you flip both to false, rendering goes
// straight back to renderer.render() with zero extra cost. Each is also
// individually cheap: bloom uses three's built-in downsampled mip-chain
// (UnrealBloomPass), and DoF is a single extra blur pass over the frame,
// not a per-object effect — so this should stay lightweight on a modern
// laptop GPU even with 40,000 grass blades already in the scene.
const ENABLE_BLOOM = true;
const BLOOM_STRENGTH = 0.2; // overall glow intensity
const BLOOM_RADIUS = 0.9; // how far the glow spreads outward from bright areas
const BLOOM_THRESHOLD = 0.4; // only pixels brighter than this bloom (0–1) — keeps
// the grass from glowing and mainly lets sun-hit metal / bright sky reflections bloom

const ENABLE_DOF = true;
const DOF_FOCUS_DISTANCE = 7.5; // world units from the camera that stay sharp — tune to
// roughly match the distance from the camera to the text/near grass
const DOF_APERTURE = 0.002; // bigger = shallower focus (more blur away from the focus distance)
const DOF_MAX_BLUR = 0.01; // caps how blurry the most out-of-focus areas can get

// ---- Cursor shadow ------------------------------------------------------
// Real three.js shadow mapping, but scoped down deliberately: the ONLY
// thing that casts a shadow is the (very low-poly) hand model — not the
// 40,000 grass blades, not the letters. That's what keeps this cheap: the
// shadow depth pre-pass only has to render one small object, not the whole
// scene. Cost scales with what casts shadows, not what receives them.
//
// The grass blades themselves don't receive shadows either — that would
// mean hand-modifying their custom shader to sample the shadow map, which
// is real work for a fairly subtle payoff. Instead the ground plane
// underneath the grass receives the shadow, which reads as "shadow on the
// grass" through the natural gaps between blades, at effectively zero
// extra cost (it reuses three's built-in shadow receiving, no custom shader
// work needed). The metallic text receives it too, and completely
// correctly, since it already uses a standard PBR material.
const ENABLE_CURSOR_SHADOW = true;
const SHADOW_MAP_SIZE = 1024; // shadow texture resolution — 512 is noticeably cheaper
// and still fine for a shadow this small and close; 2048 looks crisper but
// is rarely worth it here since the shadow caster (the hand) is small.
const SHADOW_AREA_HALF_SIZE = 6; // world units — how far the shadow camera's view
// extends from the text/interaction area. Keeping this tight (rather than
// covering the whole grass patch) is what gives a small shadow caster like
// the hand good resolution without needing a bigger shadow map.
const SHADOW_BIAS = -0.0015; // nudges the comparison depth to avoid shadow acne
// (self-shadowing artifacts/stripes) on the ground plane. If you see faint
// dark banding on the ground, make this more negative; if the shadow looks
// detached/floating from the hand, make it less negative.

function createBladeGeometry() {
  const segments = 4;
  const width = 0.1;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segments; i++) {
    const t = i / segments; // 0 at base, 1 at tip
    const w = width * (1 - Math.pow(t, 1.4) * 0.9);
    positions.push(-w / 2, t, 0, w / 2, t, 0);
    uvs.push(0, t, 1, t);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2,
      b = i * 2 + 1,
      c = i * 2 + 2,
      d = i * 2 + 3;
    indices.push(a, b, c, b, d, c);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

// Renders the text to a canvas (white on black) so the grass shader can
// sample it as a mask: white = "text is here, flatten the grass", black =
// "leave the grass alone". Uses the browser's real Arial Bold Italic, so it
// doesn't depend on the typeface.json used for the 3D geometry.
//
// `lines` is an array — one entry for a single line (desktop), two for the
// stacked mobile layout. The lines are stacked vertically and each is
// centered horizontally, mirroring how the 3D geometry is laid out, so the
// flattened-grass footprint matches the letters above it.
//
// spreadPx feathers the mask outward beyond the letter outlines (see
// TEXT_PRESS_SPREAD above): we draw the letters once crisp (full-strength
// core, right under the letters) and once again blurred and added on top
// (a soft halo that fades out into the surrounding grass).
function createTextMaskTexture(lines, spreadPx = 0, letterPixelWidth = 900) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const probeSize = 256;
  ctx.font = `italic bold ${probeSize}px Arial`;
  // Size everything off the widest line, so multi-line text keeps the same
  // per-letter scale rather than stretching a short line to full width.
  const widestLine = lines.reduce(
    (w, line) => Math.max(w, ctx.measureText(line).width),
    0
  );
  const lineHeightPx = probeSize * 1.15; // Arial cap+descender ≈ 1.15em
  const lineGapPx = lineHeightPx * TEXT_LINE_GAP_RATIO;
  const blockWidth = widestLine;
  const blockHeight = lineHeightPx * lines.length + lineGapPx * (lines.length - 1);
  const letterAspect = blockWidth / blockHeight; // width / height of the whole text block

  const letterPixelHeight = letterPixelWidth / letterAspect;

  // Margin around the letters so the blurred halo has room to fade out
  // instead of getting clipped at the texture edge.
  const pad = spreadPx * 3;
  canvas.width = Math.round(letterPixelWidth + pad * 2);
  canvas.height = Math.round(letterPixelHeight + pad * 2);

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Scale from probe-space to the actual canvas.
  const pxScale = letterPixelHeight / blockHeight;
  const fontSize = probeSize * pxScale;
  ctx.font = `italic bold ${fontSize}px Arial`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "left"; // left-align lines to match the 3D geometry layout
  ctx.textBaseline = "middle";

  const drawLines = () => {
    const scaledLineH = lineHeightPx * pxScale;
    const scaledGap = lineGapPx * pxScale;
    const scaledBlockH = scaledLineH * lines.length + scaledGap * (lines.length - 1);
    const scaledBlockW = blockWidth * pxScale; // width of the widest line
    const firstLineCenterY =
      canvas.height / 2 - scaledBlockH / 2 + scaledLineH / 2;
    // Left edge of the block, centered horizontally within the canvas — so
    // every line starts here regardless of its own width (left-flush).
    const blockLeftX = canvas.width / 2 - scaledBlockW / 2;
    lines.forEach((line, i) => {
      const y = firstLineCenterY + i * (scaledLineH + scaledGap);
      ctx.fillText(line, blockLeftX, y);
    });
  };

  // Crisp core: grass directly under the letters presses all the way down.
  drawLines();

  // Soft halo: spreads the press outward into the surrounding grass.
  if (spreadPx > 0) {
    ctx.globalCompositeOperation = "lighter"; // additive, so the core stays fully white
    ctx.filter = `blur(${spreadPx}px)`;
    drawLines();
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;

  // How much bigger the full (letters + halo) texture is than the letters
  // alone, so the caller can size the world-space sampling area to match.
  const widthRatio = canvas.width / letterPixelWidth;
  const heightRatio = canvas.height / letterPixelHeight;

  return { texture, letterAspect, widthRatio, heightRatio };
}

const MAX_TRAIL = 40;

const vertexShader = `
  attribute float aVariation;
  uniform float uTime;
  uniform float uRadius;
  uniform float uStrength;
  uniform float uRiseDuration;
  uniform vec2 uTrailPos[${MAX_TRAIL}];
  uniform float uTrailTime[${MAX_TRAIL}];
  // Per-point press strength, baked in when each trail point is laid down.
  // Because the press amount lives per-point instead of as one global
  // multiplier, releasing the button doesn't scale every point down at
  // once — each point just rides out its own uRiseDuration timer, so the
  // trail rises back gradually from its oldest point to its newest.
  uniform float uTrailStrength[${MAX_TRAIL}];

  // Static "text is pressing on the grass" mask
  uniform sampler2D uTextMask;
  uniform vec2 uTextMin;
  uniform vec2 uTextSize;
  uniform vec2 uTextCenter;
  uniform float uTextStrength;
  uniform float uHasTextMask;

  varying float vHeight;
  varying float vVariation;

  void main() {
    vHeight = position.y;
    vVariation = aVariation;

    vec3 instanceWorldPos = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;

    vec3 pos = position;

    // ---- Mouse trail push (unchanged) ----
    float totalPush = 0.0;
    vec2 pushDir = vec2(1.0, 0.0);
    float bestWeight = 0.0;

    for (int i = 0; i < ${MAX_TRAIL}; i++) {
      float age = uTime - uTrailTime[i];
      float temporal = clamp(1.0 - age / uRiseDuration, 0.0, 1.0);
      temporal = smoothstep(0.0, 1.0, temporal);

      float dist = distance(instanceWorldPos.xz, uTrailPos[i]);
      float spatial = 1.0 - smoothstep(0.0, uRadius, dist);

      float weight = spatial * temporal * uTrailStrength[i];
      totalPush = max(totalPush, weight);

      if (weight > bestWeight) {
        bestWeight = weight;
        vec2 away = instanceWorldPos.xz - uTrailPos[i];
        float awayLen = length(away);
        pushDir = awayLen > 0.0001 ? away / awayLen : vec2(1.0, 0.0);
      }
    }

    // totalPush already carries each point's baked-in press strength (see
    // uTrailStrength above), so the smooth press-in ramp is preserved without
    // a global multiplier that would also flatten the gradual release.
    float bend = totalPush * uStrength * pos.y;
    pos.x += pushDir.x * bend;
    pos.z += pushDir.y * bend;
    pos.y -= bend * 0.55;

    // ---- Text mask push: lay the grass down under the metallic text ----
    float textMask = 0.0;
    if (uHasTextMask > 0.5) {
      vec2 tuv = (instanceWorldPos.xz - uTextMin) / uTextSize;
      if (tuv.x >= 0.0 && tuv.x <= 1.0 && tuv.y >= 0.0 && tuv.y <= 1.0) {
        textMask = texture2D(uTextMask, vec2(tuv.x, 1.0 - tuv.y)).r;
      }

      vec2 textAway = instanceWorldPos.xz - uTextCenter;
      float textAwayLen = length(textAway);
      vec2 textPushDir = textAwayLen > 0.0001 ? textAway / textAwayLen : vec2(1.0, 0.0);

      float textBend = textMask * uTextStrength * pos.y;
      pos.x += textPushDir.x * textBend;
      pos.z += textPushDir.y * textBend;
      pos.y -= textBend * 0.55;
    }

    // Sway is damped where the grass is flattened (by the mouse or the text)
    float swayDamp = 1.0 - clamp(max(totalPush, textMask), 0.0, 1.0);
    float sway = sin(uTime * 1.4 + instanceWorldPos.x * 1.3 + instanceWorldPos.z * 1.3 + vVariation * 6.28) * 0.035 * pos.y * swayDamp;
    pos.x += sway;

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  varying float vHeight;
  varying float vVariation;

  void main() {
    vec3 baseColor = mix(vec3(0.035, 0.16, 0.045), vec3(0.34, 0.62, 0.22), vHeight);
    baseColor *= 0.82 + vVariation * 0.36;
    gl_FragColor = vec4(baseColor, 1.0);
  }
`;

export default function GrassPrototype() {
  const mountRef = useRef(null);
  const loadingRef = useRef(null);
  const loadingFillRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    const loadingEl = loadingRef.current;
    const loadingFillEl = loadingFillRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SCENE_BG_COLOR);
    scene.fog = new THREE.Fog(SCENE_BG_COLOR, 9, 19);

    const camera = new THREE.PerspectiveCamera(
      IS_TOUCH ? MOBILE_CAMERA_FOV : 40,
      mount.clientWidth / mount.clientHeight,
      1,
      100
    );
    const basePosition = IS_TOUCH
      ? new THREE.Vector3(
          MOBILE_CAMERA_POSITION.x,
          MOBILE_CAMERA_POSITION.y,
          MOBILE_CAMERA_POSITION.z
        )
      : new THREE.Vector3(2, 7, 5);
    const baseLookAt = IS_TOUCH
      ? new THREE.Vector3(
          MOBILE_CAMERA_LOOK_AT.x,
          MOBILE_CAMERA_LOOK_AT.y,
          MOBILE_CAMERA_LOOK_AT.z
        )
      : new THREE.Vector3(0, -2, -1.5);
    camera.position.copy(basePosition);
    camera.lookAt(baseLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if (ENABLE_CURSOR_SHADOW) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // soft edges; switch to
      // THREE.BasicShadowMap for a small extra performance margin at the
      // cost of harder, more pixelated shadow edges
    }
    mount.appendChild(renderer.domElement);

    // ---- Loading screen progress tracking ----
    // Shared across every loader below (skybox, font incl. its fallback,
    // hand cursor, window model, speech bubble image) so the overlay's fill
    // reflects real fetch/decode progress instead of a fake timer. Tracked
    // as a plain closure variable rather than React state since it's driven
    // from inside the three.js loop, not from a render.
    //
    // itemsTotal can grow mid-load (e.g. the font's fallback only starts
    // after the primary 404s), which would otherwise make the percentage
    // jump backward — clamping to the running max keeps the fill
    // monotonically increasing.
    let maxLoadPct = 0;
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      if (!loadingFillEl) return;
      const pct = itemsTotal > 0 ? (itemsLoaded / itemsTotal) * 100 : 100;
      maxLoadPct = Math.max(maxLoadPct, pct);
      loadingFillEl.style.clipPath = `inset(0 ${100 - maxLoadPct}% 0 0)`;
    };
    loadingManager.onLoad = () => {
      if (loadingFillEl) loadingFillEl.style.clipPath = "inset(0 0% 0 0)";
      if (loadingEl) {
        loadingEl.style.opacity = "0";
        loadingEl.style.visibility = "hidden";
      }
    };

    // ---- Post-processing (bloom + depth of field) ----
    // Only built at all if at least one effect is switched on above.
    let composer = null;
    let bloomPass = null;
    let bokehPass = null;
    if (ENABLE_BLOOM || ENABLE_DOF) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));

      if (ENABLE_BLOOM) {
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(mount.clientWidth, mount.clientHeight),
          BLOOM_STRENGTH,
          BLOOM_RADIUS,
          BLOOM_THRESHOLD
        );
        composer.addPass(bloomPass);
      }

      if (ENABLE_DOF) {
        bokehPass = new BokehPass(scene, camera, {
          focus: DOF_FOCUS_DISTANCE,
          aperture: DOF_APERTURE,
          maxblur: DOF_MAX_BLUR,
          width: mount.clientWidth,
          height: mount.clientHeight,
        });
        composer.addPass(bokehPass);
      }
    }

    // ---- Lighting: natural sunny day ----
    const hemiLight = new THREE.HemisphereLight(0xbfe0ff, 0x2e4a1a, 0.0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff2d8, 0.5);
    sunLight.position.set(8, 14, 6);
    scene.add(sunLight);
    scene.add(sunLight.target);

    if (ENABLE_CURSOR_SHADOW) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
      sunLight.shadow.bias = SHADOW_BIAS;
      const s = SHADOW_AREA_HALF_SIZE;
      sunLight.shadow.camera.left = -s;
      sunLight.shadow.camera.right = s;
      sunLight.shadow.camera.top = s;
      sunLight.shadow.camera.bottom = -s;
      sunLight.shadow.camera.near = 1;
      sunLight.shadow.camera.far = 30;
      sunLight.shadow.camera.updateProjectionMatrix();
    }

    const fillLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(fillLight);

    // ---- Metallic material used by the 3D text (declared early so the
    // skybox loader below can assign its envMap once the image arrives) ----
    let letterMeshes = []; // [{ mesh, worldCenterX }] — one rigid mesh per letter
    let textOuterGroup = null;
    let letterPressDepth = 0.4; // filled in once the geometry's real height is known
    const textMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: TEXT_METALNESS,
      roughness: TEXT_ROUGHNESS,
      envMapIntensity: TEXT_ENV_MAP_INTENSITY,
    });

    // ---- Sky environment map (for the metallic text reflections) ----
    // We run the equirectangular skybox.png through a PMREMGenerator before
    // using it as an envMap. Without this step, three.js has no properly
    // pre-filtered mip chain to sample for glossy (non-mirror) reflections,
    // so low-roughness metal ends up reading as a flat, washed-out blob
    // instead of showing distinct clouds. This is the fix for "the sky
    // isn't reflecting properly" — the rest is just roughness (see
    // TEXT_ROUGHNESS above).
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    let envRenderTarget = null;

    const textureLoader = new THREE.TextureLoader(loadingManager);
    textureLoader.load(
      SKYBOX_URL,
      (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.encoding = THREE.sRGBEncoding;
        // Rotate which part of the panorama faces the camera in reflections.
        tex.offset.x = SKY_ROTATION;
        tex.wrapS = THREE.RepeatWrapping;

        envRenderTarget = pmremGenerator.fromEquirectangular(tex);
        const envMap = envRenderTarget.texture;

        scene.environment = envMap;
        if (textMaterial) {
          textMaterial.envMap = envMap;
          textMaterial.needsUpdate = true;
        }

        tex.dispose();
        pmremGenerator.dispose();
      },
      undefined,
      (err) => {
        console.warn("Could not load skybox.png for reflections:", err);
      }
    );

    // ground — MeshLambertMaterial instead of MeshBasicMaterial so it can
    // actually receive the cursor's shadow (Basic ignores lighting/shadows
    // entirely by design). Lambert is the cheapest material that still
    // supports shadows — no specular highlight calculations to pay for,
    // which doesn't matter anyway since the grass hides almost all of it.
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x1c3312 });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(PATCH_RADIUS + 1, 48), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    ground.receiveShadow = ENABLE_CURSOR_SHADOW;
    scene.add(ground);

    // grass
    const bladeGeo = createBladeGeometry();
    const trailPositions = Array.from(
      { length: MAX_TRAIL },
      () => new THREE.Vector2(9999, 9999)
    );
    const trailTimes = new Array(MAX_TRAIL).fill(-1000);
    // How hard each trail point was pressing when it was recorded. Stored
    // per-point (rather than applied globally) so releasing the button lets
    // each point rise back on its own uRiseDuration timer — see uTrailStrength
    // in the vertex shader.
    const trailStrengths = new Array(MAX_TRAIL).fill(0);

    const textLines = IS_TOUCH ? TEXT_LINES_MOBILE : [TEXT_STRING];

    const { texture: textMaskTexture, letterAspect, widthRatio, heightRatio } =
      createTextMaskTexture(textLines, TEXT_PRESS_SPREAD);
    const textWorldHeight = TEXT_WORLD_WIDTH / letterAspect; // height of the letters alone
    const totalWorldWidth = TEXT_WORLD_WIDTH * widthRatio; // letters + spread halo
    const totalWorldHeight = textWorldHeight * heightRatio;
    const textCenter = new THREE.Vector2(0, 0.3); // where the text patch sits on the grass
    const textMin = new THREE.Vector2(
      textCenter.x - totalWorldWidth / 2,
      textCenter.y - totalWorldHeight / 2
    );
    const textSize = new THREE.Vector2(totalWorldWidth, totalWorldHeight);

    const uniforms = {
      uTime: { value: 0 },
      uRadius: { value: MOUSE_PUSH_RADIUS },
      uStrength: { value: 1.3 },
      uRiseDuration: { value: 1.0 },
      uTrailPos: { value: trailPositions },
      uTrailTime: { value: trailTimes },
      uTrailStrength: { value: trailStrengths },
      uTextMask: { value: textMaskTexture },
      uTextMin: { value: textMin },
      uTextSize: { value: textSize },
      uTextCenter: { value: textCenter },
      uTextStrength: { value: 1.5 },
      uHasTextMask: { value: 1.0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.DoubleSide,
    });

    const grassMesh = new THREE.InstancedMesh(bladeGeo, material, BLADE_COUNT);
    const dummy = new THREE.Object3D();
    const variations = new Float32Array(BLADE_COUNT);

    for (let i = 0; i < BLADE_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * PATCH_RADIUS;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const height = 0.55 + Math.random() * 0.55;

      dummy.position.set(x, 0, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      grassMesh.setMatrixAt(i, dummy.matrix);
      variations[i] = Math.random();
    }
    bladeGeo.setAttribute(
      "aVariation",
      new THREE.InstancedBufferAttribute(variations, 1)
    );
    scene.add(grassMesh);

    // ---- Metallic 3D text, built as one rigid mesh per letter ----
    // We use font.generateShapes() directly (TextGeometry does this
    // internally too) so each glyph's shape already has its correct
    // horizontal position baked into its points, then build a separate
    // ExtrudeGeometry per glyph. That lets us push a whole letter down as a
    // single rigid translation later, instead of deforming individual
    // vertices with a shader.
    //
    // Each line in `textLines` is generated on its own (generateShapes only
    // lays a string out horizontally) and then offset vertically, so the
    // mobile two-line layout stacks correctly. Every glyph across every
    // line ends up as its own rigid mesh in the same flat list, so the
    // letter-press interaction doesn't care how many lines there are.
    function buildTextMesh(font) {
      const extrudeSettings = {
        depth: 1,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.015,
        bevelOffset: 0,
        bevelSegments: 3,
      };

      // Measure each line's raw bounding box first, so we can center each
      // line horizontally and stack them with a consistent gap.
      const perLine = textLines.map((line) => {
        const shapes = font.generateShapes(line, 1);
        const geometries = shapes.map(
          (shape) => new THREE.ExtrudeGeometry(shape, extrudeSettings)
        );
        const box = new THREE.Box3();
        geometries.forEach((g) => {
          g.computeBoundingBox();
          box.union(g.boundingBox);
        });
        return {
          geometries,
          width: box.max.x - box.min.x,
          height: box.max.y - box.min.y,
          minX: box.min.x,
          minY: box.min.y,
          maxY: box.max.y,
        };
      });
      if (perLine.length === 0 || perLine[0].geometries.length === 0) return;

      // Uniform line height + gap based on the tallest line, so spacing is
      // even regardless of ascenders/descenders in each specific line.
      const lineHeight = Math.max(...perLine.map((l) => l.height));
      const lineGap = lineHeight * TEXT_LINE_GAP_RATIO;
      const totalBlockHeight =
        lineHeight * perLine.length + lineGap * (perLine.length - 1);

      // Position each line: first line at the top of the block, going down.
      // Lines are LEFT-aligned — each line's left edge is anchored to x=0 —
      // rather than centered on each other. The whole block still gets
      // recentered as one below, so it stays centered on the grass overall;
      // only the lines' alignment relative to each other is left-flush.
      const positionedGeometries = [];
      let cursorY = totalBlockHeight / 2; // top edge of the block
      perLine.forEach((line) => {
        const lineCenterY = line.minY + line.height / 2;
        // Target center Y for this line within the block.
        const targetCenterY = cursorY - lineHeight / 2;
        line.geometries.forEach((g) => {
          g.translate(-line.minX, targetCenterY - lineCenterY, 0);
          positionedGeometries.push(g);
        });
        cursorY -= lineHeight + lineGap;
      });

      // Combined bounding box across every letter of every line, used for
      // centering the whole block and scaling it to TEXT_WORLD_WIDTH.
      const combined = new THREE.Box3();
      positionedGeometries.forEach((geo) => {
        geo.computeBoundingBox();
        combined.union(geo.boundingBox);
      });

      const rawWidth = combined.max.x - combined.min.x;
      const rawHeight = combined.max.y - combined.min.y;
      const centerX = (combined.min.x + combined.max.x) / 2;
      const centerY = (combined.min.y + combined.max.y) / 2;
      const scale = rawWidth > 0 ? TEXT_WORLD_WIDTH / rawWidth : 1;
      // Press depth is per single line's height, not the whole stacked
      // block, so a pressed letter sinks by the same visual amount on
      // mobile as on desktop.
      letterPressDepth = lineHeight * LETTER_PRESS_DEPTH_RATIO;

      textOuterGroup = new THREE.Group();
      textOuterGroup.scale.setScalar(scale);
      // Lay the text flat on the grass, extrusion pointing up (+Y)
      textOuterGroup.rotation.x = -Math.PI / 2;
      textOuterGroup.position.set(textCenter.x, 0.05, textCenter.y);

      // Recenters the whole block (letter shapes are baked at their raw,
      // uncentered position) without touching each letter's own local
      // origin — so pushing a letter via mesh.position.z later stays a
      // clean rigid move.
      const textInnerGroup = new THREE.Group();
      textInnerGroup.position.set(-centerX, -centerY, 0);
      textOuterGroup.add(textInnerGroup);

      letterMeshes = positionedGeometries.map((geo) => {
        const mesh = new THREE.Mesh(geo, textMaterial);
        mesh.receiveShadow = ENABLE_CURSOR_SHADOW;
        textInnerGroup.add(mesh);
        return { mesh, worldCenterX: 0, worldCenterZ: 0 };
      });

      scene.add(textOuterGroup);
      textOuterGroup.updateMatrixWorld(true);

      // Precompute each letter's world-space center once, since the group
      // transforms are static — this is what press-distance falloff gets
      // measured against every frame.
      const tmp = new THREE.Vector3();
      letterMeshes.forEach(({ mesh }, i) => {
        const geo = positionedGeometries[i];
        const localCenterX = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
        const localCenterY = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
        tmp.set(localCenterX, localCenterY, 0);
        mesh.localToWorld(tmp);
        letterMeshes[i].worldCenterX = tmp.x;
        letterMeshes[i].worldCenterZ = tmp.z;
      });
    }

    const fontLoader = new FontLoader(loadingManager);
    fontLoader.load(
      LOCAL_FONT_URL,
      (font) => buildTextMesh(font),
      undefined,
      () => {
        console.warn(
          `Could not find local font at "${LOCAL_FONT_URL}". ` +
            `Falling back to a bundled three.js font for now — generate ` +
            `an Arial Bold Italic typeface.json (see comment at top of ` +
            `this file) for the real look.`
        );
        fontLoader.load(FALLBACK_FONT_URL, (font) => buildTextMesh(font));
      }
    );

    // ---- Hand cursor model (follows the mouse, stays flat on the grass) ----
    let cursorModel = null;
    const cursorGltfLoader = new GLTFLoader(loadingManager);
    cursorGltfLoader.load(
      CURSOR_MODEL_URL,
      (gltf) => {
        cursorModel = gltf.scene;
        cursorModel.scale.setScalar(CURSOR_SCALE);
        cursorModel.visible = false; // hidden until the mouse is over the grass
        cursorModel.traverse((child) => {
          if (!child.isMesh) return;
          if (ENABLE_CURSOR_SHADOW) child.castShadow = true;

          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat) => {
            if (!mat) return;
            // Cuts down how much of the bright sky env map the model
            // reflects, and darkens its own base color a touch — both
            // independent of the scene's lights and the bloom pass.
            if ("envMapIntensity" in mat) {
              mat.envMapIntensity = CURSOR_ENV_MAP_INTENSITY;
            }
            if (mat.color) {
              mat.color.multiplyScalar(CURSOR_COLOR_MULTIPLIER);
            }
            mat.needsUpdate = true;
          });
        });
        scene.add(cursorModel);
      },
      undefined,
      (err) => {
        console.warn(`Could not load ${CURSOR_MODEL_URL}:`, err);
      }
    );

    // ---- "Touched grass today" speech bubble plane ----
    // A flat, camera-independent image plane that lies on the grass and
    // trails the cursor. Created hidden; revealed the first time the user
    // clicks the grass (bubbleActivated below).
    const bubbleHeight = BUBBLE_WIDTH / BUBBLE_IMAGE_ASPECT;
    const bubbleTexture = new THREE.TextureLoader(loadingManager).load(BUBBLE_IMAGE_URL);
    bubbleTexture.encoding = THREE.sRGBEncoding;
    const bubbleMaterial = new THREE.MeshBasicMaterial({
      map: bubbleTexture,
      transparent: true, // honor the PNG's alpha so only the bubble shows, not a square
      depthWrite: false, // don't let the transparent quad occlude grass/windows behind it
      toneMapped: false, // keep the bubble's colors flat/graphic rather than lit by the scene
    });
    const bubbleMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(BUBBLE_WIDTH, bubbleHeight),
      bubbleMaterial
    );
    // Lie flat on the grass (plane defaults to facing +Z / upright), then
    // spin around the vertical axis for a jaunty angle.
    bubbleMesh.rotation.x = -Math.PI / 2;
    bubbleMesh.rotation.z = THREE.MathUtils.degToRad(BUBBLE_ROTATION_DEG);
    bubbleMesh.renderOrder = 999; // draw after the scene so alpha blends over it cleanly
    bubbleMesh.visible = false;
    scene.add(bubbleMesh);

    let bubbleActivated = false; // flips true on the first grass click
    const bubbleTarget = new THREE.Vector3();

    // mouse -> ground plane raycast, recorded into a decaying trail
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2(9999, 9999);
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    let hasPointer = false;
    let cleanupPointer = () => {};

    let trailIndex = 0;
    const lastAddedPos = new THREE.Vector2(99999, 99999);
    let lastAddedTime = -1000;
    const MIN_TRAIL_DIST = 0.12;
    const MIN_TRAIL_INTERVAL = 0.03;

    // On touch there's no hover: the cursor should stay put after release
    // (not vanish), so once the first touch lands we keep hasPointer true
    // for the rest of the session. isPressed still tracks whether a finger
    // is currently down, which is what actually drives grass/letter push.

    function setPointerFromEvent(e) {
      const rect = mount.getBoundingClientRect();
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    }

    let isPressed = false;

    if (IS_TOUCH) {
      // ---- Touch model ----
      // A touch simultaneously places the cursor AND presses. Moving the
      // finger drags both. Lifting stops the press but leaves the cursor
      // where it was (it lifts up via pressAmount, handled in the loop).
      function onTouchStart(e) {
        setPointerFromEvent(e);
        hasPointer = true;
        isPressed = true;
      }
      function onTouchMove(e) {
        setPointerFromEvent(e);
        if (isPressed) hasPointer = true;
      }
      function onTouchEnd() {
        isPressed = false;
        // hasPointer stays true so the lifted hand remains visible in place
      }
      mount.addEventListener("pointerdown", onTouchStart);
      mount.addEventListener("pointermove", onTouchMove);
      window.addEventListener("pointerup", onTouchEnd);
      window.addEventListener("pointercancel", onTouchEnd);

      // expose for cleanup
      cleanupPointer = () => {
        mount.removeEventListener("pointerdown", onTouchStart);
        mount.removeEventListener("pointermove", onTouchMove);
        window.removeEventListener("pointerup", onTouchEnd);
        window.removeEventListener("pointercancel", onTouchEnd);
      };
    } else {
      // ---- Desktop mouse model (unchanged) ----
      // Hover moves the cursor; the left button drives the grass/letter push.
      function onPointerMove(e) {
        setPointerFromEvent(e);
        hasPointer = true;
      }
      function onPointerLeave() {
        hasPointer = false;
        isPressed = false;
      }
      function onPointerDown(e) {
        if (e.button !== 0) return; // left button only
        isPressed = true;
      }
      function onPointerUp(e) {
        if (e.button !== 0) return;
        isPressed = false;
      }
      function onWindowBlur() {
        isPressed = false;
      }
      mount.addEventListener("pointermove", onPointerMove);
      mount.addEventListener("pointerleave", onPointerLeave);
      mount.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("blur", onWindowBlur);

      cleanupPointer = () => {
        mount.removeEventListener("pointermove", onPointerMove);
        mount.removeEventListener("pointerleave", onPointerLeave);
        mount.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("blur", onWindowBlur);
      };
    }

    // ---- Computer window spawner: click anywhere on the grass to launch one ----
    let windowModelTemplate = null;
    const flyingWindows = []; // [{ object, velocity, spinAxis, spinSpeed, groundY }]
    const windowGltfLoader = new GLTFLoader(loadingManager);
    windowGltfLoader.load(
      WINDOW_MODEL_URL,
      (gltf) => {
        windowModelTemplate = gltf.scene;
      },
      undefined,
      (err) => {
        console.warn(`Could not load ${WINDOW_MODEL_URL}:`, err);
      }
    );

    // Shared by both the in-flight despawn (once it's fallen far enough)
    // and the unmount cleanup below, so geometry/material disposal only
    // needs to be written once.
    function disposeWindowObject(object) {
      object.traverse((child) => {
        if (!child.isMesh) return;
        child.geometry.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((m) => m?.dispose());
      });
    }

    // Loaded once and reused across every spawn — textures update in place
    // once their image data arrives, so it's fine to reference them before
    // they've actually finished loading.
    //
    // Rather than fighting texture.flipY / texture.repeat (both are valid
    // ways to mirror a texture in WebGL, but they interact with the mesh's
    // own UV convention in ways that get confusing to reason about blind):
    // each image is drawn onto our own canvas with an explicit transform we
    // fully control, based on the two flip booleans above, then handed to
    // three.js as-is with flipY locked to false. What's drawn on the
    // canvas is exactly what ends up on screen — no hidden second flip.
    function loadMirroredTexture(url) {
      const canvas = document.createElement("canvas");
      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      texture.flipY = false;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        const scaleX = WINDOW_IMAGE_FLIP_HORIZONTAL ? -1 : 1;
        const scaleY = WINDOW_IMAGE_FLIP_VERTICAL ? -1 : 1;
        ctx.translate(
          WINDOW_IMAGE_FLIP_HORIZONTAL ? canvas.width : 0,
          WINDOW_IMAGE_FLIP_VERTICAL ? canvas.height : 0
        );
        ctx.scale(scaleX, scaleY);
        ctx.drawImage(img, 0, 0);
        texture.needsUpdate = true;
      };
      img.onerror = () => console.warn(`Could not load ${url}`);
      img.src = url;

      return texture;
    }
    const windowImageTextures = WINDOW_IMAGE_URLS.map(loadMirroredTexture);

    // clone() only duplicates the object hierarchy — geometry and materials
    // stay shared by reference. That's normally what we want (cheap spawns),
    // but it means naively swapping .map on a shared material would change
    // every spawned window's screen at once. So for just the interior
    // node, we clone its material too, giving each spawn its own texture.
    function randomizeWindowInterior(root) {
      if (windowImageTextures.length === 0) return;
      const interior = root.getObjectByName(WINDOW_INTERIOR_NODE_NAME);
      if (!interior) return;

      const texture =
        windowImageTextures[
          Math.floor(Math.random() * windowImageTextures.length)
        ];

      interior.traverse((child) => {
        if (!child.isMesh) return;
        const applyTexture = (mat) => {
          const cloned = mat.clone();
          cloned.map = texture;
          cloned.needsUpdate = true;
          return cloned;
        };
        child.material = Array.isArray(child.material)
          ? child.material.map(applyTexture)
          : applyTexture(child.material);
      });
    }

    // Called from the animate loop's spawn timer (below) with the current
    // ground raycast hit — no longer tied to a click event, since spawning
    // is now continuous while held + hovering rather than one-per-click.
    function spawnWindowAt(hit) {
      if (!windowModelTemplate) return; // not loaded yet — skip this cycle

      // clone() shares geometry/materials by reference across all spawned
      // copies rather than duplicating them — cheap to spawn many.
      const spawned = windowModelTemplate.clone();
      spawned.scale.setScalar(WINDOW_SIZE);

      // Standing orientation (the model's own authored pose, corrected to
      // upright) plus a random initial facing — the continuous tumble
      // during flight is handled separately, per frame, below.
      spawned.rotation.set(0, Math.random() * Math.PI * 2, 0);
      spawned.rotateX(WINDOW_UPRIGHT_ROTATION_X);

      const groundY = hit.y;
      spawned.position.set(hit.x, groundY - WINDOW_SPAWN_DEPTH, hit.z);
      randomizeWindowInterior(spawned);
      scene.add(spawned);

      // Projectile motion: launch mostly upward with a little randomized
      // sideways drift, then let gravity (applied per frame below) do the
      // rest of the arc.
      const driftAngle = Math.random() * Math.PI * 2;
      const driftSpeed = Math.random() * WINDOW_HORIZONTAL_DRIFT_SPEED;
      const velocity = new THREE.Vector3(
        Math.cos(driftAngle) * driftSpeed,
        THREE.MathUtils.lerp(WINDOW_JUMP_SPEED_MIN, WINDOW_JUMP_SPEED_MAX, Math.random()),
        Math.sin(driftAngle) * driftSpeed
      );

      // A random axis (in world space) it continuously tumbles around
      // while airborne, at a random speed and direction.
      const spinAxis = new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1
      ).normalize();
      const spinSpeed =
        THREE.MathUtils.lerp(WINDOW_SPIN_SPEED_MIN, WINDOW_SPIN_SPEED_MAX, Math.random()) *
        (Math.random() < 0.5 ? -1 : 1);

      flyingWindows.push({ object: spawned, velocity, spinAxis, spinSpeed, groundY });
    }
    let windowSpawnTimer = 0; // seconds accumulated while held + hovering; resets on release

    // resize
    function onResize() {
      const w = mount.clientWidth,
        h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (composer) composer.setSize(w, h);
      if (bloomPass) bloomPass.resolution.set(w, h);
    }
    window.addEventListener("resize", onResize);

    // ---- Smooth, lerped camera parallax following the mouse ----
    const cameraTarget = new THREE.Vector3().copy(basePosition);
    const lookAtTarget = new THREE.Vector3().copy(baseLookAt);
    const currentLookAt = new THREE.Vector3().copy(baseLookAt);
    const PARALLAX_X = 1.1;
    const PARALLAX_Y = 0.5;
    const CAMERA_LERP = 0.045;

    // ---- Cursor model follow target ----
    const cursorTarget = new THREE.Vector3();
    let cursorHasTarget = false;
    let pressAmount = 0; // smoothed 0→1, follows isPressed
    let letterPressAmount = 0; // smoothed 0→1, follows isPressed (while over the ground)
    let letterPressWorldX = 0;
    let letterPressWorldZ = 0;

    function smoothstepJS(edge0, edge1, x) {
      const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
      return t * t * (3 - 2 * t);
    }

    const clock = new THREE.Clock();
    let rafId;
    function animate() {
      rafId = requestAnimationFrame(animate);
      // clock.getElapsedTime() calls getDelta() internally, so calling
      // getDelta() again afterward would just return ~0 — grab delta once
      // here and read the already-updated elapsedTime property instead.
      const dt = Math.min(clock.getDelta(), 0.1); // clamp so a dropped/backgrounded frame can't launch a window through the floor in one jump
      uniforms.uTime.value = clock.elapsedTime;

      // ---- Flying windows: simple projectile motion + continuous tumble ----
      for (let i = flyingWindows.length - 1; i >= 0; i--) {
        const fw = flyingWindows[i];
        fw.velocity.y -= WINDOW_GRAVITY * dt;
        fw.object.position.addScaledVector(fw.velocity, dt);
        fw.object.rotateOnWorldAxis(fw.spinAxis, fw.spinSpeed * dt);

        if (fw.object.position.y < fw.groundY - WINDOW_DESPAWN_DEPTH) {
          scene.remove(fw.object);
          disposeWindowObject(fw.object);
          flyingWindows.splice(i, 1);
        }
      }

      // Smoothly track the press state (0 = released, 1 = fully pressed).
      // Still drives the hand cursor's own drop/tilt, and is baked into each
      // new trail point below so the press-in ramp is preserved per-point.
      pressAmount += ((isPressed ? 1 : 0) - pressAmount) * CURSOR_PRESS_LERP;

      // Whether the letters should be reacting at all this frame — set for
      // real below, once we know where (if anywhere) the mouse hits the
      // ground. Kept outside the hasPointer block so it correctly falls
      // back to 0 (rise back up) whenever we don't have a fresh hit.
      let letterPressTarget = 0;

      if (hasPointer) {
        raycaster.setFromCamera(pointerNDC, camera);
        if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
          if (isPressed) {
            // Reused for the letter press too: a smooth, continuous ground
            // position rather than a raycast against the actual letter
            // meshes, which flickered at glyph edges/gaps as the cursor
            // moved. Distance-based falloff below is what determines how
            // much (if at all) a given letter reacts — the letters don't
            // need to be hit exactly, just close enough.
            letterPressWorldX = intersection.x;
            letterPressWorldZ = intersection.z;
            letterPressTarget = 1;

            const t = uniforms.uTime.value;
            const movedEnough =
              lastAddedPos.distanceTo({ x: intersection.x, y: intersection.z }) >
              MIN_TRAIL_DIST;
            const timeElapsed = t - lastAddedTime > MIN_TRAIL_INTERVAL;

            if (movedEnough || timeElapsed) {
              trailPositions[trailIndex].set(intersection.x, intersection.z);
              trailTimes[trailIndex] = t;
              // Bake the current (ramping) press amount into this point, so a
              // fresh press still eases in, but releasing later never scales
              // this point down — it rises back purely on its own timer.
              trailStrengths[trailIndex] = pressAmount;
              trailIndex = (trailIndex + 1) % MAX_TRAIL;
              lastAddedPos.set(intersection.x, intersection.z);
              lastAddedTime = t;
            }

            // Held down + cursor over the grass: spawn a window roughly
            // every WINDOW_SPAWN_INTERVAL seconds, at wherever the cursor
            // currently is (not fixed to where the hold started).
            windowSpawnTimer += dt;
            if (windowSpawnTimer >= WINDOW_SPAWN_INTERVAL) {
              windowSpawnTimer -= WINDOW_SPAWN_INTERVAL; // keep remainder for a steady cadence rather than resetting to 0
              spawnWindowAt(intersection);
            }

            // First time the grass is clicked: reveal the speech bubble.
            // It sticks around and trails the cursor from here on.
            if (!bubbleActivated) {
              bubbleActivated = true;
              bubbleMesh.visible = true;
              // Snap it to its starting spot so it doesn't fly in from the
              // origin on the very first frame.
              bubbleMesh.position.set(
                intersection.x + BUBBLE_OFFSET_X,
                intersection.y + BUBBLE_Y_OFFSET,
                intersection.z + BUBBLE_OFFSET_Z
              );
            }
          } else {
            windowSpawnTimer = 0;
          }

          const cursorYOffset = THREE.MathUtils.lerp(
            CURSOR_Y_OFFSET,
            CURSOR_Y_OFFSET * CURSOR_PRESS_Y_RATIO,
            pressAmount
          );
          cursorTarget.set(
            intersection.x,
            intersection.y + cursorYOffset,
            intersection.z
          );
          cursorHasTarget = true;
        }

        // On touch there's no hovering pointer driving a subtle parallax —
        // the pointer only exists at discrete tap positions, so feeding it
        // into the camera would make the view lurch to each tap. Keep the
        // camera static (at its base framing) on touch; only desktop gets
        // the mouse-follow parallax.
        if (IS_TOUCH) {
          cameraTarget.copy(basePosition);
          lookAtTarget.copy(baseLookAt);
        } else {
          cameraTarget.set(
            basePosition.x + pointerNDC.x * PARALLAX_X,
            basePosition.y - pointerNDC.y * PARALLAX_Y * 0.5,
            basePosition.z
          );
          lookAtTarget.set(
            baseLookAt.x + pointerNDC.x * PARALLAX_X * 0.6,
            baseLookAt.y + pointerNDC.y * PARALLAX_Y * 0.3,
            baseLookAt.z
          );
        }
      } else {
        cameraTarget.copy(basePosition);
        lookAtTarget.copy(baseLookAt);
        windowSpawnTimer = 0;
      }

      camera.position.lerp(cameraTarget, CAMERA_LERP);
      currentLookAt.lerp(lookAtTarget, CAMERA_LERP);
      camera.lookAt(currentLookAt);

      // Same easing speed as the hand cursor's own press/release, per spec.
      letterPressAmount +=
        (letterPressTarget - letterPressAmount) * CURSOR_PRESS_LERP;

      // Push each letter straight down as a rigid whole — no per-vertex
      // deformation — based on how close its own center is to the last
      // pressed ground position, in world space (X and Z both, so it's a
      // true "closer to the mouse" gradient rather than left/right only).
      letterMeshes.forEach(({ mesh, worldCenterX, worldCenterZ }) => {
        const dx = worldCenterX - letterPressWorldX;
        const dz = worldCenterZ - letterPressWorldZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const falloff = 1 - smoothstepJS(0, LETTER_PRESS_SPREAD, dist);
        mesh.position.z = -falloff * letterPressAmount * letterPressDepth;
      });

      if (cursorModel) {
        cursorModel.visible = hasPointer && cursorHasTarget;
        if (cursorModel.visible) {
          cursorModel.position.lerp(cursorTarget, CURSOR_LERP);
          const wiggleAmplitudeRad = THREE.MathUtils.degToRad(
            CURSOR_WIGGLE_AMPLITUDE_DEG
          );
          const wiggle =
            Math.sin(uniforms.uTime.value * CURSOR_WIGGLE_SPEED) *
            wiggleAmplitudeRad;
          const pressTilt =
            THREE.MathUtils.degToRad(CURSOR_PRESS_TILT_DEG) * pressAmount;
          cursorModel.rotation.x = wiggle + pressTilt;
        }
      }

      // Speech bubble trails the cursor once it's been activated. It tracks
      // cursorTarget (where the hand is heading) rather than the hand's own
      // lerped position, so the two don't compound into extra lag — plus a
      // fixed sideways offset so it sits beside the hand, not on it.
      if (bubbleActivated && cursorHasTarget) {
        bubbleTarget.set(
          cursorTarget.x + BUBBLE_OFFSET_X,
          cursorTarget.y + BUBBLE_Y_OFFSET,
          cursorTarget.z + BUBBLE_OFFSET_Z
        );
        bubbleMesh.position.lerp(bubbleTarget, BUBBLE_LERP);
      }

      if (composer) {
        composer.render();
      } else {
        renderer.render(scene, camera);
      }
    }
    animate();

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      cleanupPointer();
      flyingWindows.forEach((fw) => {
        scene.remove(fw.object);
        disposeWindowObject(fw.object);
      });
      windowImageTextures.forEach((tex) => tex.dispose());
      bladeGeo.dispose();
      material.dispose();
      groundMat.dispose();
      textMaskTexture.dispose();
      textMaterial.dispose();
      bubbleMesh.geometry.dispose();
      bubbleMaterial.dispose();
      bubbleTexture.dispose();
      if (envRenderTarget) envRenderTarget.dispose();
      bloomPass?.dispose?.();
      bokehPass?.dispose?.();
      composer?.renderTarget1?.dispose();
      composer?.renderTarget2?.dispose();
      letterMeshes.forEach(({ mesh }) => mesh.geometry.dispose());
      if (cursorModel) {
        cursorModel.traverse((child) => {
          if (child.isMesh) {
            child.geometry.dispose();
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else if (child.material) {
              child.material.dispose();
            }
          }
        });
      }
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div
        ref={mountRef}
        style={{ width: "100%", height: "100%", touchAction: "none" }}
      />
      <div
        ref={loadingRef}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "0 6vw",
          backgroundColor: LOADING_BG_COLOR,
          opacity: 1,
          visibility: "visible",
          transition: "opacity 0.6s ease, visibility 0.6s ease",
        }}
      >
        <div
          style={{
            position: "relative",
            fontFamily: "Arial, Helvetica, sans-serif",
            fontWeight: 700,
            fontStyle: "italic",
            fontSize: "clamp(1.1rem, 6vw, 3.2rem)",
            letterSpacing: "0.02em",
            whiteSpace: "nowrap",
          }}
        >
          <span style={{ color: LOADING_TEXT_BASE_COLOR }}>{LOADING_TEXT}</span>
          <span
            ref={loadingFillRef}
            style={{
              position: "absolute",
              inset: 0,
              color: LOADING_TEXT_FILL_COLOR,
              clipPath: "inset(0 100% 0 0)",
            }}
          >
            {LOADING_TEXT}
          </span>
        </div>
      </div>
    </div>
  );
}