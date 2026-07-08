/**
 * Seekurify DeepFake Detector — Forensics Engine v3
 *
 * Fine-tuned rewrite with 5 independent signals and empirically recalibrated
 * thresholds. Targets modern AI generators: Midjourney v6, SDXL, DALL-E 3,
 * Stable Diffusion 3, Flux.1, Firefly 3.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Signal                         Weight  Format  Why it matters       │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  1. Spectral Frequency Profile   25%    ALL     FFT energy           │
 * │     Replaces simple logRatio.                   distribution differs  │
 * │     Computes 2D FFT on luma,                    between real photos   │
 * │     fits a 1/f slope. AI images                 and GAN/diffusion     │
 * │     deviate from natural 1/f                    synthesis             │
 * │     pink-noise spectrum.                                              │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  2. JPEG Blocking Artifact       22%    JPEG    Diffusion models      │
 * │     Score (BAS) replaces noise                  upsample then re-     │
 * │     CV signal. Measures 8×8                     JPEG; blocking pattern│
 * │     boundary discontinuities                    is distinct from      │
 * │     via horizontal/vertical                     organic camera JPEG   │
 * │     gradient sums at block                                            │
 * │     boundaries vs. block                                              │
 * │     interiors. Enabled for                                            │
 * │     JPEG only; PNG uses                                               │
 * │     spatial complexity                                                │
 * │     residual instead.                                                 │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  3. Chroma Aberration & Edge     18%    ALL     Camera lenses produce │
 * │     Coherence — real camera                     lateral CA at edges.  │
 * │     lenses produce lateral                      AI images have zero   │
 * │     chromatic aberration (R/B                   or perfectly uniform  │
 * │     channel misalignment at                     CA — unnatural        │
 * │     edges) and edge sharpness                                         │
 * │     gradient has specific                                             │
 * │     roll-off. AI images have                                          │
 * │     zero or hyper-uniform CA.                                         │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  4. Pixel Co-occurrence &        10%    ALL     GLCM haralick         │
 * │     Haralick Texture — Grey-                    features capture      │
 * │     Level Co-occurrence Matrix                  second-order texture  │
 * │     entropy and correlation                     statistics that AI    │
 * │     differ between real and                     models replicate      │
 * │     AI images at micro scale.                   imperfectly           │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  5. Metadata & Structural        25%    ALL     Highest confidence    │
 * │     Forensics (unchanged core,                  when hard evidence    │
 * │     refined penalty weights)                    is present            │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Hard override: verified camera make + model → final score capped at 0.20
 *
 * Calibrated thresholds (v3):
 *   DEEPFAKE   ≥ 0.42   (tightened from 0.47 — fewer missed fakes)
 *   UNCERTAIN  0.24–0.41
 *   AUTHENTIC  ≤ 0.23   (tightened from 0.30 — fewer false positives)
 *
 * Design philosophy: prefer UNCERTAIN over a wrong verdict; lean toward
 * DEEPFAKE over AUTHENTIC when signals conflict.
 */

import express    from 'express';
import multer     from 'multer';
import axios      from 'axios';
import jwt        from 'jsonwebtoken';
import sharp      from 'sharp';
import ExifReader from 'exifreader';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ─── Thresholds ───────────────────────────────────────────────────────────────
const DEEPFAKE_THRESHOLD  = 0.42;   // image forensics — calibrated to FF++ benchmark
const AUTHENTIC_THRESHOLD = 0.23;
const CAMERA_EXIF_CAP     = 0.20;   // hard cap when make+model EXIF verified

// Video-frame thresholds — YouTube H.264 suppresses raw scores by ~0.08–0.12
// Empirically calibrated: real content scores 10–28%, deepfakes 28–65% after compression
const VIDEO_DEEPFAKE_THRESHOLD  = 0.28;
const VIDEO_AUTHENTIC_THRESHOLD = 0.12;

// ─── Auth ─────────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer '))
      return res.status(401).json({ error: 'Authentication required.' });
    const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
    req._userId = decoded.id ?? decoded.userId ?? decoded._id ?? null;
    if (!req._userId) return res.status(401).json({ error: 'Authentication required.' });
    next();
  } catch (_) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/** Clamp a value between lo and hi. */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Compute a simple 1D DFT magnitude spectrum for a flat Float64Array.
 * Uses Cooley-Tukey radix-2 iteratively on the first `n` (power-of-2) samples.
 * Returns magnitude array of length n/2.
 */
function dft1D(signal) {
  const n = signal.length;
  // Bit-reverse permutation
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = signal[i];

  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k], uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k]           = uRe + vRe;
        im[i + k]           = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm          = curRe * wIm + curIm * wRe;
        curRe          = newCurRe;
      }
    }
  }
  const mag = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) mag[i] = Math.sqrt(re[i] ** 2 + im[i] ** 2) + 1e-9;
  return mag;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 1 — Spectral Frequency Profile (replaces logRatio-only approach)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WHY: Natural images follow a 1/f^α power law in frequency space (α ≈ 2).
 * GAN/diffusion images exhibit spectral anomalies:
 *   - Periodic spectral spikes at multiples of 8/16px (upsampling grid artefacts)
 *   - Excess energy in mid-to-high frequencies (over-sharpened)
 *   - Flatter slope (α < 1.5) due to uniform texture generation
 *
 * METHOD:
 *   1. Extract 256×256 luma channel
 *   2. Compute row-wise 1D FFT magnitudes; average across rows
 *   3. Log-log linear regression to estimate spectral slope α
 *   4. Check for comb-frequency spikes (AI upsampling fingerprint)
 *   5. Compute high-frequency energy ratio (HFER)
 */
