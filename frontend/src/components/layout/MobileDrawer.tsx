"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, History, Users, Menu, X } from "lucide-react";

const navItems = [
  { href: "/workspace", label: "语音生成", icon: Mic },
  { href: "/history", label: "任务历史", icon: History },
  { href: "/voices", label: "音色中心", icon: Users },
];

const CHECKBOX_ID = "mobile-drawer-toggle";

export function MobileMenuButton() {
  return (
    <label
      htmlFor={CHECKBOX_ID}
      className="flex cursor-pointer items-center rounded-lg p-2 text-gray-600 hover:bg-gray-100 md:hidden"
      aria-label="打开菜单"
    >
      <Menu className="h-5 w-5" />
    </label>
  );
}

export function MobileDrawerSetup() {
  const pathname = usePathname();

  // Close drawer on route change
  useEffect(() => {
    const checkbox = document.getElementById(CHECKBOX_ID) as HTMLInputElement | null;
    if (checkbox?.checked) {
      checkbox.checked = false;
    }
  }, [pathname]);

  return (
    <>
      <input
        type="checkbox"
        id={CHECKBOX_ID}
        className="peer hidden"
        defaultChecked={false}
      />

      {/* Backdrop */}
      <label
        htmlFor={CHECKBOX_ID}
        className="pointer-events-none fixed inset-0 z-40 bg-black/40 opacity-0 transition-opacity peer-checked:pointer-events-auto peer-checked:opacity-100 md:hidden"
      />

      {/* Drawer panel */}
      <aside className="pointer-events-none fixed inset-y-0 left-0 z-50 flex w-60 -translate-x-full flex-col bg-white shadow-lg transition-transform peer-checked:pointer-events-auto peer-checked:translate-x-0 md:hidden">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-lg font-bold">MiMo TTS</span>
          <label
            htmlFor={CHECKBOX_ID}
            className="cursor-pointer rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"
            aria-label="关闭菜单"
          >
            <X className="h-5 w-5" />
          </label>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-blue-50 text-blue-700" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
