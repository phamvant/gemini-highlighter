const assert = require("node:assert/strict");
const sessionUtils = require("../session-utils.js");

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

test("creates a session linked to Gemini web", () => {
  const session = sessionUtils.createSessionRecord({
    id: "session-1",
    now: "2026-05-24T00:00:00.000Z",
    sourceUrl: "https://example.com/article",
    selectedText: "A useful quote",
    prefix: "Before ",
    suffix: " after"
  });

  assert.equal(session.ai_chat_link_or_id, "https://gemini.google.com/app");
  assert.equal(session.selected_text, "A useful quote");
  assert.deepEqual(session.text_context, {
    prefix: "Before ",
    suffix: " after"
  });
});

test("marks Gemini app root as not conversation-specific", () => {
  assert.equal(sessionUtils.isGeminiConversationUrl("https://gemini.google.com/app"), false);
  assert.equal(sessionUtils.isGeminiConversationUrl("https://gemini.google.com/app/"), false);
});

test("marks Gemini app child URL as conversation-specific", () => {
  assert.equal(sessionUtils.isGeminiConversationUrl("https://gemini.google.com/app/abc123"), true);
});

test("extracts Gemini conversation id from child URL", () => {
  assert.equal(
    sessionUtils.getGeminiConversationId("https://gemini.google.com/app/abc123?hl=en"),
    "abc123"
  );
});

test("updates a session with Gemini tab and conversation link", () => {
  const session = sessionUtils.createSessionRecord({
    id: "session-1",
    now: "2026-05-24T00:00:00.000Z",
    sourceUrl: "https://example.com/article",
    selectedText: "A useful quote"
  });

  const withTab = sessionUtils.withGeminiTab(session, 123);
  assert.equal(withTab.gemini_tab_id, 123);
  assert.equal(withTab.link_status, "pending");

  const linked = sessionUtils.withGeminiConversationLink(
    withTab,
    "https://gemini.google.com/app/abc123",
    "2026-05-24T00:01:00.000Z"
  );

  assert.equal(linked.ai_chat_link_or_id, "https://gemini.google.com/app/abc123");
  assert.equal(linked.ai_chat_id, "abc123");
  assert.equal(linked.link_status, "linked");
  assert.equal(linked.updated_at, "2026-05-24T00:01:00.000Z");
});

test("only allows a pending Gemini tab link to be written once", () => {
  const session = sessionUtils.withGeminiTab(
    sessionUtils.createSessionRecord({
      id: "session-1",
      sourceUrl: "https://example.com/article",
      selectedText: "A useful quote"
    }),
    123
  );

  assert.equal(sessionUtils.canLinkGeminiConversation(session, 123), true);

  const linked = sessionUtils.withGeminiConversationLink(
    session,
    "https://gemini.google.com/app/abc123"
  );

  assert.equal(sessionUtils.canLinkGeminiConversation(linked, 123), false);
  assert.equal(sessionUtils.canLinkGeminiConversation(session, 456), false);
});
