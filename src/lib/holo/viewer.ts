import { VERT, FRAG } from './shaders';

export type Material = 'holo' | 'matte' | 'decal';
export type DieCut = 'circle' | 'none' | 'contour';

export interface HoloOptions {
  src: string;
  material: Material;
  dieCut: DieCut;
  intensity: number;
  hueScale: number;
  tileScale: number;
  grain: number;
  /** Off for headless product shots: no listeners, no idle, no spring. */
  interactive?: boolean;
  /** Force a fixed backing store instead of measuring the element. */
  pixelSize?: number;
  /** How much of the frame the sticker fills. Shots use less, to leave room
   *  for the contact shadow. */
  fit?: number;
  /** Decal only: the drop shadow finish. */
  dropShadow?: boolean;
}

// Decal geometry, matching the print setup in render_decal.py. Everything is
// derived from the logo, so a new decal needs no per product numbers.
const MARGIN_RATIO = 0.17;  // print margin, as a fraction of logo height
const RADIUS_RATIO = 0.34;  // corner radius, as a fraction of frame height
const SHADOW_RATIO = 0.055; // drop shadow offset, as a fraction of logo height

/**
 * Crop an image to the bounds of its own ink, so the print margin is measured
 * from the artwork rather than from whatever padding the file happens to have.
 */
function cropToInk(img: HTMLImageElement): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, c.width, c.height).data;
  } catch {
    return null; // tainted canvas, fall back to the uncropped image
  }

  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;

  const out = document.createElement('canvas');
  out.width = maxX - minX + 1;
  out.height = maxY - minY + 1;
  out.getContext('2d')!.drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

/**
 * Grow a white contour cut around the artwork, the way a printer cuts a sticker
 * a few millimetres outside the design. Done once when the texture loads rather
 * than per pixel per frame, which keeps it smooth and free at render time.
 */
function addContourCut(img: HTMLImageElement, widthFraction: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;

  // Dilate the silhouette by stamping the artwork around a ring. Two radii, so
  // the fill stays solid on thin shapes like fins and tails.
  const r = Math.max(1, Math.round(Math.min(w, h) * widthFraction));
  const STEPS = 48;
  for (let i = 0; i < STEPS; i++) {
    const a = (i / STEPS) * Math.PI * 2;
    ctx.drawImage(img, Math.cos(a) * r, Math.sin(a) * r, w, h);
    ctx.drawImage(img, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, w, h);
  }

  // Flatten that dilated shape to the vinyl white, then lay the artwork on top.
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#f8f8fa';
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(img, 0, 0, w, h);

  return c;
}

const DEG = Math.PI / 180;
const MAX_YAW = 60 * DEG;
const MAX_TILT = 15 * DEG;
const NUDGE = 5 * DEG;
const SPRING_MS = 600;
const IDLE_AMP = 8 * DEG;
const GRID = 24; // plane subdivisions, enough for the bow to read

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error('shader compile failed: ' + log);
  }
  return sh;
}

/** Tessellated -1..1 plane as a triangle strip friendly index list. */
function planeGeometry() {
  const pos: number[] = [];
  const idx: number[] = [];
  for (let y = 0; y <= GRID; y++) {
    for (let x = 0; x <= GRID; x++) {
      pos.push((x / GRID) * 2 - 1, (y / GRID) * 2 - 1);
    }
  }
  const row = GRID + 1;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const a = y * row + x;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  return { pos: new Float32Array(pos), idx: new Uint16Array(idx) };
}

/**
 * Live WebGL sticker. Returns null when WebGL or the texture is unavailable so
 * the caller can fall back rather than leaving a blank box on the page.
 */
