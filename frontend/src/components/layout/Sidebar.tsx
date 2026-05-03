"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Mic, History, Users } from "lucide-react";

const navItems = [
  { href: "/workspace", label: "语音生成", icon: Mic },
  { href: "/history", label: "任务历史", icon: History },
  { href: "/voices", label: "音色中心", icon: Users },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 flex-col border-r bg-white md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold">MiMo TTS</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
