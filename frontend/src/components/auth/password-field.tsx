"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
};

export function PasswordField({
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength = 8,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded border border-[#c7cdd6] px-2.5 pr-9 text-xs outline-none focus:border-[#0c66e4] focus:shadow-[0_0_0_1px_#0c66e4]"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        className="absolute top-1/2 right-2 -translate-y-1/2 text-[#626f86] hover:text-[#172b4d]"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
