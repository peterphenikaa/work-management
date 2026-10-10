"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, type AuthUser } from "@/lib/api";
import { ROLE_LABEL, initials } from "@/lib/roles";

export function UserMenu({ user }: { user: AuthUser }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function logout() {
    setLoggingOut(true);
    try {
      await api.post("/auth/logout");
      router.replace("/");
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 items-center gap-2 rounded-md px-1 hover:bg-[#f1f2f4]"
      >
        <span className="hidden h-[22px] items-center rounded-[3px] bg-[#f3f0ff] px-2 text-[12px] font-semibold whitespace-nowrap text-[#5e4db2] sm:inline-flex">
          {ROLE_LABEL[user.role]}
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-[#334563] text-[11px] font-semibold text-white">
          {initials(user.name)}
        </span>
        <ChevronDown size={12} className="text-[#626f86]" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-11 right-0 z-30 w-56 rounded-lg border border-[#dfe1e6] bg-white py-1 shadow-[0_8px_16px_rgba(9,30,66,0.16)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-[13px] font-semibold text-[#172b4d]">{user.name}</p>
            <p className="truncate text-[11px] text-[#626f86]">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-[#dfe1e6]" />
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f1f2f4]"
          >
            Hồ sơ cá nhân
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-[13px] text-[#172b4d] hover:bg-[#f1f2f4]"
          >
            Cài đặt tài khoản
          </Link>
          <div className="my-1 h-px bg-[#dfe1e6]" />
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={() => void logout()}
            className="block w-full px-3 py-2 text-left text-[13px] font-medium text-[#c9372c] hover:bg-[#ffedeb] disabled:opacity-60"
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
        </div>
      )}
    </div>
  );
}
