type GuardResult =
  | { allow: true }
  | { allow: false; reason: string; message: string }

const blockedPatterns: Array<{ pattern: RegExp; reason: string; message: string }> = [
  {
    pattern: /\b(suicide|self[-\s]?harm|kill myself)\b/i,
    reason: 'self_harm',
    message:
      "I'm really sorry you're feeling this way. I can't help with that, but please reach out to local emergency services or a trusted person immediately.",
  },
  {
    pattern: /\b(make|build|buy)\s+(a\s+)?(weapon|bomb|explosive)\b/i,
    reason: 'weaponization',
    message:
      "I can’t help with that. Let’s focus on planning a great trip experience instead.",
  },
]

export function runPromptGuard(input: string): GuardResult {
  for (const { pattern, reason, message } of blockedPatterns) {
    if (pattern.test(input)) {
      return { allow: false, reason, message }
    }
  }

  return { allow: true }
}
