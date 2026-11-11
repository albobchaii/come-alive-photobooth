/**
 * The Come Alive film grade, in the browser.
 *
 * A 1:1 port of `python/film-grade.py` (next to this folder), the script every
 * still and clip on the Come Alive site was graded with. A photobooth exists so
 * a visitor can put their own photograph through that same stock, so "close
 * enough" is the one thing it must not be: a photo that is nearly the grade
 * reads as a different look, not as a near miss.
 *
 * ## Usage
 *
 * No dependencies. Resize the photo to WORK_WIDTH first (see the note on it
 * below), then hand over the RGBA pixels:
 *
 *   const h = Math.round((img.height * WORK_WIDTH) / img.width);
 *   canvas.width = WORK_WIDTH;
 *   canvas.height = h;
 *   ctx.drawImage(img, 0, 0, WORK_WIDTH, h);
 *   const src = ctx.getImageData(0, 0, WORK_WIDTH, h);
 *   const out = grade(src.data, WORK_WIDTH, h, PRESETS.interior.params);
 *   ctx.putImageData(new ImageData(out, WORK_WIDTH, h), 0, 0);
 *
 * It takes a second or two per photo, all in one loop that never yields, so
 * run it in a Web Worker if the page has to stay responsive meanwhile. It is
 * for the captured RESULT, not a live camera preview.
 *
 * ## Why the CPU, and not a shader
 *
 * The obvious build is a fragment shader — the pipeline is per-pixel plus two
 * blurs. Two details in the Python make that the wrong call:
 *
 *  1. `_blur()` QUANTISES TO uint8 before blurring. That is a real step, not
 *     an implementation artefact: the halation pass sees an 8-bit highlight
 *     mask, and reproducing it in float on a GPU gives visibly cleaner bloom.
 *  2. Pillow's `GaussianBlur` is not a Gaussian. It is three passes of box
 *     blur with a fractional radius (Gwosdek et al.), which has a different
 *     tail shape to a true Gaussian at the same sigma.
 *
 * Both are exactly reproducible in a loop and only approximable in GLSL. A
 * port that matches beats a shader that is close, and this runs once per
 * photo rather than per frame, so the cost buys something.
 *
 * ## Why it runs in the browser at all
 *
 * The alternative is a server route running the Python itself, which would be
 * exact by construction. It would also mean receiving photographs — at a
 * church youth event, largely photographs of minors — and owning the
 * retention and consent questions that come with that. Grading on the device
 * means there is nothing to receive. See `filmGrade.worker.js`.
 *
 * ## What CANNOT match, and why that is fine
 *
 * The grain. NumPy draws from PCG64; there is no PCG64 in the browser and
 * reimplementing one would be reproducing a number generator, not a look.
 * Grain here is seeded mulberry32 + Box-Muller, which matches the Python's
 * grain in DISTRIBUTION (mean, variance, midtone weighting, the 0.5px
 * correlation blur) but not pixel for pixel. Film grain is random by nature —
 * two frames of real stock do not match either. The comparison harness
 * therefore checks grain statistically and everything else exactly.
 */

/** Rec. 709 luma, the same coefficients the Python uses. */
const COEFF = [0.2126, 0.7152, 0.0722] as const;

export type ShadowTone = "cool" | "warm";

export type GradeParams = {
  /** Curve, split tone, halation, vignette, edge softness. */
  fade: number;
  /** Film grain and the halftone lattice. */
  grain: number;
  /**
   * "cool" tints shadows teal, right for night exteriors where the shadow is
   * open sky on snow. "warm" tints them amber-brown, right for firelit
   * interiors, where teal shadows fight the firelight.
   */
  shadow: ShadowTone;
  /** <1 darkens, >1 lightens. Applied BEFORE the curve, which only lifts. */
  exposure: number;
  /** Fixed so the same photo grades identically twice running. */
  grainSeed?: number;
  /**
   * 0 cool, 1 warm, blending continuously between the two shadow tints.
   * Overrides `shadow` when set. Present to keep parity with the Python,
   * which needs it for the door transition — that clip starts on a cold night
   * exterior and ends in a warm room, so one fixed tint is wrong at one end.
   */
  shadowMix?: number;
};

