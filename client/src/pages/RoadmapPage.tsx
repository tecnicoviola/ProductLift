
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";

type PostCategory = "feature" | "bug" | "improvement";
type PostStatus = "open" | "planned" | "in-progress" | "shipped";

interface RoadmapPost {
  _id: string;
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  voteCount: number;
  createdAt: string;
  author?: {
    _id: string;
    name: string;
  };
}

interface RoadmapResponse {
  success: boolean;
  roadmap: {
    planned: RoadmapPost[];
    inProgress: RoadmapPost[];
    shipped: RoadmapPost[];
  };
  message?: string;
}

const API_URL = "http://localhost:5000/api";

const columns: {
  title: string;
  description: string;
  key: "planned" | "inProgress" | "shipped";
  status: PostStatus;
  number: string;
}[] = [
  {
    title: "Planned",
    description: "Ideas we're preparing",
    key: "planned",
    status: "planned",
    number: "01",
  },
  {
    title: "In Progress",
    description: "Work currently underway",
    key: "inProgress",
    status: "in-progress",
    number: "02",
  },
  {
    title: "Shipped",
    description: "Features already delivered",
    key: "shipped",
    status: "shipped",
    number: "03",
  },
];

function formatCategory(category: PostCategory) {
  const labels: Record<PostCategory, string> = {
    feature: "Feature",
    bug: "Bug",
    improvement: "Improvement",
  };

  return labels[category];
}

function RoadmapPage() {
  const navigate = useNavigate();

  const [roadmap, setRoadmap] = useState<RoadmapResponse["roadmap"]>({
    planned: [],
    inProgress: [],
    shipped: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchRoadmap() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_URL}/roadmap`, {
          signal: controller.signal,
        });

        const data: RoadmapResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load the product roadmap."
          );
        }

        setRoadmap(data.roadmap);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading the roadmap."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchRoadmap();

    return () => controller.abort();
  }, [refreshKey]);

  const totalItems =
    roadmap.planned.length +
    roadmap.inProgress.length +
    roadmap.shipped.length;

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--text) transition-colors duration-200">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="shrink-0 text-xl font-bold tracking-tight"
          >
            Product<span className="text-(--accent)">Lift</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <ThemeToggle />

            <button
              type="button"
              onClick={() => navigate("/app")}
              className="rounded-lg border border-(--border) px-4 py-2 text-sm font-semibold transition hover:bg-(--surface-secondary)"
            >
              Feedback board
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-semibold tracking-widest text-(--accent)">
              PRODUCT DIRECTION
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Product roadmap<span className="text-(--accent)">.</span>
            </h1>

            <p className="mt-4 max-w-2xl leading-7 text-(--text-muted)">
              See what we're planning, what we're building, and what we've
              shipped. Your feedback helps shape what comes next.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/app")}
            className="self-start rounded-lg bg-(--accent) px-5 py-3 text-sm font-semibold text-(--accent-text) transition hover:opacity-85 sm:self-auto"
          >
            + Share an idea
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {columns.map((column) => {
            const count = roadmap[column.key].length;

            return (
              <div
                key={column.key}
                className="rounded-xl border border-(--border) bg-(--surface) p-4"
              >
                <p className="text-xs font-semibold tracking-widest text-(--text-muted)">
                  {column.number}
                </p>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{column.title}</h2>

                  <span className="rounded-full border border-(--border) bg-(--surface-secondary) px-3 py-1 text-sm font-semibold">
                    {loading ? "—" : count}
                  </span>
                </div>

                <p className="mt-1 text-sm text-(--text-muted)">
                  {column.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">The journey ahead</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              {loading
                ? "Loading roadmap..."
                : `${totalItems} ideas across the roadmap`}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            disabled={loading}
            className="rounded-lg border border-(--border) px-4 py-2 text-sm font-medium transition hover:bg-(--surface-secondary) disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {loading && (
          <div className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-10 text-center text-(--text-muted)">
            <div className="mx-auto mb-4 h-7 w-7 animate-spin rounded-full border-2 border-(--border) border-t-(--accent)" />
            Loading roadmap from ProductLift...
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-6"
          >
            <h3 className="font-semibold">Couldn't load the roadmap</h3>
            <p className="mt-2 text-sm text-(--text-muted)">{error}</p>

            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              className="mt-4 rounded-lg border border-(--border) px-4 py-2 text-sm font-semibold"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className="mt-6 grid grid-cols-1 items-start gap-5 lg:grid-cols-3">
            {columns.map((column) => {
              const items = roadmap[column.key];

              return (
                <section
                  key={column.key}
                  className="min-w-0 rounded-xl border border-(--border) bg-(--surface-secondary)/40 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-(--border) px-1 pb-4">
                    <div>
                      <h3 className="font-bold">{column.title}</h3>
                      <p className="mt-1 text-xs text-(--text-muted)">
                        {column.description}
                      </p>
                    </div>

                    <span className="text-sm text-(--text-muted)">
                      {items.length} {items.length === 1 ? "idea" : "ideas"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-3">
                    {items.map((post) => (
                      <article
                        key={post._id}
                        className="rounded-xl border border-(--border) bg-(--surface) p-4 transition hover:border-(--accent)/60"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-(--border) bg-(--surface-secondary) px-2 py-1 text-xs text-(--text-muted)">
                            {formatCategory(post.category)}
                          </span>

                          <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-(--text-muted)">
                            <span className="text-(--accent)">↑</span>
                            {post.voteCount}
                          </span>
                        </div>

                        <h4 className="mt-3 font-semibold leading-6">
                          {post.title}
                        </h4>

                        <p className="mt-2 line-clamp-4 text-sm leading-6 text-(--text-muted)">
                          {post.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-(--border) pt-3 text-xs text-(--text-muted)">
                          <span>
                            By {post.author?.name ?? "ProductLift user"}
                          </span>

                          <span>
                            {new Date(post.createdAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              }
                            )}
                          </span>
                        </div>
                      </article>
                    ))}

                    {items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-(--border) p-6 text-center">
                        <div className="text-2xl text-(--text-muted)">◇</div>
                        <p className="mt-2 text-sm font-medium">
                          Nothing here yet
                        </p>
                        <p className="mt-1 text-xs leading-5 text-(--text-muted)">
                          Ideas will appear here as their status changes.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <div className="mt-10 rounded-xl border border-(--border) bg-(--surface) p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-widest text-(--accent)">
            HELP US PRIORITIZE
          </p>

          <h2 className="mt-3 text-2xl font-bold">
            Have an idea for what's next?
          </h2>

          <p className="mt-2 max-w-2xl leading-6 text-(--text-muted)">
            Visit the feedback board to submit ideas and vote for improvements
            that matter to you.
          </p>

          <button
            type="button"
            onClick={() => navigate("/app")}
            className="mt-5 rounded-lg bg-(--accent) px-5 py-3 text-sm font-semibold text-(--accent-text) transition hover:opacity-85"
          >
            Explore feedback board
          </button>
        </div>
      </main>
    </div>
  );
}

export default RoadmapPage;