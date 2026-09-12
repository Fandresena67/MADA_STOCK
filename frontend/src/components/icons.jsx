import {
  Home, LayoutDashboard, Package, FolderOpen, Warehouse, ArrowLeftRight,
  Truck, Users, ShoppingCart, Receipt, FileText, BarChart3, TriangleAlert,
  Settings, Building2, ScrollText, Boxes,
} from 'lucide-react';

/** Icônes centralisées (lucide, taille uniforme, aria-hidden par défaut). */
export const NAV_ICONS = {
  home: Home,
  dashboard: LayoutDashboard,
  products: Package,
  categories: FolderOpen,
  inventory: Warehouse,
  movements: ArrowLeftRight,
  suppliers: Truck,
  customers: Users,
  purchases: ShoppingCart,
  sales: Receipt,
  invoices: FileText,
  reports: BarChart3,
  alerts: TriangleAlert,
  settings: Settings,
  team: Users,
  companies: Building2,
  audit: ScrollText,
  stock: Boxes,
};

export function NavIcon({ name, size = 18 }) {
  const Cmp = NAV_ICONS[name] || Boxes;
  return <Cmp size={size} strokeWidth={2} aria-hidden="true" className="shrink-0" />;
}
