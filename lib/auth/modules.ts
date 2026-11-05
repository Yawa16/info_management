export type ModuleKey =
  | "customers"
  | "products"
  | "human-resources"
  | "sales"
  | "reports";

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  href: string;
  tileLabel: string;
  icon: string;
  // Code of the module row in the `module` table.
  rightsModule: string;
  // Prefix shared by the codes in the `rights` table, e.g. CUSTOMER_ADD.
  rightPrefix: string;
};

export const MODULES: readonly ModuleDefinition[] = [
  {
    key: "customers",
    label: "Customers",
    href: "/customers",
    tileLabel: "View Customers",
    icon: "♟",
    rightsModule: "CUSTOMER",
    rightPrefix: "CUSTOMER",
  },
  {
    key: "products",
    label: "Products",
    href: "/products",
    tileLabel: "Manage Products",
    icon: "▣",
    rightsModule: "PRODUCT",
    rightPrefix: "PRODUCT",
  },
  {
    key: "human-resources",
    label: "Human Resources",
    href: "/human-resources",
    tileLabel: "Human Resources",
    icon: "◉",
    rightsModule: "HUMAN_RESOURCES",
    rightPrefix: "HR",
  },
  {
    key: "sales",
    label: "Sales",
    href: "/sales",
    tileLabel: "Sales Pipeline",
    icon: "▤",
    rightsModule: "SALES",
    rightPrefix: "SALES",
  },
  {
    key: "reports",
    label: "Reports",
    href: "/reports",
    tileLabel: "Reports",
    icon: "▦",
    rightsModule: "REPORTS",
    rightPrefix: "REPORT",
  },
];

export function getModule(key: string): ModuleDefinition | undefined {
  return MODULES.find((module) => module.key === key);
}
