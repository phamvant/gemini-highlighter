(function attachArticleAskClipboardFormat(root) {
  "use strict";

  const GEMINI_CONTEXT_SELECTOR = ".conversation-container.message-actions-hover-boundary.ng-star-inserted";

  function formatClipboardText({ selectedText, contextText = "" }) {
    const selected = String(selectedText || "").trim();
    const context = String(contextText || "").trim();

    if (!context) return selected;

    return `context:\n${context}\n\nquestion:\n${selected}\n`;
  }

  const api = {
    GEMINI_CONTEXT_SELECTOR,
    formatClipboardText
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArticleAskClipboardFormat = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