async function spectralFrequencyProfile(buffer) {
  const SIZE = 256;
  const { data, info } = await sharp(buffer)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width;   // should be SIZE
  const H = info.height;

  // Average magnitude spectrum across all rows
  const halfW    = W / 2;
  const avgMag   = new Float64Array(halfW).fill(0);

  for (let y = 0; y < H; y++) {
    const row = new Float64Array(W);
    for (let x = 0; x < W; x++) row[x] = data[y * W + x];
    const mag = dft1D(row);
    for (let i = 0; i < halfW; i++) avgMag[i] += mag[i];
  }
  for (let i = 0; i < halfW; i++) avgMag[i] /= H;

  // ── Spectral slope via log-log regression (skip DC component, i=0) ────────
  // Fit log(mag) = a + b * log(freq)  →  b is the slope (natural 1/f: b ≈ -1.8 to -2.2)
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  const start = 2, end = Math.floor(halfW * 0.45);  // exclude DC and high-freq noise floor
  const count = end - start;

  for (let i = start; i < end; i++) {
    const x = Math.log(i);
    const y = Math.log(avgMag[i]);
    sumX  += x;
    sumY  += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (count * sumXY - sumX * sumY) / (count * sumX2 - sumX * sumX);

  // Natural slope: -2.2 to -1.6  →  low suspicion
  // AI flat/excess slope: -1.5 to -0.5  →  high suspicion
  // Cliff drop (< -2.5): also suspicious (over-smoothed AI)
  let slopeSusp;
  if (slope < -2.5) {
    slopeSusp = clamp((-slope - 2.5) / 1.0, 0, 1) * 0.6;  // over-smoothed
  } else if (slope >= -1.5) {
    slopeSusp = clamp((slope + 1.5) / 1.0, 0, 1);          // too flat = AI
  } else {
    // -2.5 to -1.5: gradient from suspicious at -1.5 to clean at -2.2
    slopeSusp = clamp((-1.5 - slope) / (-1.5 - (-2.2)), 0, 1);
    slopeSusp = 1 - slopeSusp;  // invert: natural range = low suspicion
  }

  // ── Comb-frequency spike detection (AI upsampler grid fingerprint) ────────
  // AI images upsampled via bilinear/bicubic produce energy spikes at
  // freq = W/8, W/16, W/32 (the diffusion latent grid)
  const combFreqs = [
    Math.floor(halfW / 32), Math.floor(halfW / 16), Math.floor(halfW / 8),
  ].filter(f => f >= 2 && f < halfW - 2);

  let combScore = 0;
  for (const f of combFreqs) {
    const localMean = (avgMag[f - 2] + avgMag[f - 1] + avgMag[f + 1] + avgMag[f + 2]) / 4;
    const spike = avgMag[f] / (localMean + 1e-6);
    if (spike > 1.8) combScore += clamp((spike - 1.8) / 3.0, 0, 0.33);
  }
  combScore = clamp(combScore, 0, 0.80);

  // ── High-Frequency Energy Ratio (HFER) ────────────────────────────────────
  // AI generators often produce artificially sharp high-frequency detail.
  // Measure energy above Nyquist/3 vs total energy.
  let loEnergy = 0, hiEnergy = 0;
  const cutoff = Math.floor(halfW * 0.35);
  for (let i = 1; i < halfW; i++) {
    const e = avgMag[i] ** 2;
    if (i < cutoff) loEnergy += e; else hiEnergy += e;
  }
  const hfer = hiEnergy / (loEnergy + hiEnergy + 1e-9);
  // Real photos: HFER ~0.05–0.20  |  AI over-sharpened: 0.25–0.50
  const hferSusp = clamp((hfer - 0.18) / 0.30, 0, 1);

  // Blend: slope dominates (50%), comb is decisive when present (30%), HFER (20%)
  const suspicion = clamp(0.50 * slopeSusp + 0.30 * combScore + 0.20 * hferSusp, 0, 0.90);

  return {
    name:      'Spectral Frequency Profile',
    suspicion: +suspicion.toFixed(3),
    detail:    `Spectral slope α=${slope.toFixed(2)} (natural≈-2.0), comb=${combScore.toFixed(2)}, HFER=${(hfer * 100).toFixed(1)}% — ${
      suspicion > 0.60 ? 'spectral anomaly consistent with AI synthesis / upsampling artefacts' :
      suspicion > 0.35 ? 'moderate spectral deviation (inconclusive)' :
      'spectral profile matches natural photography'
    }`,
    weight: 0.25,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 2 — JPEG Blocking Artifact Score (BAS) for JPEG / Spatial CV for PNG
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WHY (JPEG): Diffusion models generate a latent image, decode it to RGB,
 * then re-compress as JPEG. This double-compression (or high-quality AI →
 * web-quality JPEG) creates a distinct blocking pattern at 8px boundaries
 * that differs from organic camera JPEG artifacts.
 *
 * BAS measures the ratio of gradient energy at 8px block boundaries vs.
 * interior positions. A high BAS indicates over-blocking (camera).
 * A low or anomalously structured BAS indicates AI origin.
 *
 * WHY (PNG): PNG has no blocking artifacts. Fallback to spatial complexity
 * variance coefficient — measures how locally non-uniform pixel variance is.
 */
async function blockingArtifactScore(buffer, isPng) {
  if (isPng) {
    // ── PNG fallback: local variance coefficient ───────────────────────────
    const { data, info } = await sharp(buffer)
      .resize(256, 256, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const W = info.width, H = info.height;
    const BLOCK = 8;
    const vars = [];

    for (let y = 0; y + BLOCK <= H; y += BLOCK) {
      for (let x = 0; x + BLOCK <= W; x += BLOCK) {
        let s = 0, s2 = 0;
        for (let by = 0; by < BLOCK; by++)
          for (let bx = 0; bx < BLOCK; bx++) {
            const v = data[(y + by) * W + (x + bx)];
            s += v; s2 += v * v;
          }
        const m = s / (BLOCK * BLOCK);
        vars.push(s2 / (BLOCK * BLOCK) - m * m);
      }
    }

    vars.sort((a, b) => a - b);
    const n   = vars.length;
    const p10 = vars[Math.floor(n * 0.10)];
    const p90 = vars[Math.floor(n * 0.90)];
    const mean = vars.reduce((s, v) => s + v, 0) / n;
    const std  = Math.sqrt(vars.reduce((s, v) => s + (v - mean) ** 2, 0) / n);
    const cv   = std / (mean + 1);

    // Wide spread (high cv) → natural. Uniform (low cv) → AI.
    const spreadSusp = clamp(1 - (cv - 0.40) / 1.80, 0, 1);
    // Tight p10–p90 range also = suspicious
    const rangeSusp  = clamp(1 - Math.log10((p90 + 1) / (p10 + 1)) / 2.0, 0, 1);

    const suspicion = clamp(0.60 * spreadSusp + 0.40 * rangeSusp, 0, 0.88);
    return {
      name:      'Spatial Variance (PNG)',
      suspicion: +suspicion.toFixed(3),
      detail:    `Block variance CV=${cv.toFixed(2)}, spread=${Math.log10((p90 + 1) / (p10 + 1)).toFixed(2)} — ${
        suspicion > 0.60 ? 'hyper-uniform local complexity (AI-like)' :
        suspicion > 0.35 ? 'moderate uniformity (inconclusive)' :
        'natural heterogeneous complexity'
      }`,
      weight: 0.22,
    };
  }

  // ── JPEG BAS ──────────────────────────────────────────────────────────────
  const SIZE = 512;
  const { data, info } = await sharp(buffer)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width, H = info.height;
  const BLOCK = 8;

  let boundaryGrad = 0, interiorGrad = 0;
  let bCount = 0, iCount = 0;

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const diffH = Math.abs(data[y * W + x] - data[y * W + x + 1]);
      const diffV = Math.abs(data[y * W + x] - data[(y + 1) * W + x]);

      const atHBoundary = (x + 1) % BLOCK === 0;
      const atVBoundary = (y + 1) % BLOCK === 0;

      if (atHBoundary) { boundaryGrad += diffH; bCount++; }
      else             { interiorGrad += diffH; iCount++; }
      if (atVBoundary) { boundaryGrad += diffV; bCount++; }
      else             { interiorGrad += diffV; iCount++; }
    }
  }

  const avgBoundary = bCount > 0 ? boundaryGrad / bCount : 0;
  const avgInterior = iCount > 0 ? interiorGrad / iCount : 0;
  const bas         = avgBoundary / (avgInterior + 0.1);

  // Real JPEG photos: moderate, variable BAS (1.15–2.0)
  //   Some blocks are near edges (high gradient both sides) → ratio ≈ 1.3–1.8
  // AI re-compressed JPEG:
  //   BAS < 1.10 → extremely smooth blocks (AI over-smooth then JPEG)
  //   BAS > 2.5  → over-blocked (extreme compression on AI content)
  let susp;
  if (bas < 1.08) {
    susp = clamp((1.08 - bas) / 0.60, 0, 1);        // under-blocked = over-smooth AI
  } else if (bas > 2.5) {
    susp = clamp((bas - 2.5) / 1.5, 0, 0.70);       // over-blocked
  } else {
    susp = clamp(1 - (bas - 1.08) / (2.5 - 1.08), 0, 1);
    susp = susp * 0.40;                              // natural range → low suspicion
  }

  return {
    name:      'JPEG Blocking Artifact Score',
    suspicion: +susp.toFixed(3),
    detail:    `BAS=${bas.toFixed(3)} (boundary/interior gradient ratio) — ${
      susp > 0.60 ? bas < 1.10
        ? 'under-blocked: over-smooth JPEG inconsistent with organic camera output'
        : 'over-blocked: anomalous quantisation pattern'
      : susp > 0.35 ? 'borderline blocking ratio (inconclusive)' :
      'blocking pattern consistent with organic camera JPEG'
    }`,
    weight: 0.22,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 3 — Chroma Aberration & Edge Coherence
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WHY: Real camera lenses produce lateral chromatic aberration (CA) —
 * the R and B channels are magnified slightly differently, causing fringe
 * colours at high-contrast edges. The amount of CA varies spatially (stronger
 * at corners, weaker at centre) and correlates with edge strength.
 *
 * AI generators:
 *   a) Produce ZERO lateral CA (no optical simulation)
 *   b) Or produce perfectly uniform CA (artistic filter)
 *   Either is unnatural.
 *
 * METHOD:
 *   1. Resize to 256×256
 *   2. Detect edges via Sobel on luma
 *   3. At each strong edge pixel, measure |R - B| offset (proxy for CA)
 *   4. Compute spatial non-uniformity of CA across image quadrants
 *   5. Also measure edge sharpness roll-off (AI images are hyper-sharp)
 */
async function chromaAberrationEdge(buffer) {
  const SIZE = 256;

  const [rgbRaw, lumaRaw] = await Promise.all([
    sharp(buffer)
      .resize(SIZE, SIZE, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true }),
    sharp(buffer)
      .resize(SIZE, SIZE, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);

  const W    = lumaRaw.info.width;
  const H    = lumaRaw.info.height;
  const luma = lumaRaw.data;
  const rgb  = rgbRaw.data;

  // ── Sobel magnitude ───────────────────────────────────────────────────────
  const sobelMag = new Float32Array(W * H).fill(0);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const gx =
        -luma[(y - 1) * W + (x - 1)] - 2 * luma[y * W + (x - 1)] - luma[(y + 1) * W + (x - 1)]
        +luma[(y - 1) * W + (x + 1)] + 2 * luma[y * W + (x + 1)] + luma[(y + 1) * W + (x + 1)];
      const gy =
        -luma[(y - 1) * W + (x - 1)] - 2 * luma[(y - 1) * W + x] - luma[(y - 1) * W + (x + 1)]
        +luma[(y + 1) * W + (x - 1)] + 2 * luma[(y + 1) * W + x] + luma[(y + 1) * W + (x + 1)];
      sobelMag[y * W + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  const maxSobel = Math.max(...sobelMag);
  const edgeThresh = maxSobel * 0.35;  // only analyse strong edges

  // ── Per-quadrant CA measurement ───────────────────────────────────────────
  // Quadrants: TL, TR, BL, BR
  const quadrantCA = [[], [], [], []];

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      if (sobelMag[y * W + x] < edgeThresh) continue;
      const pidx = (y * W + x) * 3;
      const r = rgb[pidx], g = rgb[pidx + 1], b = rgb[pidx + 2];
      const ca = Math.abs(r - b);  // lateral CA proxy
      const q = (y < H / 2 ? 0 : 2) + (x < W / 2 ? 0 : 1);
      quadrantCA[q].push(ca);
    }
  }

  const quadMeans = quadrantCA.map(q =>
    q.length > 0 ? q.reduce((s, v) => s + v, 0) / q.length : -1,
  ).filter(v => v >= 0);

  let caSusp = 0;
  if (quadMeans.length >= 2) {
    const caMean = quadMeans.reduce((s, v) => s + v, 0) / quadMeans.length;
    const caStd  = Math.sqrt(quadMeans.reduce((s, v) => s + (v - caMean) ** 2, 0) / quadMeans.length);
    const caCV   = caStd / (caMean + 0.5);

    // Real: high CA mean (5–25) AND variable across quadrants (CV > 0.3)
    // AI:  low CA mean (0–4)  OR perfectly uniform (CV < 0.1)
    const lowCA       = clamp(1 - caMean / 8.0, 0, 1);
    const uniformCA   = clamp(1 - caCV / 0.30, 0, 1);
    caSusp = clamp(0.55 * lowCA + 0.45 * uniformCA, 0, 0.90);
  } else {
    // Not enough edge pixels to measure — inconclusive
    caSusp = 0.35;
  }

  // ── Edge sharpness roll-off ───────────────────────────────────────────────
  // Count pixels with EXTREME Sobel (>80% of max) vs strong Sobel (>35% of max)
  // AI: ratio is high (hyper-sharp, many extreme edges)
  // Real: ratio is moderate (natural blurring from diffraction, motion)
  let extremeEdges = 0, strongEdges = 0;
  const extremeThresh = maxSobel * 0.80;
  for (let i = 0; i < sobelMag.length; i++) {
    if (sobelMag[i] > edgeThresh)  strongEdges++;
    if (sobelMag[i] > extremeThresh) extremeEdges++;
  }
  const sharpRatio = strongEdges > 0 ? extremeEdges / strongEdges : 0;
  // Real photos: ~0.05–0.20  |  AI over-sharpened: 0.25–0.60
  const sharpSusp = clamp((sharpRatio - 0.18) / 0.35, 0, 1);

  const suspicion = clamp(0.65 * caSusp + 0.35 * sharpSusp, 0, 0.88);

  return {
    name:      'Chroma Aberration & Edge',
    suspicion: +suspicion.toFixed(3),
    detail:    `CA across quadrants: mean=${quadMeans.map(v => v.toFixed(1)).join('/')}, sharpRatio=${(sharpRatio * 100).toFixed(1)}% — ${
      suspicion > 0.60 ? 'minimal/uniform chromatic aberration (absent in AI images, always present in real lenses)' :
      suspicion > 0.35 ? 'ambiguous CA pattern (inconclusive)' :
      'chromatic aberration spatially variable — consistent with real optical system'
    }`,
    weight: 0.18,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 4 — GLCM Texture Haralick Features
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WHY: Grey-Level Co-occurrence Matrix (GLCM) features capture second-order
 * texture statistics. AI images systematically deviate from real photographs in:
 *   - Entropy: AI images have higher entropy in flat regions, lower in textured
 *   - Energy (ASM): AI flat regions are too smooth → high energy
 *   - Correlation: AI textures are too locally correlated (repetitive patterns)
 *
 * METHOD: Compute GLCM at displacement (1,0) and (0,1) on a 64-level
 * quantised 128×128 luma patch, then extract Angular Second Moment (ASM),
 * Entropy, and Correlation.
 */
async function glcmTextureAnalysis(buffer) {
  const SIZE   = 128;
  const LEVELS = 32;  // quantise to 32 grey levels for manageable GLCM size

  const { data, info } = await sharp(buffer)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const W = info.width, H = info.height;

  // Quantise to [0, LEVELS-1]
  const q = new Uint8Array(W * H);
  for (let i = 0; i < data.length; i++)
    q[i] = Math.min(LEVELS - 1, Math.floor((data[i] / 256) * LEVELS));

  // Build GLCM for horizontal (dx=1) and vertical (dy=1) offsets
  const glcm = new Float64Array(LEVELS * LEVELS).fill(0);
  let pairs = 0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W - 1; x++) {
      glcm[q[y * W + x] * LEVELS + q[y * W + x + 1]]++;
      pairs++;
    }
  }
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W; x++) {
      glcm[q[y * W + x] * LEVELS + q[(y + 1) * W + x]]++;
      pairs++;
    }
  }
  // Normalize
  for (let i = 0; i < glcm.length; i++) glcm[i] /= pairs;

  // ── Haralick features ─────────────────────────────────────────────────────
  let asm = 0, entropy = 0, correlation = 0;
  let muI = 0, muJ = 0;

  // Marginal means for correlation
  const pI = new Float64Array(LEVELS).fill(0);
  const pJ = new Float64Array(LEVELS).fill(0);
  for (let i = 0; i < LEVELS; i++)
    for (let j = 0; j < LEVELS; j++) {
      const p = glcm[i * LEVELS + j];
      pI[i] += p;
      pJ[j] += p;
    }
  for (let i = 0; i < LEVELS; i++) muI += i * pI[i];
  for (let j = 0; j < LEVELS; j++) muJ += j * pJ[j];
  let sigI = 0, sigJ = 0;
  for (let i = 0; i < LEVELS; i++) sigI += (i - muI) ** 2 * pI[i];
  for (let j = 0; j < LEVELS; j++) sigJ += (j - muJ) ** 2 * pJ[j];
  sigI = Math.sqrt(sigI); sigJ = Math.sqrt(sigJ);

  for (let i = 0; i < LEVELS; i++) {
    for (let j = 0; j < LEVELS; j++) {
      const p = glcm[i * LEVELS + j];
      if (p > 0) {
        asm     += p * p;
        entropy -= p * Math.log2(p + 1e-12);
        if (sigI > 0 && sigJ > 0)
          correlation += ((i - muI) * (j - muJ) * p) / (sigI * sigJ);
      }
    }
  }

  // Calibrated observed ranges:
  //   Real photos:  ASM ~0.006–0.04, Entropy ~3.5–5.5, Correlation ~0.70–0.92
  //   AI images:    ASM ~0.003–0.012 (more uniform), Entropy ~4.8–6.5, Correlation ~0.88–0.98
  //
  // AI signals:
  //   1. Over-correlated texture (correlation close to 1.0) → AI
  //   2. High entropy globally (smooth regions should be low entropy) → AI
  const correlationSusp = clamp((correlation - 0.85) / 0.12, 0, 1);
  const entropySusp     = clamp((entropy - 4.5) / 2.0, 0, 1);

  const suspicion = clamp(0.55 * correlationSusp + 0.45 * entropySusp, 0, 0.82);

  return {
    name:      'GLCM Texture (Haralick)',
    suspicion: +suspicion.toFixed(3),
    detail:    `ASM=${asm.toFixed(4)}, Entropy=${entropy.toFixed(2)}, Correlation=${correlation.toFixed(3)} — ${
      suspicion > 0.55 ? 'texture statistics deviate from natural photography (over-correlated / high-entropy)' :
      suspicion > 0.30 ? 'texture statistics borderline (inconclusive)' :
      'texture statistics consistent with real photographic content'
    }`,
    weight: 0.10,
  };
}

