import { memo } from "react";

/**
 * Сцена по утверждённому макету «Додзё»: светлый фон и круглый помост-татами под бойцами.
 * Рисуется шире viewBox, чтобы заполнять сцену любой формы.
 */
export const DojoBackdrop = memo(function DojoBackdrop() {
  return (
    <g aria-hidden="true">
      <defs>
        <linearGradient id="matTop" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#f3eee4" />
          <stop offset="1" stopColor="#e4ddcf" />
        </linearGradient>
        <linearGradient id="matSide" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ddd5c5" />
          <stop offset="1" stopColor="#c9c0ae" />
        </linearGradient>
        <pattern id="matWeave" width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="url(#matTop)" />
          <path d="M0 2h4" stroke="#d6cebe" strokeWidth="0.4" opacity="0.6" />
        </pattern>
      </defs>
      {/* тень помоста */}
      <ellipse cx={200} cy={258} rx={176} ry={22} fill="#6f8fb5" opacity={0.22} />
      {/* боковина */}
      <path d="M22 232 A178 30 0 0 0 378 232 L378 246 A178 30 0 0 1 22 246 Z" fill="url(#matSide)" />
      {/* верх */}
      <ellipse cx={200} cy={232} rx={178} ry={30} fill="url(#matWeave)" />
      <ellipse cx={200} cy={232} rx={170} ry={27} fill="none" stroke="#d8cfbe" strokeWidth={0.8} />
      <path d="M200 202 V262" stroke="#d3cab8" strokeWidth={0.8} />
      <path d="M26 234 A174 26 0 0 0 374 234" fill="none" stroke="#ffffff" strokeWidth={0.8} opacity={0.6} />
    </g>
  );
});
