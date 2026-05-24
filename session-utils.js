(function attachArticleAskSessionUtils(root) {
  "use strict";

  const GEMINI_WEB_URL = "https://gemini.google.com/app";

  function createSessionRecord({
    id,
    now,
    sourceUrl,
    selectedText,
    prefix = "",
    suffix = ""
  }) {
    const timestamp = now || new Date().toISOString();

    return {
      id,
      source_url: sourceUrl,
      selected_text: String(selectedText || "").trim(),
      text_context: {
        prefix,
        suffix
      },
      ai_chat_link_or_id: GEMINI_WEB_URL,
      link_status: "pending",
      created_at: timestamp,
      updated_at: timestamp
    };
  }

  function isGeminiConversationUrl(url) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== "https://gemini.google.com") return false;
      const normalizedPath = parsed.pathname.replace(/\/+$/, "");
      return normalizedPath.startsWith("/app/") && normalizedPath.length > "/app/".length;
    } catch {
      return false;
    }
  }

  function getGeminiConversationId(url) {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== "https://gemini.google.com") return "";
      const normalizedPath = parsed.pathname.replace(/\/+$/, "");
      if (!normalizedPath.startsWith("/app/")) return "";
      return decodeURIComponent(normalizedPath.slice("/app/".length).split("/")[0] || "");
    } catch {
      return "";
    }
  }

  function canLinkGeminiConversation(session, tabId) {
    if (!session || session.gemini_tab_id !== tabId) return false;
    if (session.link_status === "linked") return false;
    if (session.ai_chat_id) return false;
    return !isGeminiConversationUrl(session.ai_chat_link_or_id);
  }

  function withGeminiTab(session, tabId) {
    return {
      ...session,
      gemini_tab_id: tabId,
      link_status: "pending"
    };
  }

  function withGeminiConversationLink(session, conversationUrl, now) {
    return {
      ...session,
      ai_chat_link_or_id: conversationUrl,
      ai_chat_id: getGeminiConversationId(conversationUrl),
      link_status: "linked",
      updated_at: now || new Date().toISOString()
    };
  }

  const api = {
    GEMINI_WEB_URL,
    canLinkGeminiConversation,
    createSessionRecord,
    getGeminiConversationId,
    isGeminiConversationUrl,
    withGeminiConversationLink,
    withGeminiTab
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArticleAskSessionUtils = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