/**
 * The two stocks the Come Alive site is actually graded with.
 *
 * These are not invented for the photobooth — they are the exact values the
 * site's own stills were graded at: `interior` is the living room (A2),
 * `exterior` the snowy landing shot (A1). Grain is written as full strength
 * times 0.25 because the site ships at 25% grain; keep the multiplier
 * visible like this rather than folding it into one number, so it is obvious
 * what to change if you want the grain heavier.
 */
export const PRESETS = {
  interior: {
    label: "Inside the house",
    hint: "Firelight and warm shadows — the living room stock",
    params: { fade: 1.35, grain: 1.3 * 0.25, shadow: "warm", exposure: 0.9 },
  },
  exterior: {
    label: "Outside in the snow",
    hint: "Colder, grainier — the night-exterior stock",
    params: { fade: 1.35, grain: 2.6 * 0.25, shadow: "cool", exposure: 1.0 },
  },
} as const satisfies Record<
  string,
  { label: string; hint: string; params: GradeParams }
>;

export type PresetId = keyof typeof PRESETS;

/**
 * The width every photo is graded at, and the reason this module resizes at
 * all.
 *
 * Four steps below are tuned in ABSOLUTE PIXELS, not fractions of the frame:
 * the halation blur (sigma 26), the grain correlation blur (0.5), the
 * halftone lattice (1.6px period) and the edge softness (1.6). They were
 * chosen against plates 2568–3168px wide. Hand the same numbers a 1000px
 * photo and the halation spreads nearly three times as wide relative to the
 * frame while the halftone turns into a visible screen door — not a bug, but
 * a different grade, which defeats the point.
 *
 * So every input is fitted to this width first. 2752 is the width of the
 * site's landing still (A1), so a photograph and that plate go through
 * identical arithmetic.
 */
export const WORK_WIDTH = 2752;

/* -------------------------------------------------------------------------
 * Pillow's blur, ported.
 * ---------------------------------------------------------------------- */

/**
 * One horizontal box-blur pass with a FRACTIONAL radius.
 *
 * Fractional because Pillow's Gaussian approximation lands on a non-integer
 * box width and interpolates the edge taps to reach it; rounding to whole
 * pixels shifts the effective sigma enough to see in the halation.
 *
 * Mirrors ImagingBoxBlur: full-weight taps across the integer span, plus the
 * fractional part applied to the two taps just outside it, normalised by the
 * total weight. Edges clamp, as Pillow's do.
 */
function boxBlurH(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.floor(radius);
  const frac = radius - r;
  const norm = 1 / (radius * 2 + 1);
  const clampX = (x: number) => (x < 0 ? 0 : x > w - 1 ? w - 1 : x);

  for (let y = 0; y < h; y++) {
    const row = y * w * 3;
    /*
     * Running sum over the integer window, so cost is independent of radius.
     * The halation pass runs at sigma 26, which solves to a box radius of
     * ~25.5 — 51 taps per pixel per pass, six passes. Summing that directly
     * costs about six seconds on a 2752px frame, which on a phone is closer
     * to twenty. Sliding the window makes it O(1) per pixel.
     *
     * The fractional edge taps stay direct lookups: there are only ever two,
     * and folding them into the running sum would mean tracking a window that
     * changes weight as well as extent.
     */
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = -r; i <= r; i++) {
      const o = row + clampX(i) * 3;
      s0 += src[o];
      s1 += src[o + 1];
      s2 += src[o + 2];
    }
    for (let x = 0; x < w; x++) {
      let a0 = s0;
      let a1 = s1;
      let a2 = s2;
      if (frac > 0) {
        const oL = row + clampX(x - r - 1) * 3;
        const oR = row + clampX(x + r + 1) * 3;
        a0 += (src[oL] + src[oR]) * frac;
        a1 += (src[oL + 1] + src[oR + 1]) * frac;
        a2 += (src[oL + 2] + src[oR + 2]) * frac;
      }
      const o = row + x * 3;
      dst[o] = a0 * norm;
      dst[o + 1] = a1 * norm;
      dst[o + 2] = a2 * norm;

      // Slide: drop the leaving column, take the arriving one.
      const out = row + clampX(x - r) * 3;
      const inn = row + clampX(x + r + 1) * 3;
      s0 += src[inn] - src[out];
      s1 += src[inn + 1] - src[out + 1];
      s2 += src[inn + 2] - src[out + 2];
    }
  }
}

