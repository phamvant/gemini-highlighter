(function attachArticleAskMatching(root) {
  "use strict";

  function normalizeForSearch(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizeContext(value) {
    return String(value || "").replace(/\s+/g, " ");
  }

  function buildNormalizedIndex(fullText) {
    const normalizedChars = [];
    const originalOffsets = [];
    let pendingSpace = false;

    for (let i = 0; i < fullText.length; i += 1) {
      const char = fullText[i];

      if (/\s/.test(char)) {
        pendingSpace = normalizedChars.length > 0;
        continue;
      }

      if (pendingSpace) {
        normalizedChars.push(" ");
        originalOffsets.push(i);
        pendingSpace = false;
      }

      normalizedChars.push(char);
      originalOffsets.push(i);
    }

    return {
      normalizedText: normalizedChars.join("").trimEnd(),
      originalOffsets
    };
  }

  function findBestTextOffset({ fullText, selectedText, prefix = "", suffix = "" }) {
    const range = findBestTextRange({ fullText, selectedText, prefix, suffix });
    return range ? range.start : -1;
  }

  function findBestTextRange({ fullText, selectedText, prefix = "", suffix = "" }) {
    const selected = normalizeForSearch(selectedText);
    if (!fullText || !selected) return null;

    const index = buildNormalizedIndex(fullText);
    const normalizedPrefix = normalizeContext(prefix);
    const normalizedSuffix = normalizeContext(suffix);
    const candidates = [];

    let normalizedOffset = index.normalizedText.indexOf(selected);
    while (normalizedOffset >= 0) {
      const before = index.normalizedText.slice(
        Math.max(0, normalizedOffset - normalizedPrefix.length),
        normalizedOffset
      );
      const after = index.normalizedText.slice(
        normalizedOffset + selected.length,
        normalizedOffset + selected.length + normalizedSuffix.length
      );

      candidates.push({
        start: index.originalOffsets[normalizedOffset],
        end: index.originalOffsets[normalizedOffset + selected.length - 1] + 1,
        score: prefixScore(before, normalizedPrefix) + suffixScore(after, normalizedSuffix)
      });

      normalizedOffset = index.normalizedText.indexOf(selected, normalizedOffset + selected.length);
    }

    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score);
    return {
      start: candidates[0].start,
      end: candidates[0].end
    };
  }

  function prefixScore(actualBefore, expectedPrefix) {
    if (!expectedPrefix) return 0;
    if (actualBefore.endsWith(expectedPrefix)) return 2;
    return similarityFromEnd(actualBefore, expectedPrefix);
  }

  function suffixScore(actualAfter, expectedSuffix) {
    if (!expectedSuffix) return 0;
    if (actualAfter.startsWith(expectedSuffix)) return 2;
    return similarityFromStart(actualAfter, expectedSuffix);
  }

  function similarityFromStart(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    if (a === b) return 1;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length > b.length ? a : b;
    let matches = 0;

    for (let i = 0; i < shorter.length; i += 1) {
      if (shorter[i] === longer[i]) matches += 1;
    }

    return matches / longer.length;
  }

  function similarityFromEnd(a, b) {
    if (!a && !b) return 1;
    if (!a || !b) return 0;
    if (a === b) return 1;

    const shorter = a.length <= b.length ? a : b;
    const longer = a.length > b.length ? a : b;
    let matches = 0;

    for (let i = 1; i <= shorter.length; i += 1) {
      if (shorter[shorter.length - i] === longer[longer.length - i]) matches += 1;
    }

    return matches / longer.length;
  }

  const api = {
    buildNormalizedIndex,
    findBestTextOffset,
    findBestTextRange,
    normalizeContext,
    normalizeForSearch
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.ArticleAskMatching = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
