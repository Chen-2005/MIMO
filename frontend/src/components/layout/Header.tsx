import { MobileMenuButton } from "./MobileDrawer";

export function Header() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-4 md:px-6">
      <MobileMenuButton />
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">v0.1.0</span>
      </div>
    </header>
  );
}
