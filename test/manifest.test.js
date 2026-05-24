const assert = require("node:assert/strict");
const manifest = require("../manifest.json");

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

test("loads highlight restore helper before the content script", () => {
  const scripts = manifest.content_scripts[0].js;

  assert.ok(scripts.includes("highlight-restore.js"));
  assert.ok(scripts.indexOf("highlight-restore.js") < scripts.indexOf("content.js"));
});

test("loads clipboard formatter before the content script", () => {
  const scripts = manifest.content_scripts[0].js;

  assert.ok(scripts.includes("clipboard-format.js"));
  assert.ok(scripts.indexOf("clipboard-format.js") < scripts.indexOf("content.js"));
});

test("declares required Chrome Web Store icon sizes", () => {
  assert.deepEqual(manifest.icons, {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  });
});

test("uses the approved extension name in visible metadata", () => {
  assert.equal(manifest.name, "Gemini Highlighter");
  assert.equal(manifest.action.default_title, "Gemini Highlighter");
});

test("requests only permissions used by the extension", () => {
  assert.deepEqual(manifest.permissions, [
    "storage",
    "contextMenus",
    "clipboardWrite",
    "tabs"
  ]);
});
