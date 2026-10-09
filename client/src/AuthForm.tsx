
import { useState } from "react";

interface AuthFormProps {
  onSuccess: (token: string, name: string) => void;
  onCancel: () => void;
}

interface AuthResponse {
  success: boolean;
  token?: string;
  user?: {
    name: string;
  };
  message?: string;
  errors?: string[];
}

export default function AuthForm({
  onSuccess,
  onCancel,
}: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
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
      const response = await fetch(
        `http://localhost:5000/api/auth/${mode === "login" ? "login" : "register"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            mode === "register"
              ? { name, email, password }
              : { email, password }
          ),
        }
      );

      const data: AuthResponse = await response.json();

      if (!response.ok || !data.success || !data.token || !data.user) {
        throw new Error(
          data.errors?.join(", ") ||
            data.message ||
            "Authentication failed."
        );
      }

      onSuccess(data.token, data.user.name);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1 text-slate-500 hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <p className="mt-2 text-sm text-slate-500">
          {mode === "login"
            ? "Log in to share and vote on ideas."
            : "Join ProductLift to help shape the roadmap."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {mode === "register" && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Name
              </label>
              <input
                required
                minLength={1}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          {mode === "login"
            ? "New to ProductLift?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError("");
            }}
            className="font-semibold text-indigo-600 hover:text-indigo-700"
          >
            {mode === "login" ? "Register" : "Log in"}
          </button>
        </p>
      </section>
    </div>
  );
}