/** The same pass down the columns. Kept separate to stay cache-friendly. */
function boxBlurV(
  src: Float32Array,
  dst: Float32Array,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.floor(radius);
  const frac = radius - r;
  const norm = 1 / (radius * 2 + 1);
  const clampY = (y: number) => (y < 0 ? 0 : y > h - 1 ? h - 1 : y);

  const stride = w * 3;
  for (let x = 0; x < w; x++) {
    const col = x * 3;
    // Same running window as boxBlurH, down the columns.
    let s0 = 0;
    let s1 = 0;
    let s2 = 0;
    for (let i = -r; i <= r; i++) {
      const o = clampY(i) * stride + col;
      s0 += src[o];
      s1 += src[o + 1];
      s2 += src[o + 2];
    }
    for (let y = 0; y < h; y++) {
      let a0 = s0;
      let a1 = s1;
      let a2 = s2;
      if (frac > 0) {
        const oT = clampY(y - r - 1) * stride + col;
        const oB = clampY(y + r + 1) * stride + col;
        a0 += (src[oT] + src[oB]) * frac;
        a1 += (src[oT + 1] + src[oB + 1]) * frac;
        a2 += (src[oT + 2] + src[oB + 2]) * frac;
      }
      const o = y * stride + col;
      dst[o] = a0 * norm;
      dst[o + 1] = a1 * norm;
      dst[o + 2] = a2 * norm;

      const out = clampY(y - r) * stride + col;
      const inn = clampY(y + r + 1) * stride + col;
      s0 += src[inn] - src[out];
      s1 += src[inn + 1] - src[out + 1];
      s2 += src[inn + 2] - src[out + 2];
    }
  }
}

/**
 * Pillow's `ImageFilter.GaussianBlur(radius)`, where `radius` is the standard
 * deviation.
 *
 * Pillow does not convolve a Gaussian. It runs three box blurs whose width is
 * solved from the target sigma (Gwosdek et al. 2011, as cited in Pillow's own
 * BoxBlur.c), which is why this is a port of that solve rather than a kernel.
 * The tail shape differs from a true Gaussian, and the halation is wide enough
 * for that to be visible if it were done the textbook way.
 */
const BLUR_PASSES = 3;

/**
 * uint8 with ROUNDING, applied between box passes.
 *
 * Not the same operation as the truncation in `blurQuantised` below, and the
 * difference is not cosmetic. Pillow's box blur writes each pass back into an
 * 8-bit image, so the rounding happens six times inside one GaussianBlur call
 * and the passes compound it. Carrying float through instead — the obvious
 * way to write this — misses Pillow by up to 2 levels at sigma 1.6. Measured
 * against Pillow on a test pattern, this exact ordering and quantisation
 * reproduces it to mean 0.0000, max 0.
 */
function quantiseRound(b: Float32Array): void {
  for (let i = 0; i < b.length; i++) {
    const v = b[i] < 0 ? 0 : b[i] > 1 ? 1 : b[i];
    b[i] = Math.round(v * 255) / 255;
  }
}

