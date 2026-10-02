const normalize = (value) =>
  value.normalize("NFKC").toLowerCase().replace(/[’‘]/gu, "'").replace(/[^\p{L}\p{M}\p{N}']+/gu, " ").trim().split(/\s+/u).filter(Boolean);

const hasPhrase = (words, phrase) => {
  for (let i = 0; i <= words.length - phrase.length; i += 1) {
    if (phrase.every((word, offset) => words[i + offset] === word)) return i;
  }
  return -1;
};

export function detectEmergency(text, locales) {
  const words = normalize(text);
  if (!words.length) return { urgent: false, reasons: [] };

  const negations = new Set(Object.values(locales).flatMap(({ negations: terms }) => terms.flatMap(normalize)));
  const reasons = new Set();
  for (const { terms } of Object.values(locales)) {
    for (const original of terms) {
      const phrase = normalize(original);
      let from = 0;
      while (from <= words.length - phrase.length) {
        const relativeIndex = hasPhrase(words.slice(from), phrase);
        if (relativeIndex < 0) break;
        const index = from + relativeIndex;
        // ponytail: three-token negation window; upgrade to a language parser only if tests show misses.
        const context = [...words.slice(Math.max(0, index - 3), index), ...words.slice(index + phrase.length, index + phrase.length + 2)];
        if (!context.some((word) => negations.has(word))) reasons.add(original);
        from = index + 1;
      }
    }
  }
  return { urgent: reasons.size > 0, reasons: [...reasons] };
}
