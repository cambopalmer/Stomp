import type { CategoryIcon as IconKey } from "@stomp/shared";
import {
  BookOpen,
  Briefcase,
  Car,
  ClipboardList,
  Coffee,
  Dumbbell,
  GraduationCap,
  HeartPulse,
  Home,
  type LucideIcon,
  Moon,
  Music,
  Phone,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Target,
  User,
  Users,
  UtensilsCrossed,
} from "lucide-react";

const ICONS: Record<IconKey, LucideIcon> = {
  briefcase: Briefcase,
  target: Target,
  clipboard: ClipboardList,
  home: Home,
  users: Users,
  user: User,
  "heart-pulse": HeartPulse,
  car: Car,
  book: BookOpen,
  coffee: Coffee,
  dumbbell: Dumbbell,
  utensils: UtensilsCrossed,
  music: Music,
  star: Star,
  moon: Moon,
  phone: Phone,
  "graduation-cap": GraduationCap,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
};

/** A category's icon — meaning never by colour alone. Unknown/none → a neutral tag. */
export function CategoryIcon({ icon, size = 14, color }: { icon?: IconKey | null; size?: number; color?: string }) {
  const Icon = (icon && ICONS[icon]) || Tag;
  return <Icon size={size} aria-hidden="true" style={color ? { color } : undefined} className="shrink-0" />;
}