function gaussianBlur(
  buf: Float32Array,
  w: number,
  h: number,
  sigma: number,
): void {
  if (sigma <= 0) return;
  const sigma2 = (sigma * sigma) / BLUR_PASSES;
  const L = Math.sqrt(12.0 * sigma2 + 1.0);
  const l = Math.floor((L - 1.0) / 2.0);
  let a = (2 * l + 1) * (l * (l + 1) - 3 * sigma2);
  a /= 6 * (sigma2 - (l + 1) * (l + 1));
  const radius = l + a;

  // ALL horizontal passes, then ALL vertical — Pillow's own order. With the
  // per-pass quantisation above the two orderings are not interchangeable,
  // even though box blur is separable.
  const tmp = new Float32Array(buf.length);
  for (let p = 0; p < BLUR_PASSES; p++) {
    boxBlurH(buf, tmp, w, h, radius);
    buf.set(tmp);
    quantiseRound(buf);
  }
  for (let p = 0; p < BLUR_PASSES; p++) {
    boxBlurV(buf, tmp, w, h, radius);
    buf.set(tmp);
    quantiseRound(buf);
  }
}

/**
 * `_blur()` from the Python, quantisation included.
 *
 * The round-trip through uint8 is deliberate and load-bearing — see the note
 * at the top of this file. Dropping it makes the halation measurably smoother
 * than the shipped assets.
 */
function blurQuantised(
  src: Float32Array,
  w: number,
  h: number,
  sigma: number,
): Float32Array {
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) {
    const v = src[i] < 0 ? 0 : src[i] > 1 ? 1 : src[i];
    // FLOOR, not round. numpy's `.astype(np.uint8)` truncates, and the Python
    // quantises with exactly that. Rounding here instead biases every
    // quantised value up by half a level, which the comparison harness caught
    // as a 2-level mean offset across the whole frame — invisible next to a
    // grade but a real, systematic drift away from the set.
    out[i] = Math.floor(v * 255) / 255;
  }
  gaussianBlur(out, w, h, sigma);
  return out;
}

/* -------------------------------------------------------------------------
 * Grain
 * ---------------------------------------------------------------------- */

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal, Box-Muller. Matches the Python's distribution, not its draw. */
function normals(count: number, seed: number): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 2) {
    let u = rand();
    if (u < 1e-12) u = 1e-12;
    const mag = Math.sqrt(-2 * Math.log(u));
    const ang = 2 * Math.PI * rand();
    out[i] = mag * Math.cos(ang);
    if (i + 1 < count) out[i + 1] = mag * Math.sin(ang);
  }
  return out;
}

/* -------------------------------------------------------------------------
 * The grade
 * ---------------------------------------------------------------------- */

/**
 * Grade one image in place-ish: takes RGBA bytes, returns RGBA bytes.
 *
 * Alpha is carried through untouched. The Python has no alpha channel at all
 * (it converts to RGB), so this is the one place the port adds behaviour
 * rather than mirroring it — a transparent PNG keeps its transparency instead
 * of being flattened onto black.
 *
 * `onProgress` reports 0..1 between steps. The halation blur on a 2752px image
 * is seconds of work on a phone, and a page that looks frozen during it reads
 * as broken.
 */
