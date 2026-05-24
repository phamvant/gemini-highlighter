const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

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

const contentScript = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");

test("refreshes restore watcher after creating a new highlight", () => {
  assert.match(
    contentScript,
    /applyHighlightForSession\(response\.session\);\s*await restoreHighlights\(\);/
  );
});

test("refreshes highlights when returning to the article tab", () => {
  assert.match(contentScript, /window\.addEventListener\("focus", restoreHighlights, true\);/);
  assert.match(contentScript, /window\.addEventListener\("pageshow", restoreHighlights, true\);/);
});

test("limits text matching to the Gemini chat history container when present", () => {
  assert.match(
    contentScript,
    /document\.querySelector\("#chat-history\.chat-history-scroll-container"\)/
  );
  assert.match(contentScript, /getVisibleTextNodes\(getHighlightRoot\(\)\)/);
});

test("copies Gemini conversation ancestor as clipboard context", () => {
  assert.match(contentScript, /getClipboardContextForSelection\(selection\)/);
  assert.match(contentScript, /ArticleAskClipboardFormat\.GEMINI_CONTEXT_SELECTOR/);
  assert.match(contentScript, /ArticleAskClipboardFormat\.formatClipboardText/);
});

test("supports deleting a highlight from hover action", () => {
  assert.match(contentScript, /ARTICLE_ASK_DELETE_SESSION/);
  assert.match(contentScript, /createHighlightDeleteButton\(sessionId\)/);
  assert.match(contentScript, /deleteHighlightSession\(deleteButton\.dataset\.articleAskId/);
  assert.match(contentScript, /unwrapHighlight\(highlighted\)/);
});