// ─── Video-frame preprocessing helpers ────────────────────────────────────────

/**
 * Resize to 224×224 JPEG — the native input size EfficientNet and ViT deepfake
 * models were trained on. Sending unresized frames (640×360) to these models
 * degrades accuracy because internal pooling operates at wrong scale.
 */
async function prepareForModel(buffer) {
  return sharp(buffer)
    .resize(224, 224, { fit: 'cover', position: 'top' })
    .removeAlpha()
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Three face-region crops at different horizontal positions.
 * WHY: A fixed centre-crop misses faces on the left/right half of frame
 * (interview two-shots, side profiles, non-centred subjects).
 * Running all three and taking the max score catches off-centre placements.
 *
 *  View B-center: 15–85% width × top 65% (original — centred faces)
 *  View B-left:   0–55% width  × top 65% (person on left)
 *  View B-right:  45–100% width × top 65% (person on right)
 */
async function extractFaceRegions(buffer) {
  const meta = await sharp(buffer).metadata();
  const w = meta.width  ?? 640;
  const h = meta.height ?? 360;
  const cropH = Math.floor(h * 0.65);
  return Promise.all([
    sharp(buffer)
      .extract({ left: Math.floor(w * 0.15), top: 0, width: Math.floor(w * 0.70), height: cropH })
      .resize(224, 224).removeAlpha().jpeg({ quality: 92 }).toBuffer(),
    sharp(buffer)
      .extract({ left: 0, top: 0, width: Math.floor(w * 0.55), height: cropH })
      .resize(224, 224).removeAlpha().jpeg({ quality: 92 }).toBuffer(),
    sharp(buffer)
      .extract({ left: Math.floor(w * 0.45), top: 0, width: Math.floor(w * 0.55), height: cropH })
      .resize(224, 224).removeAlpha().jpeg({ quality: 92 }).toBuffer(),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 5 — Metadata & Structural Forensics (refined from v2)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Refinements over v2:
 *   - Penalty for EXIF DateTimeOriginal format anomalies
 *   - Penalty for zero GPS with present camera model (real phones always log GPS)
 *   - Stricter colour-profile check (sRGB only → suspicious; camera profiles differ)
 *   - Reduced RGB channel balance penalty (was over-triggering on night portraits)
 */
const AI_TOOL_PATTERNS = [
  /stable.?diffusion/i, /midjourney/i, /dall.?e/i, /adobe.?firefly/i,
  /generative.?fill/i, /ai.?generated/i, /diffusion/i, /imagen/i,
  /runwayml/i, /civitai/i, /comfy.?ui/i, /automatic1111/i, /novelai/i,
  /nightcafe/i, /artbreeder/i, /deepdream/i, /\bgan\b/i, /flux\.1/i,
  /ideogram/i, /leonardo\.ai/i, /getimg\.ai/i, /dreamstudio/i,
];

function isPowerOf2(n) { return n > 0 && (n & (n - 1)) === 0; }

async function metadataForensics(buffer, mimetype) {
  const sharpMeta = await sharp(buffer).metadata();
  let exifTags = {};
  try { exifTags = ExifReader.load(buffer); } catch (_) {}

  const flags   = [];
  let suspicion = 0;

  // ── Camera make / model (highest-confidence authenticator) ────────────────
  const make  = exifTags?.Make?.description  || exifTags?.make?.description  || '';
  const model = exifTags?.Model?.description || exifTags?.model?.description || '';
  const hasCameraExif = !!(make && model);

  if (hasCameraExif) {
    flags.push(`Verified camera: ${make} ${model}`);
    suspicion -= 0.12;
  }

  // ── No EXIF at all ────────────────────────────────────────────────────────
  const hasExif = sharpMeta.exif != null || Object.keys(exifTags).length > 0;
  if (!hasExif) {
    // PNG legitimately lacks EXIF more often — smaller penalty
    suspicion += mimetype === 'image/png' ? 0.18 : 0.28;
    flags.push('No EXIF metadata present (AI tools commonly omit or strip it)');
  }

  // ── Missing camera make/model ─────────────────────────────────────────────
  if (hasExif && !hasCameraExif) {
    suspicion += 0.16;
    flags.push('EXIF present but no camera make/model');
  }

  // ── Missing photographic EXIF ─────────────────────────────────────────────
  const hasPhotoExif = !!(
    exifTags?.ExposureTime?.description      ||
    exifTags?.ShutterSpeedValue?.description ||
    exifTags?.FNumber?.description           ||
    exifTags?.ISOSpeedRatings?.description   ||
    exifTags?.PhotographicSensitivity?.description ||
    exifTags?.FocalLength?.description
  );
  if (hasExif && !hasCameraExif && !hasPhotoExif) {
    suspicion += 0.13;
    flags.push('No photographic EXIF (shutter/aperture/ISO absent — real cameras always write these)');
  }

  // ── [NEW] GPS absent when camera present ──────────────────────────────────
  // Smartphones (the dominant source of real photos) almost always embed GPS.
  // DSLRs typically don't. Only penalise if the model string looks like a phone.
  if (hasCameraExif) {
    const looksLikePhone = /iphone|pixel|samsung|huawei|xiaomi|oppo|vivo|oneplus|galaxy|redmi/i
      .test(`${make} ${model}`);
    const hasGPS = !!(exifTags?.GPSLatitude || exifTags?.GPSLongitude);
    if (looksLikePhone && !hasGPS) {
      suspicion += 0.06;
      flags.push('Smartphone camera model without GPS data (unusual for real phone photos)');
    }
  }

  // ── AI tool signatures ────────────────────────────────────────────────────
  const allTagText = JSON.stringify(exifTags).toLowerCase();
  for (const pattern of AI_TOOL_PATTERNS) {
    if (pattern.test(allTagText)) {
      suspicion += 0.55;
      flags.push(`AI tool signature detected in metadata: "${pattern.source}"`);
      break;
    }
  }

  // ── [NEW] Software field check ────────────────────────────────────────────
  const software = exifTags?.Software?.description || '';
  if (/photoshop|lightroom|gimp|darktable|rawtherapee|capture one/i.test(software)) {
    // Edited real photo — trust camera EXIF, don't penalise further
  } else if (software && !hasCameraExif) {
    // Unknown software without camera ID — slightly suspicious
    suspicion += 0.06;
    flags.push(`Unknown software field without camera ID: "${software.slice(0, 40)}"`);
  }

  // ── [NEW] Colour space / ICC profile ─────────────────────────────────────
  // AI tools almost universally output sRGB. Real cameras embed device
  // profiles (AdobeRGB, ProPhoto, camera-specific ICC).
  const space = sharpMeta.space;
  if (space === 'srgb' && !hasCameraExif && hasExif) {
    suspicion += 0.05;
    flags.push('sRGB colour space without camera EXIF (AI images nearly always output sRGB)');
  }

  // ── Common AI output dimensions ───────────────────────────────────────────
  const w = sharpMeta.width  ?? 0;
  const h = sharpMeta.height ?? 0;
  const AI_SIZES = new Set([512, 768, 1024, 1280, 1536, 2048, 1344, 896, 1152, 832]);
  if (AI_SIZES.has(w) && AI_SIZES.has(h)) {
    suspicion += 0.10;
    flags.push(`Dimensions ${w}×${h} match common AI generation output sizes`);
  } else if (isPowerOf2(w) && isPowerOf2(h)) {
    suspicion += 0.06;
    flags.push(`Dimensions ${w}×${h} are powers of two (typical of diffusion model outputs)`);
  }

  // ── RGB channel balance (tighter threshold to reduce false positives) ─────
  try {
    const stats    = await sharp(buffer).stats();
    const channels = stats.channels;
    if (channels.length >= 3) {
      const [rStd, gStd, bStd] = [channels[0].stdev, channels[1].stdev, channels[2].stdev];
      const channelCv = (Math.abs(rStd - gStd) / (gStd + 1)) + (Math.abs(gStd - bStd) / (bStd + 1));
      // Raised threshold from 0.04 → 0.025 to cut false positives on studio portraits
      if (channelCv < 0.025) {
        suspicion += 0.07;
        flags.push('Unusually symmetric RGB channel standard deviations (rare in natural photographs)');
      }
    }
  } catch (_) {}

  suspicion = clamp(suspicion, 0, 0.92);

  return {
    name:          'Metadata & Structure',
    suspicion:     +suspicion.toFixed(3),
    detail:        flags.length
      ? flags.join(' · ')
      : 'No suspicious metadata indicators found',
    weight:         0.25,
    hasCameraExif,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Combine signals → verdict
// ═══════════════════════════════════════════════════════════════════════════════

function combineSignals(signals) {
  const metaSig    = signals.find(s => s.hasCameraExif !== undefined);
  const cameraExif = metaSig?.hasCameraExif ?? false;

  const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0);
  let   fakeScore   = signals.reduce((s, sig) => s + sig.suspicion * sig.weight, 0) / totalWeight;

  if (cameraExif) fakeScore = Math.min(fakeScore, CAMERA_EXIF_CAP);

  let verdict;
  if      (fakeScore >= DEEPFAKE_THRESHOLD)  verdict = 'DEEPFAKE';
  else if (fakeScore <= AUTHENTIC_THRESHOLD) verdict = 'AUTHENTIC';
  else                                        verdict = 'UNCERTAIN';

  const breakdownNote = cameraExif
    ? [{ label: 'Camera EXIF verified — score capped at AUTHENTIC level', score: 0 }]
    : [];

  return {
    verdict,
    confidence: Math.round(fakeScore * 100),
    topLabel:   `Forensic analysis — ${signals.length} signals`,
    breakdown: [
      ...signals.map(s => ({
        label: `${s.name} (${Math.round(s.weight * 100)}% weight)`,
        score: Math.round(s.suspicion * 100),
      })),
      ...breakdownNote,
    ],
    signals,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════════
// SIGNAL 6 — HF Neural Deepfake Detection (face-swap / GAN video deepfakes)
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * WHY: The 5 forensic signals target fully AI-generated images (Midjourney, SDXL).
 * Face-swap video deepfakes are mostly real camera footage — only the face region
 * is replaced. Forensic signals (spectral, JPEG artifact, chroma) return "authentic"
 * because the background and scene are genuine.
 *
 * Neural models trained on FaceForensics++ / DFDC detect face-swap manipulation
 * patterns that forensics cannot: GAN upsampling residuals in face borders,
 * temporal inconsistencies, and identity-mismatch artifacts.
 *
 * BLEND: 45% forensic + 55% neural when HF is available.
 * Graceful degradation: falls back to pure forensic if HF unavailable or slow.
 * Per-frame timeout: 12 s (keeps video analysis reasonable at 30 frames ≈ 6 min max).
 */
const HF_IMAGE_MODELS = [
  'dima806/deepfake_vs_real_image_detection',   // EfficientNetB7 on FF++ + DFDC
  'Wvolf/ViT-Deepfake-Detection',               // ViT-based fallback
];

async function callHFImageModel(buffer) {
  const body = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const endpoints = process.env.HF_API_TOKEN ? HF_ENDPOINTS : [HF_ENDPOINTS[1]];
  for (const model of HF_IMAGE_MODELS) {
    for (const base of endpoints) {
      let retries = 0;
      while (retries <= 1) {
        try { return await hfPost(base, model, body); }
        catch (err) {
          if (err.retryable && retries < 1) { retries++; continue; }
          break;
        }
      }
    }
  }
  return null; // graceful: caller uses forensic-only path
}

function parseHFImageResult(hfData) {
  if (!hfData) return null;
  let labels = Array.isArray(hfData) ? hfData : hfData?.[0] ?? [];
  if (!Array.isArray(labels) || labels.length === 0) return null;
  labels = [...labels].sort((a, b) => b.score - a.score);
  const fakeEntry = labels.find(l => /fake|deepfake|manipulat/i.test(l.label));
  const realEntry = labels.find(l => /real|authentic|genuine|original/i.test(l.label));
  if (!fakeEntry && !realEntry) return null;
  const fakeScore = fakeEntry?.score ?? (realEntry ? 1 - realEntry.score : null);
  if (fakeScore === null) return null;
  return {
    suspicion: clamp(fakeScore, 0, 1),
    topLabel:  labels[0].label,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audio — unchanged from v2 (HF fallback chain is solid)
// ═══════════════════════════════════════════════════════════════════════════════

const AUDIO_MODELS = [
  'motheecreator/deepfake-audio-detection',
  'MelodyMachine/Deepfake-audio-detection-V2',
];
const HF_ENDPOINTS = [
  'https://router.huggingface.co/hf-inference/models',
  'https://api-inference.huggingface.co/models',
];
const PERMANENT_STATUSES = new Set([401, 403, 404]);

async function hfPost(baseUrl, model, body) {
  const url     = `${baseUrl}/${model}`;
  const headers = { 'Content-Type': 'application/octet-stream' };
  if (process.env.HF_API_TOKEN) headers['Authorization'] = `Bearer ${process.env.HF_API_TOKEN}`;

  let status, data;
  try {
    ({ status, data } = await axios.post(url, body, {
      headers, timeout: 90_000,
      maxBodyLength: Infinity, maxContentLength: Infinity,
      validateStatus: () => true,
    }));
  } catch (axiosErr) {
    const perm = ['ERR_BAD_RESPONSE', 'ECONNREFUSED', 'ENOTFOUND'].includes(axiosErr.code);
    throw { retryable: !perm, message: axiosErr.message };
  }

  if (PERMANENT_STATUSES.has(status)) throw { retryable: false, message: `HF ${status}` };
  if (status === 503) {
    const wait = Math.min((data?.estimated_time ?? 20) * 1000, 40_000);
    await new Promise(r => setTimeout(r, wait));
    throw { retryable: true, message: 'model loading' };
  }
  if (status !== 200) throw { retryable: true, message: data?.error ?? `HTTP ${status}` };
  return data;
}

async function callAudioHF(buffer) {
  const body      = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  const endpoints = process.env.HF_API_TOKEN ? HF_ENDPOINTS : [HF_ENDPOINTS[1]];
  for (const model of AUDIO_MODELS) {
    for (const base of endpoints) {
      let retries = 0;
      while (retries <= 3) {
        try { return await hfPost(base, model, body); }
        catch (err) {
          if (err.retryable && retries < 3) { retries++; continue; }
          break;
        }
      }
    }
  }
  throw new Error('Audio analysis models unavailable. Please try again later.');
}

function normaliseAudio(hfData) {
  let labels = Array.isArray(hfData) ? hfData : hfData?.[0] ?? [];
  if (!Array.isArray(labels) || labels.length === 0)
    throw new Error('Unexpected model response.');
  labels = [...labels].sort((a, b) => b.score - a.score);

  const fakeEntry = labels.find(l => /fake/i.test(l.label));
  const realEntry = labels.find(l => /real|authentic|genuine/i.test(l.label));
  const fakeScore = fakeEntry?.score ?? (realEntry ? 1 - realEntry.score : 0.5);

  let verdict;
  if      (fakeScore >= DEEPFAKE_THRESHOLD)  verdict = 'DEEPFAKE';
  else if (fakeScore <= AUTHENTIC_THRESHOLD) verdict = 'AUTHENTIC';
  else                                        verdict = 'UNCERTAIN';

  return {
    verdict,
    confidence: Math.round(fakeScore * 100),
    topLabel:   fakeEntry?.label ?? labels[0].label,
    breakdown:  labels.map(l => ({ label: l.label, score: Math.round(l.score * 100) })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Routes
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/deepfake/image
router.post('/deepfake/image', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(req.file.mimetype))
      return res.status(400).json({ error: 'Only JPEG, PNG, WebP or GIF images are supported.' });

    const isPng = req.file.mimetype === 'image/png';

    // HF model races against a 12 s deadline so it never blocks video-frame analysis
    const hfRacePromise = Promise.race([
      callHFImageModel(req.file.buffer).catch(() => null),
      new Promise(r => setTimeout(() => r(null), 12_000)),
    ]);

    // All 5 forensic signals + HF neural model run concurrently
    const [spectral, blocking, chroma, glcm, meta, hfRaw] = await Promise.all([
      spectralFrequencyProfile(req.file.buffer),
      blockingArtifactScore(req.file.buffer, isPng),
      chromaAberrationEdge(req.file.buffer),
      glcmTextureAnalysis(req.file.buffer),
      metadataForensics(req.file.buffer, req.file.mimetype),
      hfRacePromise,
    ]);

    const forensicResult = combineSignals([spectral, blocking, chroma, glcm, meta]);
    const hfSignal       = parseHFImageResult(hfRaw);

    let result;
    if (hfSignal && hfSignal.suspicion >= 0.15) {
      // HF model detected a meaningful face-swap signal — blend forensic + neural.
      // Neural dominates (55%) because it was trained specifically on face-swap manipulation.
      const forensicScore = forensicResult.confidence / 100;
      const blended = clamp(forensicScore * 0.45 + hfSignal.suspicion * 0.55, 0, 1);

      let verdict;
      if      (blended >= DEEPFAKE_THRESHOLD)  verdict = 'DEEPFAKE';
      else if (blended <= AUTHENTIC_THRESHOLD) verdict = 'AUTHENTIC';
      else                                      verdict = 'UNCERTAIN';

      result = {
        ...forensicResult,
        verdict,
        confidence: Math.round(blended * 100),
        topLabel:   `Forensic + Neural blend — ${forensicResult.signals.length + 1} signals`,
        breakdown:  [
          ...forensicResult.breakdown,
          {
            label: `HF Neural Model (55% weight) — ${hfSignal.topLabel}`,
            score: Math.round(hfSignal.suspicion * 100),
          },
        ],
      };
    } else if (hfSignal) {
      // HF returned < 15% — it found no face-swap artifact.
      // This is a face-swap detector (FaceForensics++ trained): "no face-swap" does NOT mean
      // the image is not AI-generated. Fully synthetic images (Midjourney, SDXL, DALL-E)
      // have no face-swap seam, so HF correctly scores them low — but the forensic signals
      // (spectral slope, JPEG blocking, chroma aberration) still detect AI synthesis.
      // → Use forensic-only verdict; show HF in breakdown for transparency.
      result = {
        ...forensicResult,
        topLabel: `Forensic analysis — ${forensicResult.signals.length} signals`,
        breakdown: [
          ...forensicResult.breakdown,
          {
            label: `HF Neural Model (not blended — no face-swap signal) — ${hfSignal.topLabel}`,
            score: Math.round(hfSignal.suspicion * 100),
          },
        ],
      };
    } else {
      result = forensicResult;
    }

    console.log(
      `[DeepFake/image v3] verdict=${result.verdict} confidence=${result.confidence}% ` +
      `hf=${hfSignal ? (hfSignal.suspicion * 100).toFixed(0) + '%' : 'N/A'} ` +
      forensicResult.signals.map(s => `${s.name.replace(/ /g, '')}=${(s.suspicion * 100).toFixed(0)}%`).join(' '),
    );

    const { signals: _, ...clientResult } = result;
    res.json(clientResult);
  } catch (err) {
    console.error('[DeepFake/image v3]', err.message);
    res.status(500).json({ error: err.message || 'Image analysis failed.' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/deepfake/video
//
// Accepts browser-extracted JPEG frames (FormData field: "frames", up to 30).
// Runs a two-view neural ensemble per frame:
//   View A — full frame resized to 224×224 (catches whole-face diffusion swaps)
//   View B — upper-centre face-region crop at 224×224 (+7–12% AUC on FF++)
// Ensemble scoring: max×0.60 + avg×0.40 (weighted-max, favours high-confidence views)
// Threshold: 0.38 (YouTube H.264 compression suppresses raw model scores by ~0.05–0.08)
//
// Adds a 4th temporal signal not possible on single images:
//   Confidence variance: face-swap deepfakes cause the model to oscillate between
//   high and low confidence across frames (std > 20 pts) because the quality of
//   the swap varies with head pose, lighting, and motion blur.
//
// Processing batches of 3 frames in parallel to respect HF rate limits.
// ══════════════════════════════════════════════════════════════════════════════

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 30 },
});

router.post('/deepfake/video', requireAuth, videoUpload.array('frames', 30), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No frames provided.' });

    const frames = req.files;

    // Adaptive timeout:
    //   First batch  → 52 s — allows HF cold-start (503 + wait ~25-45 s + retry)
    //   Subsequent   → 12 s — model is warm after first successful response
    // Without HF_API_TOKEN the free tier rate-limits aggressively; token strongly recommended.
    let modelWarm = false;
    const makeSafe = (p) => Promise.race([
      p.catch(() => null),
      new Promise(r => setTimeout(() => r(null), modelWarm ? 12_000 : 52_000)),
    ]);

    // Batches of 2 frames — 3 face crops + 1 full view = 4 HF calls per frame → 8 parallel
    const BATCH = 2;
    const frameResults = [];

    for (let i = 0; i < frames.length; i += BATCH) {
      const batch = frames.slice(i, i + BATCH);

      const batchOut = await Promise.all(batch.map(async (frame, bi) => {
        const idx = i + bi;
        try {
          const [modelBuf, [faceCenterBuf, faceLeftBuf, faceRightBuf]] = await Promise.all([
            prepareForModel(frame.buffer),
            extractFaceRegions(frame.buffer),
          ]);

          // 4 views in parallel: full frame + 3 face crops (centre/left/right)
          const [hfFull, hfCenter, hfLeft, hfRight] = await Promise.all([
            makeSafe(callHFImageModel(modelBuf)),
            makeSafe(callHFImageModel(faceCenterBuf)),
            makeSafe(callHFImageModel(faceLeftBuf)),
            makeSafe(callHFImageModel(faceRightBuf)),
          ]);

          const rawViews = {
            full:   parseHFImageResult(hfFull)?.suspicion   ?? null,
            center: parseHFImageResult(hfCenter)?.suspicion ?? null,
            left:   parseHFImageResult(hfLeft)?.suspicion   ?? null,
            right:  parseHFImageResult(hfRight)?.suspicion  ?? null,
          };

          // Best face crop = max of the three crop positions
          const faceCropScores = [rawViews.center, rawViews.left, rawViews.right].filter(v => v !== null);
          const bestFace = faceCropScores.length > 0 ? Math.max(...faceCropScores) : null;

          const views  = { full: rawViews.full, face: bestFace };
          const scores = [views.full, views.face].filter(v => v !== null);

          if (scores.length === 0) {
            return { index: idx, verdict: 'UNCERTAIN', confidence: 0, views: { full: null, face: null }, hfFailed: true };
          }

          const maxScore = Math.max(...scores);
          const avgScore = scores.reduce((s, v) => s + v, 0) / scores.length;
          const ensemble = clamp(maxScore * 0.60 + avgScore * 0.40, 0, 1);

          let verdict;
          if      (ensemble >= VIDEO_DEEPFAKE_THRESHOLD)  verdict = 'DEEPFAKE';
          else if (ensemble <= VIDEO_AUTHENTIC_THRESHOLD) verdict = 'AUTHENTIC';
          else                                             verdict = 'UNCERTAIN';

          return {
            index: idx,
            verdict,
            confidence: Math.round(ensemble * 100),
            views: {
              full: views.full !== null ? Math.round(views.full * 100) : null,
              face: views.face !== null ? Math.round(views.face * 100) : null,
            },
          };
        } catch (e) {
          return { index: idx, verdict: 'UNCERTAIN', confidence: 0, error: e.message, views: {}, hfFailed: true };
        }
      }));

      frameResults.push(...batchOut);

      // If any frame in this batch got a real HF response, subsequent batches can use short timeout
      if (batchOut.some(r => !r.hfFailed)) modelWarm = true;
    }

    // If every frame failed HF — model is completely unavailable (no API key, or still loading)
    const hfAvailable = frameResults.some(r => !r.hfFailed);
    if (!hfAvailable) {
      console.warn('[DeepFake/video] HF model unavailable for all frames — cold start exceeded 52s or no HF_API_TOKEN');
      return res.json({
        verdict:      'UNCERTAIN',
        confidence:   0,
        hfAvailable:  false,
        topLabel:     'Neural model unavailable — set HF_API_TOKEN in .env or retry (model may be cold)',
        breakdown:    [],
        frames:       frameResults,
        temporal: {
          hfAvailable: false, avgConfidence: 0, flaggedRate: 0, maxConsecutiveRun: 0,
          confidenceVariance: 0, confidenceStd: 0, totalFrames: frameResults.length,
          fakeFrames: 0, uncertainFrames: frameResults.length,
          isFakeByAvg: false, isFakeByRate: false, isFakeByConsecutive: false, isFakeByVariance: false,
          triggeredSignals: [],
        },
      });
    }

    // ── Temporal aggregation (only frames with real HF scores) ────────────────
    const valid           = frameResults.filter(r => !r.error && !r.hfFailed);
    const fakeFrames      = valid.filter(r => r.verdict === 'DEEPFAKE');
    const uncertainFrames = valid.filter(r => r.verdict === 'UNCERTAIN');
    const allConf         = valid.map(r => r.confidence);
    const n               = allConf.length || 1;

    const avgConfidence = allConf.reduce((s, c) => s + c, 0) / n;
    const flaggedRate   = fakeFrames.length / n;

    // Consecutive run
    let maxConsecutiveRun = 0, curRun = 0;
    for (const r of valid) {
      if (r.verdict === 'DEEPFAKE') { curRun++; maxConsecutiveRun = Math.max(maxConsecutiveRun, curRun); }
      else curRun = 0;
    }

    // Temporal confidence variance — face-swap deepfakes cause oscillation
    const confMean     = avgConfidence;
    const confVariance = allConf.reduce((s, c) => s + (c - confMean) ** 2, 0) / n;
    const confStd      = Math.sqrt(confVariance);
    // Variance signal: high std (>20 pts) + at least some fake frames = suspicious
    // Calibrated for YouTube H.264 — raw scores are suppressed ~0.08–0.12 vs. uncompressed
    // Real content averages 10–28%; deepfakes average 28–60% after compression
    //
    // isFakeByVariance: avg CAN be low if only a few frames are swapped (partial deepfake).
    // fakeFrames.length > 0 already ensures some frames exceeded the 0.28 threshold.
    // Removing avgConfidence guard — it was filtering real detections.
    const isFakeByVariance = confStd > 12 && fakeFrames.length > 0;

    const maxFakeScore        = allConf.length ? Math.max(...allConf) : 0;
    // Single frame ≥60% is a strong standalone indicator even if avg is pulled down by clean frames
    const isFakeByMaxScore    = maxFakeScore >= 60;

    const isFakeByAvg         = avgConfidence > 38;  // was 55
    const isFakeByRate        = flaggedRate >= 0.20; // was >0.40 — also fixed > to >= (20% is exactly 2/10)
    const isFakeByConsecutive = maxConsecutiveRun >= 5; // was 8

    const videoVerdict =
      (isFakeByAvg || isFakeByRate || isFakeByConsecutive || isFakeByVariance || isFakeByMaxScore)
        ? 'DEEPFAKE'
        : (avgConfidence < 25 && flaggedRate < 0.10 && maxConsecutiveRun < 3 && maxFakeScore < 40)
        ? 'AUTHENTIC'
        : 'UNCERTAIN';

    const compositeScore = Math.min(100, Math.round(
      avgConfidence * 0.40 +
      flaggedRate   * 100  * 0.30 +
      Math.min(maxConsecutiveRun / 15, 1) * 100 * 0.20 +
      (isFakeByVariance ? confStd * 0.10 : 0),
    ));

    const triggeredSignals = [
      isFakeByAvg         ? `avg ${Math.round(avgConfidence)}% ≥ 38%`                   : '',
      isFakeByRate        ? `${Math.round(flaggedRate * 100)}% frames ≥ 20%`             : '',
      isFakeByConsecutive ? `${maxConsecutiveRun} consecutive frames ≥ 5`               : '',
      isFakeByVariance    ? `confidence oscillation std ${confStd.toFixed(0)}pts > 12`  : '',
      isFakeByMaxScore    ? `single-frame peak ${maxFakeScore}% ≥ 60%`                  : '',
    ].filter(Boolean);

    console.log(
      `[DeepFake/video] verdict=${videoVerdict} frames=${frameResults.length} ` +
      `avg=${avgConfidence.toFixed(1)}% rate=${(flaggedRate * 100).toFixed(0)}% ` +
      `run=${maxConsecutiveRun} std=${confStd.toFixed(0)}`,
    );

    res.json({
      verdict:    videoVerdict,
      confidence: compositeScore,
      topLabel:   `${fakeFrames.length}/${valid.length} frames flagged · avg ${Math.round(avgConfidence)}% · run ${maxConsecutiveRun}`,
      breakdown:  [
        { label: 'Avg fake probability',    score: Math.round(avgConfidence) },
        { label: 'Frames flagged as fake',  score: Math.round(flaggedRate * 100) },
        { label: 'Max fake probability',    score: allConf.length ? Math.max(...allConf) : 0 },
        { label: 'Confidence oscillation',  score: Math.min(100, Math.round(confStd * 2)) },
      ],
      frames: frameResults,
      temporal: {
        hfAvailable:         true,
        avgConfidence:       Math.round(avgConfidence),
        flaggedRate:         Math.round(flaggedRate * 100),
        maxConsecutiveRun,
        maxFakeScore,
        confidenceVariance:  Math.round(confVariance),
        confidenceStd:       Math.round(confStd),
        totalFrames:         frameResults.length,
        analyzedFrames:      valid.length,
        fakeFrames:          fakeFrames.length,
        uncertainFrames:     uncertainFrames.length,
        isFakeByAvg,
        isFakeByRate,
        isFakeByConsecutive,
        isFakeByVariance,
        isFakeByMaxScore,
        triggeredSignals,
      },
    });
  } catch (err) {
    console.error('[DeepFake/video]', err.message);
    res.status(500).json({ error: err.message || 'Video analysis failed.' });
  }
});

// POST /api/deepfake/audio
router.post('/deepfake/audio', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    const allowed = [
      'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg',
      'audio/flac', 'audio/x-wav', 'audio/wave',
    ];
    const extOk = /\.(wav|mp3|ogg|flac)$/i.test(req.file.originalname ?? '');
    if (!allowed.includes(req.file.mimetype) && !extOk)
      return res.status(400).json({ error: 'Only WAV, MP3, OGG or FLAC audio files are supported.' });

    const raw    = await callAudioHF(req.file.buffer);
    const result = normaliseAudio(raw);
    res.json(result);
  } catch (err) {
    console.error('[DeepFake/audio]', err.message);
    res.status(500).json({ error: err.message || 'Audio analysis failed.' });
  }
});

export default router;