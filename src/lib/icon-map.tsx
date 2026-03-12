import {
  Car, ShoppingCart, Heart, Home, Fuel, UtensilsCrossed, Pill, Building,
  Wrench, Store, Shield, Zap, Tv, GraduationCap, TrendingUp, MoreHorizontal,
  Wallet, Coffee, Plane, Shirt, Dumbbell, Music, Gift, Bus, Bike, Baby,
  PawPrint, Camera, Smartphone, Wifi, BookOpen, Briefcase, DollarSign,
  CreditCard, Landmark, ShoppingBag, Scissors, Hammer, Paintbrush, Leaf,
  Sun, Moon, Star, Package, Truck, Headphones, Monitor, Gamepad2, Flower,
  Banknote, Laptop, Percent, KeyRound, RotateCcw,
} from 'lucide-react'

import type { LucideIcon } from 'lucide-react'

/** All icons available for category selection. Add entries here to expand the picker. */
export const ICON_MAP: Record<string, LucideIcon> = {
  Car,
  ShoppingCart,
  Heart,
  Home,
  Fuel,
  UtensilsCrossed,
  Pill,
  Building,
  Wrench,
  Store,
  Shield,
  Zap,
  Tv,
  GraduationCap,
  TrendingUp,
  MoreHorizontal,
  Wallet,
  Coffee,
  Plane,
  Shirt,
  Dumbbell,
  Music,
  Gift,
  Bus,
  Bike,
  Baby,
  PawPrint,
  Camera,
  Smartphone,
  Wifi,
  BookOpen,
  Briefcase,
  DollarSign,
  CreditCard,
  Landmark,
  ShoppingBag,
  Scissors,
  Hammer,
  Paintbrush,
  Leaf,
  Sun,
  Moon,
  Star,
  Package,
  Truck,
  Headphones,
  Monitor,
  Gamepad2,
  Flower,
  Banknote,
  Laptop,
  Percent,
  KeyRound,
  RotateCcw,
}

/** Render a category icon by its stored name string. Falls back to MoreHorizontal. */
export function CategoryIcon({
  name,
  size = 18,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const Icon = ICON_MAP[name] ?? MoreHorizontal
  return <Icon size={size} className={className} />
}
