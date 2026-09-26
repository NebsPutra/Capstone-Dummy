// Which event categories match each hobby (interests.key -> categories.key).
// Used to rank dashboard recommendations. Hobbies without a dedicated
// category (art, music, fitness) map to the closest general categories.
export const INTEREST_CATEGORY_KEYS: Record<string, string[]> = {
  reading: ["reading_together", "book_discussion"],
  running: ["group_run"],
  walking: ["walking"],
  cycling: ["cycling"],
  basketball: ["basketball"],
  badminton: ["badminton"],
  futsal: ["futsal"],
  fitness: ["group_run", "walking", "cycling"],
  gaming: ["gaming"],
  art: ["community_gathering", "other"],
  music: ["community_gathering", "other"],
  social: ["social_activity", "community_gathering"],
  other: ["other"],
};

export function categoryKeysFor(interestKeys: string[]): Set<string> {
  return new Set(interestKeys.flatMap((k) => INTEREST_CATEGORY_KEYS[k] ?? []));
}
