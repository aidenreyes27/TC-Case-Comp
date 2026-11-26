// Logo mark: a wrapped burrito seen end-on, drawn as concentric tortilla rings.
export default function Mark({ size = 34 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="#E9A21B" />
      <circle cx="20" cy="20" r="12.5" fill="none" stroke="#16302B" strokeWidth="2.5" strokeDasharray="60 20" />
      <circle cx="20" cy="20" r="6" fill="#C23B22" />
      <circle cx="17.5" cy="18" r="1.6" fill="#3F8F4E" />
      <circle cx="22.5" cy="21.5" r="1.4" fill="#FFFDF8" />
    </svg>
  );
}
