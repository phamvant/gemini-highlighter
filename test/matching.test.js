const assert = require("node:assert/strict");
const matching = require("../content-match.js");

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

test("chooses the occurrence with matching prefix and suffix", () => {
  const text = [
    "Intro paragraph mentions the same claim twice.",
    "First context says important quote ends here and moves on.",
    "Later context says important quote ends here with the saved suffix."
  ].join(" ");

  const offset = matching.findBestTextOffset({
    fullText: text,
    selectedText: "important quote ends here",
    prefix: "Later context says ",
    suffix: " with the saved suffix."
  });

  assert.equal(offset, text.lastIndexOf("important quote ends here"));
});

test("normalizes whitespace when matching selected text", () => {
  const text = "The article has a selected\n\nphrase with odd spacing in the DOM.";

  const range = matching.findBestTextRange({
    fullText: text,
    selectedText: "selected phrase with odd spacing",
    prefix: "article has a ",
    suffix: " in the DOM"
  });

  assert.deepEqual(range, {
    start: text.indexOf("selected"),
    end: text.indexOf(" in the DOM")
  });
});

test("returns -1 when selected text is absent", () => {
  const offset = matching.findBestTextOffset({
    fullText: "A different article body.",
    selectedText: "missing text",
    prefix: "",
    suffix: ""
  });

  assert.equal(offset, -1);
});
