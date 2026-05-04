export default function HirequeLogo() {
  return (
    <div className="flex items-center justify-center gap-2">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <rect x="2" y="2" width="20" height="20" rx="6" fill="#2563EB" />
        <path
          d="M7 7V17M17 7V17M7 12H17"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <span className="text-2xl font-semibold tracking-tight">
        Hireque
      </span>
    </div>
  );
}