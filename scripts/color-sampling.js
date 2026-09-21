var BlendedAddressbarModule = (() => {
  'use strict';

  function getDominantSampleColor(data) {
    const buckets = new Map();
    let total = 0;
    for (let i = 0; i + 3 < (data?.length || 0); i += 4) {
      const a = data[i + 3] / 255;
      if (a < 0.08) continue;
      // Four bits per channel keep small antialiasing differences together.
      const key = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4);
      const bucket = buckets.get(key) || { weight: 0, count: 0, r: 0, g: 0, b: 0 };
      bucket.weight += a;
      bucket.count++;
      bucket.r += data[i] * a;
      bucket.g += data[i + 1] * a;
      bucket.b += data[i + 2] * a;
      buckets.set(key, bucket);
      total += a;
    }
    let best = null;
    for (const bucket of buckets.values()) {
      if (!best || bucket.weight > best.weight) best = bucket;
    }
    if (!best) return null;
    return {
      r: Math.round(best.r / best.weight),
      g: Math.round(best.g / best.weight),
      b: Math.round(best.b / best.weight),
      a: best.weight / best.count,
      share: best.weight / total
    };
  }

  return Object.freeze({ getDominantSampleColor });
})();
