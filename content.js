"use strict";

const ARTICLE_ASK_HIGHLIGHT_CLASS = "article-ask-highlight";
const ARTICLE_ASK_DELETE_CLASS = "article-ask-highlight-delete";
const ARTICLE_ASK_POPUP_ID = "article-ask-popup";
const ARTICLE_ASK_STYLE_ID = "article-ask-style";
const ARTICLE_ASK_CONTEXT_CHARS = 160;
const ARTICLE_ASK_GEMINI_URL = "https://gemini.google.com/app";

let askPopup = null;
let lastRange = null;
let highlightRestoreRunner = null;

installStyles();
restoreHighlights();

document.addEventListener("mouseup", () => setTimeout(showAskButtonForSelection, 0), true);
document.addEventListener("keyup", (event) => {
  if (event.key === "Shift" || event.key.startsWith("Arrow")) {
    setTimeout(showAskButtonForSelection, 0);
  }
}, true);
document.addEventListener("scroll", removeAskPopup, true);
document.addEventListener("click", handleDocumentClick, true);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) restoreHighlights();
}, true);
window.addEventListener("focus", restoreHighlights, true);
window.addEventListener("pageshow", restoreHighlights, true);

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "ARTICLE_ASK_CONTEXT_MENU") {
    createSessionFromSelection(message.selectedText);
  }
});

function installStyles() {
  if (document.getElementById(ARTICLE_ASK_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = ARTICLE_ASK_STYLE_ID;
  style.textContent = `
    .${ARTICLE_ASK_HIGHLIGHT_CLASS} {
      position: relative !important;
      background: #fff3a3 !important;
      border-radius: 2px !important;
      box-shadow: 0 0 0 1px rgba(176, 132, 0, .18) !important;
      cursor: pointer !important;
    }
    .${ARTICLE_ASK_DELETE_CLASS} {
      display: none !important;
      position: absolute !important;
      top: -12px !important;
      right: -12px !important;
      z-index: 2147483647 !important;
      width: 18px !important;
      height: 18px !important;
      min-width: 18px !important;
      min-height: 18px !important;
      border: 0 !important;
      border-radius: 999px !important;
      padding: 0 !important;
      background: #d93025 !important;
      color: #fff !important;
      font: 700 14px/18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      text-align: center !important;
      cursor: pointer !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, .28) !important;
    }
    .${ARTICLE_ASK_HIGHLIGHT_CLASS}:hover > .${ARTICLE_ASK_DELETE_CLASS},
    .${ARTICLE_ASK_DELETE_CLASS}:hover {
      display: inline-block !important;
    }
    #${ARTICLE_ASK_POPUP_ID} {
      position: absolute !important;
      z-index: 2147483647 !important;
      border: 0 !important;
      border-radius: 7px !important;
      background: #1a73e8 !important;
      color: #fff !important;
      font: 600 12px/1 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      padding: 7px 11px !important;
      box-shadow: 0 5px 18px rgba(0, 0, 0, .25) !important;
      cursor: pointer !important;
    }
  `;
  document.documentElement.appendChild(style);
}

function showAskButtonForSelection() {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim();

  removeAskPopup();

  if (!selection || !selectedText || selection.rangeCount === 0) return;

  lastRange = selection.getRangeAt(0).cloneRange();
  const rect = lastRange.getBoundingClientRect();
  if (!rect.width && !rect.height) return;

  askPopup = document.createElement("button");
  askPopup.id = ARTICLE_ASK_POPUP_ID;
  askPopup.type = "button";
  askPopup.textContent = "Ask";
  askPopup.style.top = `${window.scrollY + rect.bottom + 8}px`;
  askPopup.style.left = `${window.scrollX + rect.left}px`;

  askPopup.addEventListener("mousedown", (event) => event.preventDefault());
  askPopup.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    createSessionFromSelection(selectedText);
  });

  document.documentElement.appendChild(askPopup);
}

