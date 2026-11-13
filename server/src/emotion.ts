/**
 * Emotion Mapper
 *
 * Maps response content to device-supported emotion tags.
 * The StackChan device uses emotion tags to render face expressions.
 *
 * Supported emotions (from xiaozhi firmware):
 * - neutral: default calm face
 * - happy: smiling
 * - sad: drooping
 * - angry: furrowed brows
 * - surprised: wide eyes
 * - confused: tilted head
 *
 * Phase 1: Simple keyword-based mapping
 * Phase 5: LLM-assisted emotion detection
 */

const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: [
    'great', 'awesome', 'wonderful', 'excellent', 'congratulations',
    'done', 'completed', 'success', 'perfect', 'glad', 'happy',
    'love', 'fantastic', 'amazing', 'brilliant',
  ],
  sad: [
    'sorry', 'unfortunately', 'sad', 'bad news', 'failed', 'error',
    'can\'t', 'unable', 'impossible', 'regret', 'miss', 'difficult',
  ],
  angry: [
    'error', 'failed', 'broken', 'crash', 'bug', 'wrong',
    'problem', 'issue', 'critical',
  ],
  surprised: [
    'wow', 'unexpected', 'incredible', 'surprising', 'really',
    'no way', 'amazing', 'whoa',
  ],
  confused: [
    'unclear', 'not sure', 'confused', 'what do you mean',
    'could you clarify', 'ambiguous', 'hmm',
  ],
};

/**
 * Analyze text content and return the most appropriate emotion.
 * Returns 'neutral' if no strong emotion is detected.
 */
export function mapEmotion(text: string): string {
  if (!text) return 'neutral';

  const lower = text.toLowerCase();
  let bestEmotion = 'neutral';
  let bestScore = 0;

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  // Only return non-neutral if we have at least 2 keyword matches
  return bestScore >= 2 ? bestEmotion : 'neutral';
}
