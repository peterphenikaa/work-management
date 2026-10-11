"use client";

import { useEffect, useState } from "react";
import { workspaceColor } from "@/components/leader/workspace-mark";
import { api } from "@/lib/api";
import { initials } from "@/lib/roles";

export function WorkspaceAvatar({
  id,
  name,
  hasIcon,
  className,
}: {
  id: string;
  name: string;
  hasIcon: boolean;
  className: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!hasIcon) {
      setSrc(null);
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    api
      .get(`/workspaces/${id}/icon`, { responseType: "blob" })
      .then((response) => {
        if (cancelled) return;
        url = URL.createObjectURL(response.data);
        setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [hasIcon, id]);

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden font-semibold text-white ${className}`}
      style={src ? undefined : { backgroundColor: workspaceColor(name) }}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" /> : initials(name)}
    </span>
  );
}
