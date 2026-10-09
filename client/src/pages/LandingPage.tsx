
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-hidden bg-(--page-bg) text-(--text) transition-colors duration-200">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3"
          aria-label="ProductLift home"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-(--accent) text-2xl font-black text-(--accent-text)">
            P
          </span>

          <span className="text-xl font-bold tracking-tight">
            product<span className="text-(--accent)">lift</span>
          </span>
        </button>

        <nav className="flex items-center gap-3 sm:gap-5">
          <ThemeToggle />

          <button
            onClick={() => navigate("/login")}
            className="text-sm text-(--text-muted) transition hover:text-(--text)"
          >
            Log in
          </button>

          <button
            onClick={() => navigate("/login?mode=register")}
            className="rounded-lg bg-(--accent) px-4 py-2.5 text-sm font-bold text-(--accent-text) transition hover:opacity-85"
          >
            Get started ↗
          </button>
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 pb-24 pt-20 lg:grid-cols-2 lg:pt-28">
        <div>
          <p className="mb-6 flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-(--accent)">
            <span className="h-2 w-2 rounded-full bg-(--accent)" />
            FEEDBACK THAT MOVES PRODUCTS FORWARD
          </p>

          <h1 className="max-w-2xl text-5xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Build what your users{" "}
            <span className="text-(--accent)">actually want.</span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-8 text-(--text-muted)">
            Collect feedback, prioritize ideas, and turn your community's
            requests into a transparent product roadmap.
          </p>

          <div className="mt-9 flex flex-wrap gap-4">
            <button
              onClick={() => navigate("/login?mode=register")}
              className="rounded-lg bg-(--accent) px-6 py-3.5 font-bold text-(--accent-text) transition hover:-translate-y-0.5 hover:opacity-85"
            >
              Start building ↗
            </button>

            <button
              onClick={() => navigate("/login")}
              className="rounded-lg border border-(--border) px-6 py-3.5 font-semibold text-(--text) transition hover:opacity-80"
            >
              Sign in to ProductLift
            </button>
          </div>

          <p className="mt-6 text-sm text-(--text-muted)">
            Your users have ideas. Give those ideas a direction.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -inset-8 rounded-full bg-(--accent)/5 blur-3xl" />

          <div className="relative rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-2xl sm:p-7">
            <div className="flex items-center justify-between border-b border-(--border) pb-5">
              <div>
                <p className="text-xs text-(--text-muted)">
                  WORKSPACE / OVERVIEW
                </p>
                <h2 className="mt-2 text-xl font-semibold">
                  Feedback board
                </h2>
              </div>

              <span className="rounded-full border border-(--accent)/20 bg-(--accent)/10 px-3 py-1.5 text-xs text-(--accent)">
                ● Community
              </span>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { number: "01", label: "COLLECT" },
                { number: "02", label: "PRIORITIZE" },
                { number: "03", label: "SHIP" },
              ].map((item) => (
                <div
                  key={item.number}
                  className="rounded-xl border border-(--border) bg-(--surface-secondary) p-3 sm:p-4"
                >
                  <p className="text-xs text-(--accent)">{item.number}</p>
                  <p className="mt-3 text-xs font-semibold text-(--text-muted)">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3">
              {[
                {
                  title: "Dark mode support",
                  category: "FEATURE",
                  votes: "24 votes",
                  status: "Planned",
                },
                {
                  title: "Faster dashboard loading",
                  category: "IMPROVEMENT",
                  votes: "18 votes",
                  status: "In progress",
                },
                {
                  title: "Export reports as PDF",
                  category: "FEATURE",
                  votes: "12 votes",
                  status: "Under review",
                },
              ].map((idea) => (
                <div
                  key={idea.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-(--border) bg-(--page-bg) p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-(--text)">
                      {idea.title}
                    </p>
                    <p className="mt-2 text-[10px] tracking-wider text-(--text-muted)">
                      {idea.category} · {idea.votes}
                    </p>
                  </div>

                  <span className="shrink-0 rounded-md bg-(--surface-secondary) px-2 py-1.5 text-[10px] text-(--accent)">
                    {idea.status}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-4 text-center text-xs text-(--text-muted)">
              PREVIEW · Example ideas, not live database data
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-(--border) px-6 py-6 text-center text-sm text-(--text-muted)">
        ProductLift — better products start with listening.
      </footer>
    </main>
  );
}
