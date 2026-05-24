(function attachArticleAskHighlightRestore(root) {
  "use strict";

  function createHighlightRestoreRunner({
    maxAttempts = 20,
    retryDelayMs = 500,
    schedule,
    clearScheduled,
    observeMutations,
    hasHighlight,
    applyHighlight
  }) {
    let sessions = [];
    let attempts = 0;
    let scheduledHandle = null;
    let disconnectObserver = null;

    function setSessions(nextSessions) {
      sessions = Array.isArray(nextSessions) ? nextSessions.slice() : [];
      attempts = 0;
      run();
    }

    function run() {
      scheduledHandle = null;

      if (!sessions.length) {
        stop();
        return;
      }

      let hasPending = false;
      for (const session of sessions) {
        if (hasHighlight(session)) continue;
        if (applyHighlight(session) || hasHighlight(session)) continue;
        hasPending = true;
      }

      ensureObserver();
      if (hasPending) scheduleRetry();
    }

    function ensureObserver() {
      if (disconnectObserver) return;
      disconnectObserver = observeMutations(runSoon);
    }

    function scheduleRetry() {
      if (scheduledHandle || attempts >= maxAttempts) return;
      attempts += 1;
      scheduledHandle = schedule(run, retryDelayMs);
    }

    function runSoon() {
      if (scheduledHandle) {
        clearScheduled(scheduledHandle);
        scheduledHandle = null;
      }
      run();
    }

    function stop() {
      if (scheduledHandle) {
        clearScheduled(scheduledHandle);
        scheduledHandle = null;
      }

      if (disconnectObserver) {
        disconnectObserver();
        disconnectObserver = null;
      }
    }

    return {
      setSessions,
      stop
    };
  }

  const api = {
    createHighlightRestoreRunner
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArticleAskHighlightRestore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
