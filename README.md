# Gemini Highlighter

Manifest V3 Chrome extension for studying long articles with source-linked Gemini prompts.

## Load in Chrome

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked".
4. Select this folder: `article-context-ask`.

## Gemini Integration

Selecting text and clicking "Ask" copies only the selected text to the clipboard, opens `https://gemini.google.com/app` in one popup window, and stores a source-linked highlight record. If Gemini later changes that popup tab to a conversation-specific URL, the extension saves that URL against the highlight.

Automatic paste into Gemini is not implemented because Gemini is a cross-origin Google page. Chrome extensions cannot reliably control that page without brittle DOM automation.

## Test

```bash
node test/matching.test.js
```
