import {
  Baby,
  Briefcase,
  Bus,
  Car,
  Cigarette,
  Coffee,
  CreditCard,
  Dumbbell,
  Gift,
  GraduationCap,
  Heart,
  House,
  Laptop,
  LifeBuoy,
  Package,
  PawPrint,
  PiggyBank,
  Plane,
  Repeat,
  Shield,
  ShoppingCart,
  Shirt,
  Smartphone,
  Tag,
  Target,
  TrainFront,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { createElement } from "react";

// Icon names stored in the database (categories.icon, goals.icon, recurring.icon).
export const ICONS: Record<string, LucideIcon> = {
  house: House,
  shield: Shield,
  "train-front": TrainFront,
  bus: Bus,
  car: Car,
  laptop: Laptop,
  tv: Tv,
  "shopping-cart": ShoppingCart,
  package: Package,
  utensils: Utensils,
  coffee: Coffee,
  cigarette: Cigarette,
  gift: Gift,
  shirt: Shirt,
  smartphone: Smartphone,
  zap: Zap,
  heart: Heart,
  baby: Baby,
  "paw-print": PawPrint,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  plane: Plane,
  briefcase: Briefcase,
  wallet: Wallet,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  "life-buoy": LifeBuoy,
  target: Target,
  repeat: Repeat,
  tag: Tag,
};

export function iconFor(name: string | null | undefined): LucideIcon {
  return (name && ICONS[name]) || Tag;
}

/** Renders a stored icon name (falls back to a tag). */
export function AppIcon({ name, ...props }: { name: string | null | undefined } & LucideProps) {
  return createElement(iconFor(name), props);
}

export const CATEGORY_ICONS = [
  "house", "shield", "train-front", "car", "laptop", "tv", "shopping-cart", "package", "utensils",
  "coffee", "cigarette", "gift", "shirt", "smartphone", "zap", "heart", "baby", "paw-print", "dumbbell", "tag",
];

export const GOAL_ICONS = [
  "life-buoy", "car", "house", "plane", "trending-up", "briefcase", "graduation-cap", "baby", "heart", "gift", "piggy-bank", "target",
];