async function createSessionFromSelection(fallbackText) {
  const selection = window.getSelection();
  const selectedText = selection?.toString().trim() || String(fallbackText || "").trim();
  if (!selectedText) return;

  const context = getSelectionContext(selectedText);
  const clipboardText = ArticleAskClipboardFormat.formatClipboardText({
    selectedText,
    contextText: getClipboardContextForSelection(selection)
  });

  await copyTextToClipboard(clipboardText);
  removeAskPopup();

  const response = await chrome.runtime.sendMessage({
    type: "ARTICLE_ASK_CREATE_SESSION",
    payload: {
      sourceUrl: location.href,
      selectedText,
      prefix: context.prefix,
      suffix: context.suffix
    }
  });

  if (response?.ok && response.session) {
    applyHighlightForSession(response.session);
    await restoreHighlights();
    showPageNotice("Selected text copied. Gemini opened in a new window.");
  } else {
    window.open(ARTICLE_ASK_GEMINI_URL, "_blank", "popup,width=520,height=860");
    showPageNotice(response?.error || "Selected text copied. Open Gemini manually and paste.");
  }
}

function getSelectionContext(selectedText) {
  const pageText = getPageText();
  const offset = ArticleAskMatching.findBestTextOffset({
    fullText: pageText,
    selectedText,
    prefix: "",
    suffix: ""
  });

  if (offset >= 0) {
    return {
      prefix: pageText.slice(Math.max(0, offset - ARTICLE_ASK_CONTEXT_CHARS), offset),
      suffix: pageText.slice(offset + selectedText.length, offset + selectedText.length + ARTICLE_ASK_CONTEXT_CHARS)
    };
  }

  return { prefix: "", suffix: "" };
}

function getClipboardContextForSelection(selection) {
  if (!selection || selection.rangeCount === 0) return "";

  const range = selection.getRangeAt(0);
  const node = range.commonAncestorContainer;
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  const container = element?.closest?.(ArticleAskClipboardFormat.GEMINI_CONTEXT_SELECTOR);
  return container?.innerText || container?.textContent || "";
}

async function restoreHighlights() {
  const response = await chrome.runtime.sendMessage({
    type: "ARTICLE_ASK_GET_SESSIONS_FOR_URL",
    url: location.href
  });

  if (!response?.ok) return;

  highlightRestoreRunner?.stop();
  highlightRestoreRunner = ArticleAskHighlightRestore.createHighlightRestoreRunner({
    schedule: (callback, delay) => setTimeout(callback, delay),
    clearScheduled: (handle) => clearTimeout(handle),
    observeMutations(callback) {
      const observer = new MutationObserver(callback);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true
      });
      return () => observer.disconnect();
    },
    hasHighlight: hasHighlightForSession,
    applyHighlight: applyHighlightForSession
  });
  highlightRestoreRunner.setSessions(response.sessions);
}

function applyHighlightForSession(session) {
  if (!session?.id || !session.selected_text) return false;
  if (hasHighlightForSession(session)) return true;

  const textNodes = getVisibleTextNodes(getHighlightRoot());
  const fullText = textNodes.map((node) => node.nodeValue).join("");
  const match = ArticleAskMatching.findBestTextRange({
    fullText,
    selectedText: session.selected_text,
    prefix: session.text_context?.prefix || "",
    suffix: session.text_context?.suffix || ""
  });

  if (!match) return false;

  const range = rangeFromTextOffsets(textNodes, match.start, match.end);
  if (!range) return false;

  wrapRange(range, session.id);
  return true;
}

function hasHighlightForSession(session) {
  return Boolean(session?.id && document.querySelector(`[data-article-ask-id="${cssEscape(session.id)}"]`));
}

function getPageText() {
  return getVisibleTextNodes(getHighlightRoot()).map((node) => node.nodeValue).join("");
}

function getHighlightRoot() {
  return document.querySelector("#chat-history.chat-history-scroll-container") || document.body;
}

function getVisibleTextNodes(root) {
  if (!root) return [];

  const nodes = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;

      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      if (parent.closest(`.${ARTICLE_ASK_HIGHLIGHT_CLASS}, script, style, noscript, textarea, input, select, option, button, #${ARTICLE_ASK_POPUP_ID}`)) {
        return NodeFilter.FILTER_REJECT;
      }

      const style = window.getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    }
  });

  while (walker.nextNode()) nodes.push(walker.currentNode);
  return nodes;
}

