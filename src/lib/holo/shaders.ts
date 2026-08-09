// GLSL for the sticker viewer. Ported straight from the sticker brief:
// the foil mask comes from the artwork's own luminance (§1) and the spectral
// sweep is the shader in §3. Nothing here is hand authored per product.

export const VERT = /* glsl */ `
attribute vec2 aPos;

uniform float uTheta;   // Y rotation, radians
uniform float uTilt;    // X tilt, radians
uniform float uBow;     // shallow bow across the plane, vinyl is never flat
uniform float uDist;    // camera distance, in radii
uniform float uScale;   // fit inside the canvas
uniform vec2  uAspect;  // canvas aspect correction
uniform vec2  uPlane;   // plane proportions: (1, 1) square, (1, 1/AR) for a decal

varying vec2 vNxy;

void main() {
  vec2 p = aPos * uPlane;

  // Vinyl never sits perfectly flat. A gentle cylindrical bow, strongest at
  // the centre line and easing out towards the edges.
  float bow = uBow * (1.0 - p.x * p.x) * (1.0 - 0.25 * p.y * p.y);
  vec3 q = vec3(p, bow);

  // Rotate about Y so that z = x*sin(theta) and x' = x*cos(theta), matching
  // the projection in the brief.
  float c = cos(uTheta), s = sin(uTheta);
  vec3 r = vec3(q.x * c - q.z * s, q.y, q.x * s + q.z * c);

  // Coupled X tilt.
  float c2 = cos(uTilt), s2 = sin(uTilt);
  r = vec3(r.x, r.y * c2 - r.z * s2, r.y * s2 + r.z * c2);

  // Perspective: s = d / (d + z)
  float persp = uDist / (uDist + r.z);

  gl_Position = vec4(r.xy * persp * uScale * uAspect, 0.0, 1.0);
  // Normalised across the sticker's own extent, whatever its proportions.
  vNxy = aPos;
}
`;

