type LogoProps = { className?: string; showWordmark?: boolean };

/** Redrawn SVG mark: open book with a teacher figure (inspired by the design reference). */
export function LogoMark({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} role="img" aria-label="Teacher Workspace logo">
      <title>Teacher Workspace</title>
      {/* book */}
      <path d="M4 20c6-2.2 13-1.6 20 3.2v18.6C17 37 10 36.4 4 38.4z" fill="#f47b20" />
      <path d="M44 20c-6-2.2-13-1.6-20 3.2v18.6c7-4.8 14-5.4 20-3.4z" fill="#fb9a55" />
      <path d="M24 23.2v18.6" stroke="#fff8f3" strokeWidth="1.6" />
      {/* teacher */}
      <circle cx="24" cy="9.5" r="4.4" fill="#f47b20" />
      <path
        d="M24 15.5c-4.2 0-7 2.2-7.6 5.8.4.5 1 .9 1.6 1.2 1.6.9 3.6 1.6 6 3.2 2.4-1.6 4.4-2.3 6-3.2.6-.3 1.2-.7 1.6-1.2-.6-3.6-3.4-5.8-7.6-5.8z"
        fill="#f47b20"
      />
    </svg>
  );
}

export function Logo({ className = "", showWordmark = true }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      {showWordmark && (
        <span className="leading-none">
          <span className="text-ink-soft block text-[15px] font-semibold tracking-tight">
            Teacher
          </span>
          <span className="text-ink block text-lg font-extrabold tracking-tight">Workspace</span>
        </span>
      )}
    </span>
  );
}