export async function createHoloViewer(canvas: HTMLCanvasElement, opts: HoloOptions) {
  const gl = (canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
    depth: false,
    // Headless shots read the buffer back with toDataURL, which needs it kept.
    preserveDrawingBuffer: opts.interactive === false,
  }) || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  if (!gl) return null;

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = opts.src;
  });
  if (!image) return null;

  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);

  const { pos, idx } = planeGeometry();
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

  // A decal measures its print margin from the logo's own ink, so it gets
  // cropped. Contour cut art keeps its transparent margin instead: that is the
  // room the cut line grows into.
  const cropped =
    opts.material === 'decal'
      ? cropToInk(image)
      : opts.dieCut === 'contour'
        ? addContourCut(image, 0.022)
        : null;
  const source: TexImageSource = cropped ?? image;
  const srcW = cropped ? cropped.width : image.naturalWidth;
  const srcH = cropped ? cropped.height : image.naturalHeight;

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const pot = (n: number) => (n & (n - 1)) === 0;
  if (pot(srcW) && pot(srcH)) {
    gl.generateMipmap(gl.TEXTURE_2D);
  } else {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const u = {
    theta: U('uTheta'), tilt: U('uTilt'), bow: U('uBow'), dist: U('uDist'),
    scale: U('uScale'), aspect: U('uAspect'), tex: U('uTex'),
    intensity: U('uIntensity'), hueScale: U('uHueScale'), material: U('uMaterial'),
    dieCut: U('uDieCut'), tileScale: U('uTileScale'), blur: U('uBlur'),
    aa: U('uAA'), grain: U('uGrain'), seed: U('uSeed'), plane: U('uPlane'),
    decalAR: U('uDecalAR'), radius: U('uRadius'), inset: U('uInset'),
    dropShadow: U('uDropShadow'), shadowOff: U('uShadowOff'), rimW: U('uRimW'),
  };

  const isDecal = opts.material === 'decal';

  gl.uniform1i(u.tex, 0);
  gl.uniform1f(u.intensity, opts.intensity);
  gl.uniform1f(u.hueScale, opts.hueScale);
  gl.uniform1f(u.material, isDecal ? 2 : opts.material === 'holo' ? 0 : 1);
  gl.uniform1f(u.dieCut, opts.dieCut === 'circle' ? 0 : opts.dieCut === 'contour' ? 2 : 1);
  gl.uniform1f(u.tileScale, opts.tileScale);
  gl.uniform1f(u.grain, opts.grain);
  gl.uniform1f(u.seed, Math.random() * 100);
  // Camera distance d = 2.6 x diameter. The plane spans -1..1, so the
  // diameter is 2 units and d works out at 5.2.
  gl.uniform1f(u.dist, 2.6 * 2);
  gl.uniform1f(u.bow, 0.055);

  // Decal geometry, all of it derived from the logo's own proportions.
  // Working in units where the logo is 1 high.
  const logoAR = srcW / srcH;
  const frameW = logoAR + MARGIN_RATIO * 2;
  const frameH = 1 + MARGIN_RATIO * 2;
  const decalAR = frameW / frameH;
  gl.uniform1f(u.decalAR, decalAR);
  gl.uniform2f(u.inset, frameW / logoAR, frameH);
  gl.uniform1f(u.radius, (RADIUS_RATIO * 2) / decalAR);
  gl.uniform1f(u.dropShadow, opts.dropShadow ? 1 : 0);
  gl.uniform2f(u.shadowOff, -SHADOW_RATIO / logoAR, SHADOW_RATIO);
  gl.uniform1f(u.rimW, 0.012);

  // The plane takes the artwork's proportions, so a wide sticker is a wide
  // plane rather than a square one with the art squashed into it. A holo tile
  // is seamless and gets centre cropped instead, so it stays square.
  const texAR = srcW / srcH;
  if (isDecal) {
    gl.uniform2f(u.plane, 1, 1 / decalAR);
  } else if (opts.material === 'matte') {
    gl.uniform2f(u.plane, texAR >= 1 ? 1 : texAR, texAR >= 1 ? 1 / texAR : 1);
  } else {
    gl.uniform2f(u.plane, 1, 1);
  }

  // A die cut circle needs room around it for the rim and the tilt; a full
  // bleed rectangle should sit as close to the frame as rotation allows.
  const liveFit = isDecal ? 0.94 : opts.dieCut === 'circle' ? 0.88 : 0.92;
  let fit = opts.fit ?? liveFit;

  // --- state -------------------------------------------------------------
  const interactive = opts.interactive !== false;
  const reduced = !interactive || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let yaw = 0;
  let tilt = 0;
  let dragging = false;
  let touched = reduced; // reduced motion starts with the idle drift already off
  let pointerId: number | null = null;
  let startX = 0, startY = 0, startYaw = 0, startTilt = 0;
  let springFrom = 0, springFromTilt = 0, springAt = 0, springing = false;
  let visible = true;
  let raf = 0;
  let dpr = 1;
  let cssSize = 0;
  const t0 = performance.now();

  function resize() {
    let px: number;
    let side: number;
    if (opts.pixelSize) {
      // Headless product shots render at a fixed size, not a measured one.
      dpr = 1;
      px = opts.pixelSize;
      side = px;
    } else {
      const rect = canvas.getBoundingClientRect();
      side = Math.max(1, Math.min(rect.width, rect.height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      px = Math.round(side * dpr);
    }
    if (px === canvas.width && side === cssSize) return;
    cssSize = side;
    canvas.width = px;
    canvas.height = px;
    gl.viewport(0, 0, px, px);
    // 0.8px gaussian, and the die cut edge, both expressed in the units the
    // shader works in so they stay a constant width on screen at any size.
    gl.uniform1f(u.blur, 0.8 / px / opts.tileScale);
    gl.uniform1f(u.aa, 2.0 / px * dpr);
  }

  function draw() {
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.theta, yaw);
    gl.uniform1f(u.tilt, tilt);
    gl.uniform1f(u.scale, fit);
    gl.uniform2f(u.aspect, 1, 1);
    gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
  }

  function frame(now: number) {
    raf = 0;
    if (!visible) return;
    resize();

    if (springing) {
      const t = clamp((now - springAt) / SPRING_MS, 0, 1);
      const e = easeOutCubic(t);
      yaw = springFrom * (1 - e);
      tilt = springFromTilt * (1 - e);
      if (t >= 1) springing = false;
    } else if (!dragging && !touched) {
      // Idle drift before the first interaction only.
      yaw = Math.sin((now - t0) / 1900) * IDLE_AMP;
      tilt = Math.sin((now - t0) / 3100) * (IDLE_AMP * 0.25);
    }

    draw();
    if (springing || (!dragging && !touched)) schedule();
  }

  function schedule() {
    if (!raf && visible) raf = requestAnimationFrame(frame);
  }

  function settle() {
    if (reduced) {
      yaw = 0;
      tilt = 0;
      springing = false;
      schedule();
      return;
    }
    springFrom = yaw;
    springFromTilt = tilt;
    springAt = performance.now();
    springing = true;
    schedule();
  }

  // --- interaction -------------------------------------------------------
  function applyFromPointer(clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect();
    // 1:1 with the pointer: a full traverse of the element covers the range.
    yaw = clamp(startYaw + ((clientX - startX) / rect.width) * (MAX_YAW * 2), -MAX_YAW, MAX_YAW);
    tilt = clamp(startTilt + ((clientY - startY) / rect.height) * (MAX_TILT * 2), -MAX_TILT, MAX_TILT);
  }

  const onDown = (e: PointerEvent) => {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    dragging = true;
    touched = true;
    springing = false;
    startX = e.clientX;
    startY = e.clientY;
    startYaw = yaw;
    startTilt = tilt;
    canvas.setPointerCapture(e.pointerId);
    schedule();
  };

  const onMove = (e: PointerEvent) => {
    if (dragging && e.pointerId === pointerId) {
      applyFromPointer(e.clientX, e.clientY);
      schedule();
      return;
    }
    // Hover tracking on precise pointers, so it reacts before you press.
    if (!dragging && e.pointerType === 'mouse') {
      touched = true;
      springing = false;
      const rect = canvas.getBoundingClientRect();
      yaw = clamp(((e.clientX - rect.left) / rect.width - 0.5) * 2 * MAX_YAW, -MAX_YAW, MAX_YAW);
      tilt = clamp(((e.clientY - rect.top) / rect.height - 0.5) * 2 * MAX_TILT, -MAX_TILT, MAX_TILT);
      schedule();
    }
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    dragging = false;
    pointerId = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    settle();
  };

  const onLeave = () => {
    if (!dragging) settle();
  };

  const onKey = (e: KeyboardEvent) => {
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -1;
    else if (e.key === 'ArrowRight') dx = 1;
    else if (e.key === 'ArrowUp') dy = -1;
    else if (e.key === 'ArrowDown') dy = 1;
    else return;
    e.preventDefault();
    touched = true;
    springing = false;
    yaw = clamp(yaw + dx * NUDGE, -MAX_YAW, MAX_YAW);
    tilt = clamp(tilt + dy * NUDGE, -MAX_TILT, MAX_TILT);
    schedule();
  };

  if (interactive) {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('keydown', onKey);
    canvas.addEventListener('blur', onLeave);
  }

  // Pause off screen and on a hidden tab.
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting && !document.hidden;
    if (visible) schedule();
    else if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }, { threshold: 0 });
  io.observe(canvas);

  const onVisibility = () => {
    if (document.hidden) {
      visible = false;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    } else {
      visible = true;
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const ro = new ResizeObserver(() => schedule());
  ro.observe(canvas);

  resize();
  draw();
  schedule();

  return {
    /**
     * Drive the angle directly, in degrees. Used by the product shot script,
     * which needs angles the drag deliberately clamps out (the 62 degree edge
     * shot sits past the interactive limit).
     */
    /** The fit the live shop viewer uses, so a poster can match it exactly. */
    liveFit,
    /** Shots override the fit to leave room for the contact shadow. */
    setFit(v: number) {
      fit = v;
    },
    /** Switch a decal between its white and drop shadow finishes. */
    setDropShadow(on: boolean) {
      gl.uniform1f(u.dropShadow, on ? 1 : 0);
      draw();
      schedule();
    },
    setAngle(yawDeg: number, tiltDeg = 0) {
      touched = true;
      springing = false;
      yaw = yawDeg * DEG;
      tilt = tiltDeg * DEG;
      resize();
      draw();
      gl.finish();
    },
    destroy() {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      if (raf) cancelAnimationFrame(raf);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
