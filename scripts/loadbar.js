var BlendedAddressbarModule = (() => {
  'use strict';

  function createLoadProgress() {
    return { progress: 0.08, loading: true, hideAt: 0 };
  }

  function advanceLoadProgress(state, fraction) {
    if (!state.loading) return;
    const next = Number.isFinite(fraction)
      ? Math.min(0.95, Math.max(0, fraction))
      : state.progress + Math.max(0, 0.9 - state.progress) * 0.08;
    state.progress = Math.max(state.progress, next);
  }

  function finishLoadProgress(state, now) {
    if (!state.loading) return;
    state.progress = 1;
    state.loading = false;
    state.hideAt = now + 450;
  }

  return Object.freeze({ createLoadProgress, advanceLoadProgress, finishLoadProgress });
})();
