
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";

type AuthMode = "login" | "register";

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    id?: string;
    name: string;
    email: string;
    role?: string;
  };
  message?: string;
  errors?: string[];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<AuthMode>(
    searchParams.get("mode") === "register" ? "register" : "login"
  );

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/register";

      const body =
        mode === "login"
          ? { email, password }
          : { name, email, password };

      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data: AuthResponse = await response.json();

      if (!response.ok || !data.success || !data.token || !data.user) {
        throw new Error(
          data.errors?.join(", ") ||
            data.message ||
            "Authentication failed. Please try again."
        );
      }

      localStorage.setItem("productlift_token", data.token);
      localStorage.setItem("productlift_user", JSON.stringify(data.user));

      // Admins go to the admin dashboard.
      // Normal users go to the feedback board.
      if (data.user.role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/app", { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the server."
      );
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setPassword("");
  }

  const inputClass =
    "w-full rounded-lg border border-(--border) bg-(--page-bg) px-4 py-3 text-(--text) outline-none transition placeholder:text-(--text-muted) focus:border-(--accent)";

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-(--page-bg) px-5 py-10 text-(--text) transition-colors duration-200">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <section className="w-full max-w-md">
        <Link to="/" className="mb-10 flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent) text-2xl font-black text-(--accent-text)">
            P
          </span>

          <span className="text-2xl font-bold tracking-tight">
            product<span className="text-(--accent)">lift</span>
          </span>
        </Link>

        <div className="rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-2xl sm:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-(--accent)">
            YOUR PRODUCT. YOUR COMMUNITY.
          </p>

          <h1 className="mt-4 text-3xl font-bold tracking-tight">
            {mode === "login" ? "Welcome back." : "Create your account."}
          </h1>

          <p className="mt-3 text-sm leading-6 text-(--text-muted)">
            {mode === "login"
              ? "Log in to share feedback and help shape the roadmap."
              : "Join ProductLift and help build better products."}
          </p>

          <div className="mt-7 grid grid-cols-2 rounded-lg border border-(--border) bg-(--page-bg) p-1">
            <button
              type="button"
              onClick={() => changeMode("login")}
              aria-pressed={mode === "login"}
              className={`rounded-md py-2.5 text-sm font-semibold transition ${
                mode === "login"
                  ? "bg-(--accent) text-(--accent-text)"
                  : "text-(--text-muted) hover:text-(--text)"
              }`}
            >
              Log in
            </button>

            <button
              type="button"
              onClick={() => changeMode("register")}
              aria-pressed={mode === "register"}
              className={`rounded-md py-2.5 text-sm font-semibold transition ${
                mode === "register"
                  ? "bg-(--accent) text-(--accent-text)"
                  : "text-(--text-muted) hover:text-(--text)"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {mode === "register" && (
              <div>
                <label
                  htmlFor="name"
                  className="mb-2 block text-sm font-medium text-(--text)"
                >
                  Full name
                </label>

                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  minLength={1}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-(--text)"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-(--text)"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
              />
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-(--accent) px-4 py-3.5 font-bold text-(--accent-text) transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in to ProductLift ↗"
                  : "Create account ↗"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-(--text-muted)">
            <Link to="/" className="transition hover:text-(--accent)">
              ← Back to home
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-(--text-muted)">
          ProductLift · Feedback that moves products forward.
        </p>
      </section>
    </main>
  );
}
