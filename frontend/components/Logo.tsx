interface LogoProps {
  size?: number;
  showText?: boolean;
}

export default function Logo({ size = 32, showText = false }: LogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="32" height="32" rx="8" fill="#f59e0b" fillOpacity="0.1" />
        <rect width="32" height="32" rx="8" stroke="#f59e0b" strokeOpacity="0.2" strokeWidth="1" />

        <line x1="6" y1="26" x2="26" y2="26" stroke="#f59e0b" strokeOpacity="0.25" strokeWidth="0.75" />
        <line x1="6" y1="6"  x2="6"  y2="26" stroke="#f59e0b" strokeOpacity="0.25" strokeWidth="0.75" />

        <path
          d="M6 24 C8 24 10 23 12 20 C14 17 15 14 17 11 C19 8 21 7 26 6"
          stroke="#f59e0b"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeOpacity="0.4"
        />

        <path
          d="M6 24 C8 24 10 23 12 20 C14 17 15 14 17 11 C19 8 21 7 26 6"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray="0"
        />

        <line
          x1="21" y1="8"
          x2="21" y2="26"
          stroke="#f59e0b"
          strokeWidth="1"
          strokeDasharray="2 2"
          strokeOpacity="0.5"
          strokeLinecap="round"
        />

        <circle cx="21" cy="8.5" r="2.5" fill="#f59e0b" fillOpacity="0.2" />
        <circle cx="21" cy="8.5" r="1.5" fill="#f59e0b" />

        <path
          d="M19 22 L21 26 L23 22"
          stroke="#f59e0b"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.7"
        />
      </svg>

      {showText && (
        <span className="font-bold text-base tracking-tight" style={{ color: 'var(--text-hi)' }}>
          Four<span style={{ color: '#f59e0b' }}>Cast</span>
        </span>
      )}
    </div>
  );
}
