import { C } from "./theme";

export default function Card({
  children,
  title,
  sub,
  className = "",
  accent,
  tint,
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-5 sm:p-6 ${className}`}
      style={{
        background: tint || C.card,
        boxShadow:
          "0 1px 0 rgba(70,63,92,0.04), 0 12px 28px -16px rgba(70,63,92,0.22)",
      }}>
      {accent && (
        <div
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: accent }}
        />
      )}
      {title && (
        <div className="mb-2">
          <h3
            className="font-semibold text-[12px] sm:text-[13px] tracking-[0.08em] uppercase"
            style={{ color: accent || C.lavender }}>
            {title}
          </h3>
          {sub && (
            <p className="text-[12px] mt-0.5" style={{ color: C.inkFaint }}>
              {sub}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}
