export default function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Qhatu"
    >
      <rect width="100" height="100" rx="22" fill="#047857" />
      <defs>
        <clipPath id="qhatu-logo-basket">
          <circle cx="46" cy="50" r="30" />
        </clipPath>
      </defs>
      <g clipPath="url(#qhatu-logo-basket)">
        <circle cx="46" cy="50" r="30" fill="#ecfdf5" />
        <rect x="10" y="36" width="72" height="7" fill="#047857" />
        <rect x="10" y="48" width="72" height="7" fill="#047857" />
        <rect x="10" y="60" width="72" height="7" fill="#047857" />
      </g>
      <rect
        x="66"
        y="66"
        width="9"
        height="26"
        rx="4"
        fill="#ecfdf5"
        transform="rotate(45 70 79)"
      />
    </svg>
  );
}