export const FRAG = /* glsl */ `
precision highp float;

varying vec2 vNxy;

uniform sampler2D uTex;
uniform float uTheta;
uniform float uIntensity;   // foil strength, default 0.9
uniform float uHueScale;    // per product hue tuning
uniform float uMaterial;    // 0 = holographic, 1 = matte vinyl, 2 = transfer decal
uniform float uDecalAR;     // decal frame width / height
uniform float uRadius;      // die cut corner radius, in plane units
uniform vec2  uInset;       // frame size / logo size, i.e. the print margin
uniform float uDropShadow;  // the drop shadow finish
uniform vec2  uShadowOff;   // its offset, in uv
uniform float uRimW;        // width of the cut edge highlight
uniform float uDieCut;      // 0 = circle, 1 = none
uniform float uTileScale;   // tile drawn at this multiple of the die diameter
uniform float uBlur;        // 0.8px gaussian, expressed in uv
uniform float uAA;          // die cut edge softness, in nxy units
uniform float uGrain;
uniform float uSeed;

const float TAU   = 6.28318530718;
const float PHI_A = 0.48869219;  // 28 degree diffraction axis

float sq(float x) { return x * x; }

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

// White in the artwork is unprinted vinyl, so the rainbow substrate shows
// through it. Coloured regions are ink over that substrate. One function,
// derived from luminance, works for every sticker designed this way.
float foilAt(vec2 uv) {
  return clamp((luma(texture2D(uTex, uv).rgb) - 0.55) / (0.92 - 0.55), 0.0, 1.0);
}

float foilMask(vec2 uv) {
  float b = uBlur;
  float m = foilAt(uv) * 0.4;
  m += foilAt(uv + vec2( b, 0.0)) * 0.15;
  m += foilAt(uv + vec2(-b, 0.0)) * 0.15;
  m += foilAt(uv + vec2(0.0,  b)) * 0.15;
  m += foilAt(uv + vec2(0.0, -b)) * 0.15;
  return m;
}

vec3 holoColour(vec2 n, float theta) {
  float u = n.x * cos(PHI_A) + n.y * sin(PHI_A);
  float p = u * 7.5 * uHueScale + theta * 4.2;

  vec3 rgb = vec3(0.5) + 0.5 * vec3(sin(p), sin(p + TAU / 3.0), sin(p + 2.0 * TAU / 3.0));

  // Desaturate towards silver pearl. Full saturation reads as plastic candy
  // and does not match the printed product.
  rgb = rgb * 0.46 + 0.54;

  // Narrow specular band, travels faster than the hue sweep.
  float spec = exp(-sq(u - sin(theta * 1.6) * 0.9) / 0.045);
  return clamp(rgb + spec * 0.42, 0.0, 1.0);
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
}

// For a transfer decal the alpha channel of the artwork IS the printed white
// ink. Outside the artwork there is no ink, only clear film.
float inkAt(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
  return texture2D(uTex, uv).a;
}

/**
 * Clear matte transfer vinyl: white ink on a clear carrier film, cut as a
 * rounded rectangle around the logo with a print margin. No foil, no rainbow.
 */
vec4 decal() {
  vec2 uvd = vNxy * uInset * 0.5 + 0.5;
  float ink = inkAt(uvd);

  // Die cut, derived from the logo rather than authored per product.
  vec2 p = vec2(vNxy.x, vNxy.y / uDecalAR);
  vec2 h = vec2(1.0, 1.0 / uDecalAR);
  vec2 q = abs(p) - (h - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float film = 1.0 - smoothstep(-uAA, uAA, d);

  vec3 rgb = vec3(0.0);
  float a = 0.0;

  // The film itself is barely there: you read it by its edge and its sheen.
  float filmA = film * 0.20;
  rgb += vec3(0.86) * filmA;
  a = filmA;

  // Light catching the cut edge.
  float rim = clamp(1.0 + d / uRimW, 0.0, 1.0) * film;
  rgb += vec3(rim * 0.75);
  a = clamp(a + rim * 0.75, 0.0, 1.0);

  // Broad soft specular sweep across the film, tied to viewing angle.
  float band = exp(-sq((vNxy.x * 0.92 + vNxy.y * 0.39) - sin(uTheta * 1.5) * 0.75) / 0.18);
  float sheen = band * film * 0.20;
  rgb += vec3(sheen);
  a = clamp(a + sheen * 0.7, 0.0, 1.0);

  // Drop shadow finish: an offset dark plate behind the white.
  if (uDropShadow > 0.5) {
    float sh = inkAt(uvd + uShadowOff) * 0.92;
    rgb = rgb * (1.0 - sh) + 0.06 * sh;
    a = clamp(a + sh, 0.0, 1.0);
  }

  // White ink: opaque, matte, gentle diffuse falloff and nothing else.
  float diff = clamp(0.90 + 0.10 * cos(uTheta) * (1.0 - 0.25 * abs(vNxy.x)), 0.0, 1.0);
  rgb = rgb * (1.0 - ink) + diff * ink;
  a = clamp(a + ink, 0.0, 1.0);

  return vec4(rgb, a * clamp(film * 3.0, 0.0, 1.0));
}

void main() {
  if (uMaterial > 1.5) {
    gl_FragColor = decal();
    return;
  }

  vec2 uv = vNxy * (0.5 / uTileScale) + 0.5;
  vec3 base = texture2D(uTex, uv).rgb;
  vec3 col;

  if (uMaterial < 0.5) {
    float mask = foilMask(uv);
    vec3 holo = holoColour(vNxy, uTheta);

    // Fine grain so the foil is not a clean mathematical gradient.
    holo = clamp(holo + (hash(gl_FragCoord.xy) - 0.5) * uGrain, 0.0, 1.0);

    // Replacement, not screen blend. Screen blending a rainbow onto white
    // yields white, which is why naive holo effects look dead.
    float k = mask * 0.93 * uIntensity;
    col = base * (1.0 - k) + holo * k;

    // Faint sheen over the printed ink.
    col = 1.0 - (1.0 - col) * (1.0 - holo * 0.16 * uIntensity);
  } else {
    // Matte vinyl: flat diffuse with a soft specular roll off. No foil.
    float u = vNxy.x * cos(PHI_A) + vNxy.y * sin(PHI_A);
    float roll = exp(-sq(u - sin(uTheta * 1.2) * 0.7) / 0.5);
    col = clamp(base * (0.94 + 0.10 * roll) + roll * 0.05, 0.0, 1.0);
  }

  // Die cut, applied by the renderer rather than baked into the artwork.
  float r = length(vNxy);
  float alpha = uDieCut < 0.5 ? 1.0 - smoothstep(1.0 - uAA, 1.0, r) : 1.0;

  // Thin unprinted rim just inside the cut line, and it clips the sheen with it.
  if (uDieCut < 0.5) {
    col = mix(col, vec3(0.95, 0.95, 0.96), smoothstep(0.958, 0.974, r));
  }

  gl_FragColor = vec4(col, alpha);
}
`;