function rangeFromTextOffsets(textNodes, start, end) {
  let offset = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  for (const node of textNodes) {
    const nextOffset = offset + node.nodeValue.length;

    if (!startNode && start >= offset && start <= nextOffset) {
      startNode = node;
      startOffset = start - offset;
    }

    if (!endNode && end >= offset && end <= nextOffset) {
      endNode = node;
      endOffset = end - offset;
      break;
    }

    offset = nextOffset;
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function wrapRange(range, sessionId) {
  const wrapper = document.createElement("span");
  wrapper.className = ARTICLE_ASK_HIGHLIGHT_CLASS;
  wrapper.dataset.articleAskId = sessionId;

  try {
    range.surroundContents(wrapper);
  } catch {
    const fragment = range.extractContents();
    wrapper.appendChild(fragment);
    range.insertNode(wrapper);
  }

  wrapper.appendChild(createHighlightDeleteButton(sessionId));
}

function createHighlightDeleteButton(sessionId) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = ARTICLE_ASK_DELETE_CLASS;
  button.dataset.articleAskId = sessionId;
  button.setAttribute("aria-label", "Delete highlight");
  button.title = "Delete highlight";
  button.textContent = "×";
  return button;
}

function handleDocumentClick(event) {
  const deleteButton = event.target.closest?.(`.${ARTICLE_ASK_DELETE_CLASS}`);
  if (deleteButton) {
    event.preventDefault();
    event.stopPropagation();
    deleteHighlightSession(deleteButton.dataset.articleAskId, deleteButton.closest(`.${ARTICLE_ASK_HIGHLIGHT_CLASS}`));
    return;
  }

  const highlighted = event.target.closest?.(`.${ARTICLE_ASK_HIGHLIGHT_CLASS}`);
  if (highlighted) {
    event.preventDefault();
    event.stopPropagation();
    copyPromptForExistingSession(highlighted.dataset.articleAskId);
    chrome.runtime.sendMessage({
      type: "ARTICLE_ASK_OPEN_SESSION",
      sessionId: highlighted.dataset.articleAskId
    }).then((response) => {
      if (!response?.ok) {
        window.open(ARTICLE_ASK_GEMINI_URL, "_blank", "popup,width=520,height=860");
        showPageNotice(response?.error || "Selected text copied. Open Gemini manually and paste.");
      }
    });
    return;
  }

  if (askPopup && event.target !== askPopup) {
    removeAskPopup();
  }
}

async function deleteHighlightSession(sessionId, highlighted) {
  if (!sessionId || !highlighted) return;

  const response = await chrome.runtime.sendMessage({
    type: "ARTICLE_ASK_DELETE_SESSION",
    sessionId
  });

  if (!response?.ok) {
    showPageNotice(response?.error || "Could not delete highlight.");
    return;
  }

  highlightRestoreRunner?.stop();
  unwrapHighlight(highlighted);
  await restoreHighlights();
  showPageNotice("Highlight deleted.");
}

function unwrapHighlight(highlighted) {
  highlighted.querySelector(`.${ARTICLE_ASK_DELETE_CLASS}`)?.remove();

  const parent = highlighted.parentNode;
  if (!parent) return;

  while (highlighted.firstChild) {
    parent.insertBefore(highlighted.firstChild, highlighted);
  }
  highlighted.remove();
  parent.normalize?.();
}

function removeAskPopup() {
  askPopup?.remove();
  askPopup = null;
}

async function copyPromptForExistingSession(sessionId) {
  const response = await chrome.runtime.sendMessage({
    type: "ARTICLE_ASK_GET_ALL_SESSIONS"
  });
  const session = response?.sessions?.find((candidate) => candidate.id === sessionId);
  if (!session) return;

  await copyTextToClipboard(session.selected_text);
  showPageNotice("Selected text copied. Gemini opened in a new window.");
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.cssText = "position:fixed;left:-9999px;top:-9999px;";
    document.documentElement.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }
}

function showPageNotice(message) {
  const notice = document.createElement("div");
  notice.textContent = `Gemini Highlighter: ${message}`;
  notice.style.cssText = [
    "position:fixed",
    "right:16px",
    "bottom:16px",
    "z-index:2147483647",
    "max-width:360px",
    "padding:10px 12px",
    "border-radius:8px",
    "background:#202124",
    "color:#fff",
    "font:13px/1.35 system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 8px 24px rgba(0,0,0,.25)"
  ].join(";");

  document.documentElement.appendChild(notice);
  setTimeout(() => notice.remove(), 5500);
}

function cssEscape(value) {
  return CSS.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
}
