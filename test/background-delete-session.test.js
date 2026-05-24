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

test("handles delete session messages", () => {
  assert.match(backgroundScript, /ARTICLE_ASK_DELETE_SESSION/);
  assert.match(backgroundScript, /deleteSession\(message\.sessionId\)/);
});

test("removes deleted session from storage", () => {
  assert.match(backgroundScript, /candidate\.id !== sessionId/);
  assert.match(backgroundScript, /chrome\.storage\.local\.set\(\{\s*\[SESSIONS_KEY\]: nextSessions\s*\}\)/);
});
