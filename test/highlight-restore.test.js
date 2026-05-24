const assert = require("node:assert/strict");
const { createHighlightRestoreRunner } = require("../highlight-restore.js");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("retries sessions that cannot be highlighted until page text is available", () => {
  const scheduled = [];
  let pageTextAvailable = false;
  let observerCallback = null;
  let disconnects = 0;

  const runner = createHighlightRestoreRunner({
    maxAttempts: 4,
    retryDelayMs: 25,
    schedule(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    clearScheduled() {},
    observeMutations(callback) {
      observerCallback = callback;
      return () => {
        disconnects += 1;
      };
    },
    hasHighlight() {
      return false;
    },
    applyHighlight() {
      return pageTextAvailable;
    }
  });

  runner.setSessions([{ id: "session-1", selected_text: "late content" }]);

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].delay, 25);
  assert.equal(disconnects, 0);

  pageTextAvailable = true;
  observerCallback();

  assert.equal(scheduled.length, 1);
  assert.equal(disconnects, 0);
});

test("observes sessions that already have highlights without retrying", () => {
  const scheduled = [];
  let observed = false;

  const runner = createHighlightRestoreRunner({
    schedule(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    clearScheduled() {},
    observeMutations() {
      observed = true;
      return () => {};
    },
    hasHighlight() {
      return true;
    },
    applyHighlight() {
      throw new Error("existing highlights should not be applied again");
    }
  });

  runner.setSessions([{ id: "session-1", selected_text: "content" }]);

  assert.equal(scheduled.length, 0);
  assert.equal(observed, true);
});

test("reapplies sessions when a restored highlight disappears", () => {
  const scheduled = [];
  let observerCallback = null;
  let highlighted = true;
  let applyCount = 0;

  const runner = createHighlightRestoreRunner({
    schedule(callback, delay) {
      scheduled.push({ callback, delay });
      return scheduled.length;
    },
    clearScheduled() {},
    observeMutations(callback) {
      observerCallback = callback;
      return () => {};
    },
    hasHighlight() {
      return highlighted;
    },
    applyHighlight() {
      applyCount += 1;
      highlighted = true;
      return true;
    }
  });

  runner.setSessions([{ id: "session-1", selected_text: "content" }]);
  assert.equal(applyCount, 0);

  highlighted = false;
  observerCallback();

  assert.equal(applyCount, 1);
  assert.equal(scheduled.length, 0);
});
