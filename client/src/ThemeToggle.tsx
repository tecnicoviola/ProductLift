import { useTheme } from "./ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      title={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="inline-flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm font-medium text-(--text) transition hover:opacity-80"
    >
      <span aria-hidden="true">{isDark ? "☀" : "☾"}</span>
      {isDark ? "Light mode" : "Dark mode"}
    </button>
  );
}