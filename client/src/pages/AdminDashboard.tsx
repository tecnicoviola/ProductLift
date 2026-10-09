import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ThemeToggle from "../ThemeToggle";

type PostStatus = "open" | "planned" | "in-progress" | "shipped";
type PostCategory = "feature" | "bug" | "improvement";

interface Author {
  _id?: string;
  name?: string;
}

interface AdminPost {
  _id: string;
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  voteCount: number;
  author?: Author | string;
  createdAt: string;
  adminReply?: string;
}

interface PostsResponse {
  success: boolean;
  posts: AdminPost[];
  total?: number;
  message?: string;
}

interface UpdateResponse {
  success: boolean;
  message?: string;
  post?: AdminPost;
}

const API_URL = "http://localhost:5000/api";

const statusOptions: { value: PostStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "shipped", label: "Shipped" },
];

const categoryLabels: Record<PostCategory, string> = {
  feature: "Feature",
  bug: "Bug",
  improvement: "Improvement",
};

function getAuthorName(author?: Author | string): string {
  if (!author) return "Unknown user";
  if (typeof author === "string") return "User";
  return author.name || "Unknown user";
}

function formatDate(date: string): string {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "Unknown date";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function clearSession() {
  localStorage.removeItem("productlift_token");
  localStorage.removeItem("productlift_user");
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | PostStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingPostId, setUpdatingPostId] = useState<string | null>(null);
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const token = localStorage.getItem("productlift_token");

  const fetchPosts = useCallback(async () => {
    if (!token) {
      navigate("/login", { replace: true });
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/posts?limit=50&sort=newest`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = (await response.json()) as PostsResponse;

      if (response.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }

      if (response.status === 403) {
        navigate("/app", { replace: true });
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not load feedback.");
      }

      setPosts(data.posts);
      setReplyDrafts((current) => {
        const next = { ...current };

        for (const post of data.posts) {
          if (!(post._id in next)) {
            next[post._id] = post.adminReply ?? "";
          }
        }

        return next;
      });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [navigate, token]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  async function updatePost(
    postId: string,
    changes: { status?: PostStatus; adminReply?: string },
  ): Promise<boolean> {
    if (!token) {
      navigate("/login", { replace: true });
      return false;
    }

    const currentPost = posts.find((post) => post._id === postId);

    if (!currentPost) return false;

    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/posts/${postId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(changes),
      });

      const data = (await response.json()) as UpdateResponse;

      if (response.status === 401) {
        clearSession();
        navigate("/login", { replace: true });
        return false;
      }

      if (response.status === 403) {
        throw new Error("Admin access required. Check your account role.");
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not save your changes.");
      }

      if (data.post) {
        setPosts((current) =>
          current.map((post) =>
            post._id === postId ? { ...post, ...data.post } : post,
          ),
        );

        if (typeof data.post.adminReply === "string") {
          setReplyDrafts((current) => ({
            ...current,
            [postId]: data.post!.adminReply ?? "",
          }));
        }
      } else {
        setPosts((current) =>
          current.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  ...changes,
                }
              : post,
          ),
        );
      }

      return true;
    } catch (err) {
      setError(getErrorMessage(err));
      return false;
    }
  }

  async function handleStatusChange(
    postId: string,
    newStatus: PostStatus,
  ) {
    const currentPost = posts.find((post) => post._id === postId);

    if (
      !currentPost ||
      currentPost.status === newStatus ||
      updatingPostId !== null ||
      savingReplyId !== null
    ) {
      return;
    }

    setUpdatingPostId(postId);

    const saved = await updatePost(postId, { status: newStatus });

    if (saved) setNotice("Idea status updated successfully.");

    setUpdatingPostId(null);
  }

  async function handleSaveReply(postId: string) {
    if (savingReplyId !== null || updatingPostId !== null) return;

    const reply = (replyDrafts[postId] ?? "").trim();

    if (reply.length > 500) {
      setError("Admin replies must be 500 characters or fewer.");
      return;
    }

    setSavingReplyId(postId);

    const saved = await updatePost(postId, { adminReply: reply });

    if (saved) {
      setNotice(reply ? "Admin reply saved successfully." : "Admin reply removed.");
    }

    setSavingReplyId(null);
  }

  const visiblePosts =
    filter === "all"
      ? posts
      : posts.filter((post) => post.status === filter);

  const openCount = posts.filter((post) => post.status === "open").length;
  const plannedCount = posts.filter((post) => post.status === "planned").length;
  const inProgressCount = posts.filter(
    (post) => post.status === "in-progress",
  ).length;
  const shippedCount = posts.filter((post) => post.status === "shipped").length;

  return (
    <main className="min-h-screen bg-[var(--page-bg)] text-[var(--text)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/" className="text-xl font-bold tracking-tight">
            Product<span className="text-[var(--accent)]">Lift</span>
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
              Admin
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/app"
              className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:opacity-80"
            >
              Feedback board
            </Link>
            <Link
              to="/roadmap"
              className="hidden rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:opacity-80 sm:inline-flex"
            >
              Public roadmap
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--accent)]">
              PRODUCT MANAGEMENT
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Admin dashboard
            </h1>
            <p className="mt-2 text-[var(--text-muted)]">
              Review ideas, manage statuses, and respond to user feedback.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchPosts()}
            disabled={loading}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:opacity-80 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh ideas"}
          </button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "Open ideas", count: openCount },
            { label: "Planned", count: plannedCount },
            { label: "In progress", count: inProgressCount },
            { label: "Shipped", count: shippedCount },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <p className="text-sm text-[var(--text-muted)]">{item.label}</p>
              <p className="mt-2 text-3xl font-bold tabular-nums">{item.count}</p>
            </div>
          ))}
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Submitted ideas</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Showing {visiblePosts.length} of {posts.length} loaded ideas
            </p>
          </div>

          <select
            aria-label="Filter ideas by status"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as "all" | PostStatus)
            }
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
          >
            <option value="all">All statuses</option>
            {statusOptions.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {notice && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-[var(--accent)] p-3 text-sm"
          >
            {notice}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-500"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void fetchPosts()}
              className="mt-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className="rounded-xl border border-[var(--border)] p-12 text-center text-[var(--text-muted)]">
            Loading ideas from your database...
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-12 text-center">
            <h3 className="text-lg font-semibold">No ideas found</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {filter === "all"
                ? "Ideas submitted by users will appear here."
                : "There are no ideas with this status."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visiblePosts.map((post) => (
              <article
                key={post._id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs">
                        {categoryLabels[post.category] ?? post.category}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {post.voteCount} {post.voteCount === 1 ? "vote" : "votes"}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        Submitted {formatDate(post.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-lg font-semibold">{post.title}</h3>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[var(--text-muted)]">
                      {post.description}
                    </p>
                    <p className="mt-4 text-xs text-[var(--text-muted)]">
                      Submitted by {getAuthorName(post.author)}
                    </p>
                  </div>

                  <div className="w-full shrink-0 lg:w-52">
                    <label
                      htmlFor={`status-${post._id}`}
                      className="mb-2 block text-sm font-medium"
                    >
                      Update status
                    </label>
                    <select
                      id={`status-${post._id}`}
                      value={post.status}
                      disabled={updatingPostId !== null || savingReplyId !== null}
                      onChange={(event) =>
                        void handleStatusChange(
                          post._id,
                          event.target.value as PostStatus,
                        )
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-3 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
                    >
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                    {updatingPostId === post._id && (
                      <p className="mt-2 text-xs text-[var(--text-muted)]">
                        Saving status...
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 border-t border-[var(--border)] pt-5">
                  <label
                    htmlFor={`reply-${post._id}`}
                    className="mb-2 block text-sm font-semibold"
                  >
                    Admin reply
                  </label>
                  <textarea
                    id={`reply-${post._id}`}
                    value={replyDrafts[post._id] ?? ""}
                    onChange={(event) =>
                      setReplyDrafts((current) => ({
                        ...current,
                        [post._id]: event.target.value,
                      }))
                    }
                    maxLength={500}
                    rows={3}
                    placeholder="Respond to the user’s feedback..."
                    disabled={savingReplyId === post._id || updatingPostId !== null}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--page-bg)] px-4 py-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] disabled:opacity-50"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-[var(--text-muted)]">
                      {(replyDrafts[post._id] ?? "").length}/500 characters. Leave empty to remove the reply.
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSaveReply(post._id)}
                      disabled={
                        savingReplyId !== null ||
                        updatingPostId !== null ||
                        (replyDrafts[post._id] ?? "").trim() ===
                          (post.adminReply ?? "").trim()
                      }
                      className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-text)] hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingReplyId === post._id ? "Saving reply..." : "Save reply"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-8 text-xs leading-5 text-[var(--text-muted)]">
          The dashboard loads up to 50 ideas at a time. Status changes and admin replies are saved to the backend.
        </p>
      </section>
    </main>
  );
}