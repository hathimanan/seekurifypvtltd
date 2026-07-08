/**
 * ML-based prompt injection classifier — Layer 1.5
 *
 * Model: Xenova/nli-deberta-v3-small  (~85 MB ONNX, quantized)
 * Method: zero-shot NLI classification
 * Runs entirely in Node.js — no API key, no network call after first download.
 *
 * First use: model is downloaded from HuggingFace and cached in ./.model-cache/
 * Subsequent uses: loads from disk in ~1-2 s.
 */

// Singleton state
let _pipeline  = null;
let _loading   = false;
let _loadError = null;
const _waiters = [];

const MODEL_ID = 'Xenova/nli-deberta-v3-small';
const COLD_START_TIMEOUT_MS = 180_000;
const WARM_START_TIMEOUT_MS = 30_000;

// Attack labels — order matters: first non-safe label wins as topLabel
const ATTACK_LABELS = [
  'prompt injection attack',
  'jailbreak attempt',
  'tool hijacking command',
  'data exfiltration attempt',
];
const SAFE_LABEL = 'safe user input';
const ALL_LABELS = [...ATTACK_LABELS, SAFE_LABEL];

async function loadPipeline() {
  if (_pipeline)   return _pipeline;
  if (_loadError)  throw _loadError;

  if (_loading) {
    return new Promise((resolve, reject) => _waiters.push({ resolve, reject }));
  }

  _loading = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.cacheDir = process.env.VERCEL === '1' ? '/tmp/.model-cache' : './.model-cache';
    env.allowLocalModels = false;              // always fetch from HF hub if missing

    console.log('[ML Classifier] Loading model', MODEL_ID, '— first run downloads ~85 MB…');
    _pipeline = await pipeline('zero-shot-classification', MODEL_ID);
    console.log('[ML Classifier] Model ready.');

    _waiters.forEach(w => w.resolve(_pipeline));
    return _pipeline;
  } catch (err) {
    _loadError = err;
    _waiters.forEach(w => w.reject(err));
    throw err;
  } finally {
    _loading = false;
    _waiters.length = 0;
  }
}

// Warm the pipeline in the background so the first real scan is fast.
// Errors are suppressed here — callers get null on failure.
export function warmupClassifier() {
  loadPipeline().catch(() => {});
}

/**
 * Classify `text` for prompt injection attack categories.
 *
 * @param {string} text  Raw input text (first 512 chars are used)
 * @returns {Promise<{
 *   topLabel: string,
 *   topScore: number,
 *   scores: Record<string,number>,
 *   isInjection: boolean,
 *   attackCategory: string|null,
 *   mlScore: number,          // 0-25 contribution to overall risk score
 *   novelDetection: boolean,  // true when ML flags something regex missed
 * }|null>}  null on model load failure
 */
export async function classifyInjection(text, regexFoundSomething = false) {
  let clf;
  try {
    const timeoutMs = _pipeline ? WARM_START_TIMEOUT_MS : COLD_START_TIMEOUT_MS;
    clf = await Promise.race([
      loadPipeline(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`ML classifier timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  } catch (err) {
    console.warn('[ML Classifier] Skipped:', err.message);
    return null;
  }

  // NLI models cap at ~512 tokens; slice to 512 chars as a cheap guard
  const sample = text.slice(0, 512);

  const result = await clf(sample, ALL_LABELS, {
    multi_label: false,
    hypothesis_template: 'This text contains a {}.',
  });

  // Build label → score map
  const scores = {};
  result.labels.forEach((lbl, i) => { scores[lbl] = result.scores[i]; });

  const topLabel = result.labels[0];
  const topScore = result.scores[0];

  const isInjection = topLabel !== SAFE_LABEL && topScore > 0.52;

  // Best attack-label confidence (ignoring safe label)
  const bestAttackScore = Math.max(...ATTACK_LABELS.map(l => scores[l] ?? 0));

  // Score contribution: 0–25 points, scaled by confidence above the threshold
  const mlScore = isInjection
    ? Math.min(25, Math.round(((bestAttackScore - 0.52) / 0.48) * 25))
    : 0;

  return {
    topLabel,
    topScore:       Math.round(topScore   * 1000) / 1000,
    scores:         Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, Math.round(v * 1000) / 1000])
    ),
    isInjection,
    attackCategory: isInjection ? topLabel : null,
    mlScore,
    novelDetection: isInjection && !regexFoundSomething,
  };
}
