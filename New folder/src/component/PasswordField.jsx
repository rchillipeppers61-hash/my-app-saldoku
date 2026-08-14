import { useState } from "react";
import { C } from "./theme";

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M1 12s3-8 11-8 11 8 11 8-3 8-11 8-11-8-11-8Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-10-8-10-8a18.7 18.7 0 0 1 4.22-5.94M9.9 4.24A10.4 10.4 0 0 1 12 4c7 0 10 8 10 8a18.6 18.6 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="M1 1l22 22" />
    </svg>
  );
}

export default function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  className = "mb-3",
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={className}>
      <label
        className="text-[11px] uppercase tracking-wide font-medium"
        style={{ color: C.inkFaint }}>
        {label}
      </label>
      <div className="relative mt-1.5">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          required
          autoComplete={autoComplete}
          className="w-full px-3.5 pr-11 py-3 rounded-2xl text-[15px] outline-none border-[1.5px] focus:ring-4 focus:ring-[#8B72C42A]"
          style={{
            background: "#463F5C08",
            color: C.ink,
            borderColor: "#463F5C1F",
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
          style={{ color: C.inkFaint, "--tw-ring-color": C.lavender }}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}>
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
    </div>
  );
}
