"use client";

import { Lock, UserRound } from "lucide-react";
import Link from "next/link";

type AccountFrameProps = {
  active: "profile" | "settings";
  title: string;
  description: string;
  children: React.ReactNode;
};

const links = [
  { href: "/profile", id: "profile" as const, label: "Hồ sơ cá nhân", icon: UserRound },
  { href: "/settings", id: "settings" as const, label: "Cài đặt tài khoản", icon: Lock },
];

export function AccountFrame({ active, title, description, children }: AccountFrameProps) {
  return (
    <div className="px-8 py-6 text-[#172b4d]">
      <div className="w-full max-w-[920px]">
        <p className="text-[12px] text-[#626f86]">
          Tài khoản / {active === "profile" ? "Hồ sơ" : "Cài đặt"}
        </p>
        <div className="mt-2">
          <h1 className="text-[24px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-[#626f86]">{description}</p>
        </div>

        <div className="mt-6 grid items-start gap-6 md:grid-cols-[200px_minmax(0,1fr)]">
          <nav className="flex flex-col gap-1">
            {links.map((link) => {
              const Icon = link.icon;
              const selected = link.id === active;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  className={`flex h-9 items-center gap-2 rounded-md px-3 text-[13px] font-medium ${
                    selected
                      ? "bg-[#e9f2ff] text-[#0c66e4]"
                      : "text-[#44546f] hover:bg-[#f1f2f4]"
                  }`}
                >
                  <Icon size={16} />
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-col gap-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
