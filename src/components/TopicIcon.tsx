import {
  Bike,
  BookOpenText,
  Dribbble,
  Dumbbell,
  Feather,
  Footprints,
  Gamepad2,
  HeartHandshake,
  MessagesSquare,
  Music,
  Palette,
  PersonStanding,
  Sparkles,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * One icon per category/hobby key, in the same icon family as the rest of the
 * UI (the emoji stored in the database are only used by admin screens).
 * The posters in EventCover use the same icons.
 */
export const TOPIC_ICONS: Record<string, LucideIcon> = {
  group_run: Footprints,
  running: Footprints,
  walking: PersonStanding,
  reading_together: BookOpenText,
  reading: BookOpenText,
  book_discussion: MessagesSquare,
  cycling: Bike,
  badminton: Feather,
  basketball: Dribbble,
  futsal: Trophy,
  fitness: Dumbbell,
  gaming: Gamepad2,
  art: Palette,
  music: Music,
  community_gathering: Users,
  social_activity: HeartHandshake,
  social: HeartHandshake,
};

export function TopicIcon({ k, size = 15, className }: { k?: string | null; size?: number; className?: string }) {
  const Icon = (k && TOPIC_ICONS[k]) || Sparkles;
  return <Icon size={size} aria-hidden className={className ?? "shrink-0"} />;
}
