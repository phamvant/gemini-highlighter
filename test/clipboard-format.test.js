const assert = require("node:assert/strict");
const clipboardFormat = require("../clipboard-format.js");

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

test("formats Gemini context with selected text as the start of the question", () => {
  const text = clipboardFormat.formatClipboardText({
    selectedText: "selected part",
    contextText: "Full Gemini answer around selected part."
  });

  assert.equal(text, "context:\nFull Gemini answer around selected part.\n\nquestion:\nselected part\n");
});

test("falls back to selected text when no Gemini context exists", () => {
  const text = clipboardFormat.formatClipboardText({
    selectedText: "selected article text",
    contextText: ""
  });

  assert.equal(text, "selected article text");
});