export function grade(
  rgba: Uint8ClampedArray,
  w: number,
  h: number,
  p: GradeParams,
  onProgress?: (fraction: number) => void,
): Uint8ClampedArray {
  const n = w * h;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = rgba[i * 4] / 255;
    a[i * 3 + 1] = rgba[i * 4 + 1] / 255;
    a[i * 3 + 2] = rgba[i * 4 + 2] / 255;
  }

  const { fade, grain, shadow, exposure } = p;
  const step = (f: number) => onProgress?.(f);

  // Exposure, before the curve: `fade` only ever LIFTS blacks, so it cannot
  // rescue an over-bright plate. This is what sets how much of the frame sits
  // in shadow for everything downstream.
  if (exposure !== 1) {
    for (let i = 0; i < a.length; i++) {
      const v = a[i] * exposure;
      a[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  step(0.1);

  // 1. Faded film curve. The single biggest reason a raw render reads
  //    "digital": its black point sits near 0.008 where a scanned print sits
  //    nearer 0.05.
  const lift = 0.042 * fade;
  const contrast = 1.0 - 0.12 * fade;
  for (let i = 0; i < a.length; i++) {
    const v = a[i] * (1 - lift) + lift;
    a[i] = (v - 0.5) * contrast + 0.5;
  }
  step(0.2);

  // 2. Split tone — teal into the shadows, amber into the highlights. Classic
  //    consumer-film colour science, and what makes snow read cold against
  //    warm windows.
  //
  //    These six numbers are copied from film-grade.py, not derived. They look
  //    arbitrary because they are: they are a look, and the only way to be
  //    right about them is to read them. (They were guessed the first time
  //    this file was written, which put every graded photo about two levels
  //    off the set until the comparison harness said so.)
  const COOL_TINT: readonly [number, number, number] = [-0.020, 0.012, 0.055];
  const WARM_TINT: readonly [number, number, number] = [0.055, 0.014, -0.030];
  //    `shadowMix` blends continuously between them, 0 cool and 1 warm, for a
  //    shot that crosses from one to the other. Nothing in the photobooth uses
  //    it — both presets sit at an end — but it is part of the grade's API and
  //    a port that drops it is a port that has quietly forked.
  const mix = p.shadowMix ?? (shadow === "warm" ? 1.0 : 0.0);
  const tint: readonly [number, number, number] = [
    COOL_TINT[0] * (1 - mix) + WARM_TINT[0] * mix,
    COOL_TINT[1] * (1 - mix) + WARM_TINT[1] * mix,
    COOL_TINT[2] * (1 - mix) + WARM_TINT[2] * mix,
  ];
  const amber: readonly [number, number, number] = [0.045, 0.014, -0.030];
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const lum = a[o] * COEFF[0] + a[o + 1] * COEFF[1] + a[o + 2] * COEFF[2];
    let sw = 1.0 - lum * 1.8;
    sw = sw < 0 ? 0 : sw > 1 ? 1 : sw;
    let hw = (lum - 0.45) * 1.9;
    hw = hw < 0 ? 0 : hw > 1 ? 1 : hw;
    a[o] += sw * tint[0] * fade + hw * amber[0] * fade;
    a[o + 1] += sw * tint[1] * fade + hw * amber[1] * fade;
    a[o + 2] += sw * tint[2] * fade + hw * amber[2] * fade;
  }
  step(0.3);

  // 3. Halation — bulbs bloom into the emulsion and smear warm. Pull the
  //    highlights, blur them wide, screen them back in warm-tinted.
  const hot = new Float32Array(a.length);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const lum = a[o] * COEFF[0] + a[o + 1] * COEFF[1] + a[o + 2] * COEFF[2];
    let m = (lum - 0.62) / 0.38;
    m = m < 0 ? 0 : m > 1 ? 1 : m;
    for (let c = 0; c < 3; c++) {
      const v = a[o + c];
      hot[o + c] = m * (v < 0 ? 0 : v > 1 ? 1 : v);
    }
  }
  const glow = blurQuantised(hot, w, h, 26);
  step(0.6);
  const glowTint: readonly [number, number, number] = [1.0, 0.62, 0.30];
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    for (let c = 0; c < 3; c++) {
      const base = a[o + c] < 0 ? 0 : a[o + c] > 1 ? 1 : a[o + c];
      let g = glow[o + c] * glowTint[c] * 0.45 * fade;
      g = g < 0 ? 0 : g > 1 ? 1 : g;
      a[o + c] = 1 - (1 - base) * (1 - g);
    }
  }
  step(0.65);

  // 4. Grain — monochromatic (film grain is not per-channel RGB noise) and
  //    weighted toward the midtones, where silver halide actually clumps.
  //    The Python blurs the noise by 0.5px through the same quantising
  //    helper, which correlates neighbours very slightly; without it the
  //    grain reads as digital speckle rather than emulsion.
  const raw = normals(n, p.grainSeed ?? 7);
  const noise3 = new Float32Array(a.length);
  for (let i = 0; i < n; i++) {
    const v = raw[i] * 0.5 + 0.5;
    noise3[i * 3] = v;
    noise3[i * 3 + 1] = v;
    noise3[i * 3 + 2] = v;
  }
  const noiseBlurred = blurQuantised(noise3, w, h, 0.5);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    const lum = a[o] * COEFF[0] + a[o + 1] * COEFF[1] + a[o + 2] * COEFF[2];
    const weight = 1.0 - Math.abs(2.0 * lum - 1.0);
    const g = (noiseBlurred[o] * 2 - 1) * weight * 0.048 * grain;
    a[o] += g;
    a[o + 1] += g;
    a[o + 2] += g;
  }
  step(0.8);

  // 5. Halftone/scan texture — a very fine dot lattice, near-invisible alone
  //    but it breaks up the digital smoothness.
  //    Period is 1.6px at WORK_WIDTH; see the note on WORK_WIDTH for why the
  //    image is resized to meet this number rather than the number scaled to
  //    meet the image.
  const dotAmp = 0.011 * grain;
  for (let y = 0; y < h; y++) {
    const sy = Math.sin((y * Math.PI) / 1.6);
    for (let x = 0; x < w; x++) {
      const d = Math.sin((x * Math.PI) / 1.6) * sy * dotAmp;
      const o = (y * w + x) * 3;
      a[o] += d;
      a[o + 1] += d;
      a[o + 2] += d;
    }
  }

  // 6. Vignette, capped so a heavy grade darkens the corners without crushing
  //    them to black.
  const vigCap = Math.min(0.42 * fade, 0.62);
  const softMix = Math.min(0.55 * fade, 0.85);
  const radial = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const cy = (y - h / 2) / (h / 2);
    for (let x = 0; x < w; x++) {
      const cx = (x - w / 2) / (w / 2);
      const r = Math.sqrt(cx * cx + cy * cy);
      radial[y * w + x] = r;
      let t = (r - 0.55) / 1.05;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const v = 1 - t * t * vigCap;
      const o = (y * w + x) * 3;
      a[o] *= v;
      a[o + 1] *= v;
      a[o + 2] *= v;
    }
  }
  step(0.85);

  // 7. Mild lens softness toward the edges — cheap lenses lose the corners.
  //    Applied AFTER the grain, so the corners lose their grain too, which is
  //    what a soft corner on real stock actually looks like. Blurring before
  //    the grain would leave sharp speckle sitting on a soft image.
  const soft = blurQuantised(a, w, h, 1.6);
  for (let i = 0; i < n; i++) {
    let e = (radial[i] - 0.62) / 0.7;
    e = e < 0 ? 0 : e > 1 ? 1 : e;
    const mix = e * softMix;
    const o = i * 3;
    a[o] = a[o] * (1 - mix) + soft[o] * mix;
    a[o + 1] = a[o + 1] * (1 - mix) + soft[o + 1] * mix;
    a[o + 2] = a[o + 2] * (1 - mix) + soft[o + 2] * mix;
  }
  step(1);

  // Truncating, to match the Python's final `.astype(np.uint8)`. Note that
  // Uint8ClampedArray ROUNDS on assignment, so the value written has to
  // already be an integer or the array would quietly undo this.
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < n; i++) {
    const o = i * 3;
    out[i * 4] = Math.floor(Math.min(1, Math.max(0, a[o])) * 255);
    out[i * 4 + 1] = Math.floor(Math.min(1, Math.max(0, a[o + 1])) * 255);
    out[i * 4 + 2] = Math.floor(Math.min(1, Math.max(0, a[o + 2])) * 255);
    out[i * 4 + 3] = rgba[i * 4 + 3];
  }
  return out;
}
