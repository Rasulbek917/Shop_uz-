export const optionalMenuItems = [
  { key: "reports", label: "Hisobotlar", href: "/admin/hisobotlar" },
  { key: "products", label: "Tovarlar", href: "/admin/tovarlar" },
  { key: "inventory", label: "Ombor", href: "/admin/ombor" },
  { key: "finance", label: "Moliya", href: "/admin/moliya" },
  { key: "staff", label: "Xodimlar", href: "/admin/xodimlar" },
  { key: "customers", label: "Mijozlar", href: "/admin/mijozlar" },
] as const;

export type MenuItemKey = (typeof optionalMenuItems)[number]["key"];
export type MenuVisibility = Partial<Record<MenuItemKey, boolean>>;

export function menuVisibilityFrom(value: unknown): MenuVisibility {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    optionalMenuItems
      .filter(({ key }) => typeof record[key] === "boolean")
      .map(({ key }) => [key, record[key]])
  ) as MenuVisibility;
}
