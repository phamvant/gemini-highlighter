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

test("privacy policy documents local selected-text handling", () => {
  const policy = fs.readFileSync(path.join(__dirname, "..", "PRIVACY.md"), "utf8");

  assert.match(policy, /selected article text/i);
  assert.match(policy, /stored locally/i);
  assert.match(policy, /not sell/i);
  assert.match(policy, /not transmit/i);
});
