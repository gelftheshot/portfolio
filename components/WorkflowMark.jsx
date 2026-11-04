export default function WorkflowMark({ className = "" }) {
  return (
    <svg
      className={`workflow-mark ${className}`.trim()}
      viewBox="0 0 44 40"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 20h10m8 0h3a7 7 0 0 0 7-7v-2m-7 9a7 7 0 0 1 7 7v2" />
      <circle cx="6" cy="20" r="4" />
      <circle cx="24" cy="20" r="4" />
      <circle cx="38" cy="7" r="4" />
      <circle cx="38" cy="33" r="4" />
    </svg>
  );
}
