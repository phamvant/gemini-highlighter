"use strict";

importScripts("session-utils.js");

const SESSIONS_KEY = "articleAskSessions";
const ACTIVE_SESSION_KEY = "articleAskActiveSessionId";
const GEMINI_WINDOW_KEY = "articleAskGeminiWindowId";
const GEMINI_TAB_KEY = "articleAskGeminiTabId";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "article-ask-selection",
    title: "Ask about selected text",
    contexts: ["selection"]
  });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (!changeInfo.url || !ArticleAskSessionUtils.isGeminiConversationUrl(changeInfo.url)) {
    return;
  }

  updateSessionLinkForGeminiTab(tabId, changeInfo.url);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "article-ask-selection" || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: "ARTICLE_ASK_CONTEXT_MENU",
    selectedText: info.selectionText || ""
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ARTICLE_ASK_CREATE_SESSION") {
    createSession(message.payload, sender.tab)
      .then((session) => sendResponse({ ok: true, session }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ARTICLE_ASK_OPEN_SESSION") {
    openSession(message.sessionId, sender.tab)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ARTICLE_ASK_DELETE_SESSION") {
    deleteSession(message.sessionId)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ARTICLE_ASK_GET_SESSIONS_FOR_URL") {
    getSessionsForUrl(message.url)
      .then((sessions) => sendResponse({ ok: true, sessions }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  if (message.type === "ARTICLE_ASK_GET_ALL_SESSIONS") {
    getAllSessions()
      .then((sessions) => sendResponse({ ok: true, sessions }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }

  return false;
});

async function createSession(payload, tab) {
  if (!payload?.selectedText?.trim()) {
    throw new Error("No selected text was provided.");
  }

  let session = ArticleAskSessionUtils.createSessionRecord({
    id: crypto.randomUUID(),
    sourceUrl: payload.sourceUrl,
    selectedText: payload.selectedText,
    prefix: payload.prefix || "",
    suffix: payload.suffix || ""
  });

  const geminiTab = await openGeminiWindow(session.ai_chat_link_or_id);
  if (geminiTab?.id) {
    session = ArticleAskSessionUtils.withGeminiTab(session, geminiTab.id);
  }

  const sessions = await getAllSessions();
  sessions.unshift(session);

  await chrome.storage.local.set({
    [SESSIONS_KEY]: sessions,
    [ACTIVE_SESSION_KEY]: session.id
  });

  return session;
}

async function openSession(sessionId, tab) {
  if (!sessionId) throw new Error("Missing session id.");

  const sessions = await getAllSessions();
  const session = sessions.find((candidate) => candidate.id === sessionId);
  const targetUrl = session?.ai_chat_link_or_id || ArticleAskSessionUtils.GEMINI_WEB_URL;

  await chrome.storage.local.set({ [ACTIVE_SESSION_KEY]: sessionId });
  await openGeminiWindow(targetUrl);
}

async function deleteSession(sessionId) {
  if (!sessionId) throw new Error("Missing session id.");

  const sessions = await getAllSessions();
  const nextSessions = sessions.filter((candidate) => candidate.id !== sessionId);
  await chrome.storage.local.set({ [SESSIONS_KEY]: nextSessions });
}

async function openGeminiWindow(url) {
  const targetUrl = url || ArticleAskSessionUtils.GEMINI_WEB_URL;
  const saved = await chrome.storage.local.get([GEMINI_WINDOW_KEY, GEMINI_TAB_KEY]);
  const savedWindowId = saved[GEMINI_WINDOW_KEY];
  const savedTabId = saved[GEMINI_TAB_KEY];

  if (savedWindowId && savedTabId) {
    try {
      await chrome.windows.get(savedWindowId);
      const updatedTab = await chrome.tabs.update(savedTabId, { url: targetUrl, active: true });
      await chrome.windows.update(savedWindowId, { focused: true });
      return updatedTab;
    } catch {
      await chrome.storage.local.remove([GEMINI_WINDOW_KEY, GEMINI_TAB_KEY]);
    }
  }

  const createdWindow = await chrome.windows.create({
    url: targetUrl,
    type: "popup",
    width: 520,
    height: 860,
    focused: true,
    state: "normal"
  });
  const createdTab = createdWindow.tabs?.[0] || null;

  if (createdWindow.id && createdTab?.id) {
    await chrome.storage.local.set({
      [GEMINI_WINDOW_KEY]: createdWindow.id,
      [GEMINI_TAB_KEY]: createdTab.id
    });
  }

  return createdTab;
}

async function updateSessionLinkForGeminiTab(tabId, conversationUrl) {
  const sessions = await getAllSessions();
  let changed = false;

  const nextSessions = sessions.map((session) => {
    if (!ArticleAskSessionUtils.canLinkGeminiConversation(session, tabId)) return session;
    if (session.ai_chat_link_or_id === conversationUrl) return session;
    changed = true;
    return ArticleAskSessionUtils.withGeminiConversationLink(session, conversationUrl);
  });

  if (changed) {
    await chrome.storage.local.set({ [SESSIONS_KEY]: nextSessions });
  }
}

async function getSessionsForUrl(url) {
  const sessions = await getAllSessions();
  return sessions.filter((session) => normalizeUrl(session.source_url) === normalizeUrl(url));
}

async function getAllSessions() {
  const result = await chrome.storage.local.get(SESSIONS_KEY);
  return Array.isArray(result[SESSIONS_KEY]) ? result[SESSIONS_KEY] : [];
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url || "");
  }
}
