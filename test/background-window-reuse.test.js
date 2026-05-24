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

const backgroundScript = fs.readFileSync(path.join(__dirname, "..", "background.js"), "utf8");

test("stores and reuses a single Gemini popup tab", () => {
  assert.match(backgroundScript, /GEMINI_WINDOW_KEY\s*=\s*"articleAskGeminiWindowId"/);
  assert.match(backgroundScript, /GEMINI_TAB_KEY\s*=\s*"articleAskGeminiTabId"/);
  assert.match(backgroundScript, /chrome\.windows\.get\(savedWindowId\)/);
  assert.match(backgroundScript, /chrome\.tabs\.update\(savedTabId,\s*\{\s*url:\s*targetUrl,\s*active:\s*true\s*\}\)/);
  assert.match(backgroundScript, /chrome\.windows\.update\(savedWindowId,\s*\{\s*focused:\s*true\s*\}\)/);
});

test("saves new Gemini popup ids after creating a replacement window", () => {
  assert.match(backgroundScript, /GEMINI_WINDOW_KEY\]: createdWindow\.id/);
  assert.match(backgroundScript, /GEMINI_TAB_KEY\]: createdTab\.id/);
});
