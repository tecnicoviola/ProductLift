
import { useEffect, useState } from "react";
import AuthForm from "./AuthForm";
import ThemeToggle from "./ThemeToggle";

type PostCategory = "feature" | "bug" | "improvement";
type PostStatus = "open" | "planned" | "in-progress" | "shipped";
type CategoryFilter = "all" | PostCategory;

interface Post {
  _id: string;
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  author: { _id: string; name: string };
  voteCount: number;
  createdAt: string;
  hasVoted: boolean;
  adminReply?: string;
}

interface PostsResponse {
  success: boolean;
  posts: Post[];
  page: number;
  pages: number;
  total: number;
  message?: string;
}

interface CreatePostResponse {
  success: boolean;
  post?: Post;
  message?: string;
}

interface VoteResponse {
  success: boolean;
  message?: string;
  voted?: boolean;
  voteCount?: number;
}

interface StoredUser {
  name?: string;
  email?: string;
}

const API_URL = "http://localhost:5000/api";

function FeedbackBoard() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("productlift_token")
  );

  const [userName, setUserName] = useState(() => {
    try {
      const storedUser = localStorage.getItem("productlift_user");
      const user: StoredUser | null = storedUser
        ? JSON.parse(storedUser)
        : null;

      return user?.name ?? "";
    } catch {
      return "";
    }
  });

  const [showAuth, setShowAuth] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] =
    useState<PostCategory>("feature");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [votingPostId, setVotingPostId] = useState<string | null>(null);
  const [voteError, setVoteError] = useState("");

  function clearSession() {
    localStorage.removeItem("productlift_token");
    localStorage.removeItem("productlift_user");

    setToken(null);
    setUserName("");
  }

  // Fetch posts, including the logged-in user's vote state and team replies.
  useEffect(() => {
    const controller = new AbortController();

    async function fetchPosts() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();

        if (category !== "all") {
          params.set("category", category);
        }

        const query = params.toString();
        const url = `${API_URL}/posts${query ? `?${query}` : ""}`;

        const headers: HeadersInit = {};

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(url, {
          headers,
          signal: controller.signal,
        });

        const data: PostsResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Failed to load feedback."
          );
        }

        setPosts(data.posts);
        setTotal(data.total);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while loading feedback."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchPosts();

    return () => controller.abort();
  }, [category, refreshKey, token]);

  function formatStatus(status: PostStatus) {
    const labels: Record<PostStatus, string> = {
      open: "Open",
      planned: "Planned",
      "in-progress": "In progress",
      shipped: "Shipped",
    };

    return labels[status];
  }

  function formatCategory(value: PostCategory) {
    const labels: Record<PostCategory, string> = {
      feature: "Feature",
      bug: "Bug",
      improvement: "Improvement",
    };

    return labels[value];
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function categoryButtonClasses(value: CategoryFilter) {
    return category === value
      ? "rounded-full bg-(--accent) px-4 py-2 text-sm font-semibold text-(--accent-text) transition"
      : "rounded-full border border-(--border) bg-(--surface) px-4 py-2 text-sm text-(--text-muted) transition hover:border-(--accent) hover:text-(--text)";
  }

  function statusClasses(_status: PostStatus) {
    return "border border-(--border) bg-(--surface-secondary) text-(--accent)";
  }

  function openCreateForm() {
    if (!token) {
      setShowAuth(true);
      return;
    }

    setFormError("");
    setSuccessMessage("");
    setShowCreateForm(true);
  }

  function closeCreateForm() {
    if (submitting) return;

    setShowCreateForm(false);
    setFormError("");
  }

  // Add or remove the current user's vote.
  async function handleVote(postId: string) {
    if (votingPostId) return;

    setVoteError("");

    if (!token) {
      setShowAuth(true);
      return;
    }

    setVotingPostId(postId);

    try {
      const response = await fetch(
        `${API_URL}/posts/${postId}/vote`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data: VoteResponse = await response.json();

      if (response.status === 401) {
        clearSession();
        setVoteError(
          "Your session has expired. Please log in again."
        );
        setShowAuth(true);
        return;
      }

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Could not update your vote.");
      }

      // Use the vote count and state returned by your backend.
      if (
        typeof data.voteCount === "number" &&
        typeof data.voted === "boolean"
      ) {
        setPosts((currentPosts) =>
          currentPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  voteCount: data.voteCount!,
                  hasVoted: data.voted!,
                }
              : post
          )
        );
      } else {
        // Fallback if the API response does not include vote details.
        setRefreshKey((current) => current + 1);
      }
    } catch (err) {
      setVoteError(
        err instanceof Error
          ? err.message
          : "Something went wrong while voting. Please try again."
      );
    } finally {
      setVotingPostId(null);
    }
  }

  async function handleCreatePost(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setFormError("");
    setSuccessMessage("");

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3 || cleanTitle.length > 100) {
      setFormError("Title must be between 3 and 100 characters.");
      return;
    }

    if (
      cleanDescription.length < 10 ||
      cleanDescription.length > 1000
    ) {
      setFormError(
        "Description must be between 10 and 1000 characters."
      );
      return;
    }

    if (!token) {
      setFormError("Please log in before submitting an idea.");
      setShowCreateForm(false);
      setShowAuth(true);
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
          category: newCategory,
        }),
      });

      const data: CreatePostResponse = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401) {
          clearSession();
        }

        throw new Error(
          data.message ||
            (response.status === 401
              ? "Your session has expired. Please log in again."
              : "Could not submit your idea.")
        );
      }

      setTitle("");
      setDescription("");
      setNewCategory("feature");
      setShowCreateForm(false);
      setSuccessMessage("Your idea was submitted successfully!");

      setCategory("all");
      setRefreshKey((current) => current + 1);
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    clearSession();
    setSuccessMessage("");
    setVoteError("");
  }

  return (
    <div className="min-h-screen bg-(--page-bg) text-(--text) transition-colors duration-200">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="shrink-0 text-xl font-bold tracking-tight"
            aria-label="ProductLift home"
          >
            Product<span className="text-(--accent)">Lift</span>
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <ThemeToggle />

            {token ? (
              <>
                <span className="hidden text-sm text-(--text-muted) sm:inline">
                  Hi, {userName || "there"}
                </span>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-(--border) px-3 py-2 text-sm font-medium text-(--text-muted) transition hover:bg-(--surface-secondary) hover:text-(--text)"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuth(true)}
                className="rounded-lg border border-(--border) px-4 py-2 text-sm font-semibold text-(--text) transition hover:bg-(--surface-secondary)"
              >
                Log in
              </button>
            )}

            <button
              type="button"
              onClick={openCreateForm}
              className="rounded-lg bg-(--accent) px-3 py-2 text-sm font-semibold text-(--accent-text) transition hover:opacity-85 sm:px-4"
            >
              + Submit idea
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 sm:py-10 md:grid-cols-[220px_1fr]">
        <aside>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-(--text-muted)">
            Workspace
          </p>

          <nav className="space-y-2">
            <button
              type="button"
              className="w-full rounded-lg border border-(--accent)/20 bg-(--accent)/10 px-4 py-3 text-left font-semibold text-(--accent)"
            >
              Feedback board
            </button>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/roadmap";
              }}
              className="w-full rounded-lg px-4 py-3 text-left text-(--text-muted) transition hover:bg-(--surface) hover:text-(--text)"
            >
              Product roadmap
            </button>
          </nav>
        </aside>

        <section className="min-w-0">
          <p className="text-sm font-medium text-(--accent)">
            YOUR PRODUCT, YOUR VOICE
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            ProductLift
          </h2>

          <p className="mt-2 leading-6 text-(--text-muted)">
            Share ideas, vote for improvements, and help shape the roadmap.
          </p>

          {successMessage && (
            <div
              role="status"
              className="mt-5 rounded-lg border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-700 dark:text-green-300"
            >
              {successMessage}
              <button
                type="button"
                onClick={() => setSuccessMessage("")}
                className="ml-3 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {voteError && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
            >
              {voteError}
              <button
                type="button"
                onClick={() => setVoteError("")}
                className="ml-3 font-semibold underline"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setCategory("all")}
              className={categoryButtonClasses("all")}
            >
              All ideas
            </button>

            <button
              type="button"
              onClick={() => setCategory("feature")}
              className={categoryButtonClasses("feature")}
            >
              Features
            </button>

            <button
              type="button"
              onClick={() => setCategory("improvement")}
              className={categoryButtonClasses("improvement")}
            >
              Improvements
            </button>

            <button
              type="button"
              onClick={() => setCategory("bug")}
              className={categoryButtonClasses("bug")}
            >
              Bugs
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-(--text-muted)">
              {loading ? "Loading feedback..." : `${total} ideas in total`}
            </p>

            <button
              type="button"
              onClick={() => setRefreshKey((current) => current + 1)}
              disabled={loading}
              className="text-sm font-medium text-(--accent) hover:underline disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <div className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-8 text-center text-(--text-muted)">
              <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-(--border) border-t-(--accent)" />
              Loading feedback from ProductLift...
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-red-700 dark:text-red-300"
            >
              <p className="font-semibold">Could not load feedback</p>
              <p className="mt-2 text-sm">{error}</p>

              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="mt-4 rounded-lg border border-current px-4 py-2 text-sm font-semibold"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && posts.length === 0 && (
            <div className="mt-6 rounded-xl border border-(--border) bg-(--surface) p-8 text-center">
              <h3 className="font-semibold">No ideas found</h3>
              <p className="mt-2 text-sm text-(--text-muted)">
                There are no posts in this category yet.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            posts.map((post) => (
              <article
                key={post._id}
                className="mt-4 rounded-xl border border-(--border) bg-(--surface) p-5 shadow-sm transition hover:shadow-md sm:p-6"
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => void handleVote(post._id)}
                    disabled={votingPostId !== null}
                    aria-pressed={post.hasVoted}
                    aria-label={
                      post.hasVoted
                        ? `Remove your vote from ${post.title}`
                        : `Upvote ${post.title}`
                    }
                    title={
                      !token
                        ? "Log in to vote"
                        : post.hasVoted
                          ? "Click to remove your vote"
                          : "Click to upvote"
                    }
                    className={`flex min-w-14 flex-col items-center rounded-lg border px-3 py-2 transition disabled:cursor-wait disabled:opacity-60 ${
                      post.hasVoted
                        ? "border-(--accent) bg-(--accent) text-(--accent-text) shadow-sm"
                        : "border-(--border) bg-(--surface-secondary) text-(--text-muted) hover:border-(--accent) hover:text-(--accent)"
                    }`}
                  >
                    <span
                      className={`text-lg ${post.hasVoted ? "font-bold" : ""}`}
                    >
                      {votingPostId === post._id ? "…" : "↑"}
                    </span>
                    <span className="text-sm font-semibold">
                      {post.voteCount}
                    </span>
                    <span className="text-[10px]">
                      {post.hasVoted ? "Voted" : "Vote"}
                    </span>
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{post.title}</h3>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusClasses(post.status)}`}
                      >
                        {formatStatus(post.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-(--text-muted)">
                      {post.description}
                    </p>

                    {/* Display the response written by the ProductLift team. */}
                    {post.adminReply?.trim() && (
                      <div className="mt-4 rounded-lg border border-(--accent)/30 bg-(--surface-secondary) p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-(--accent)">
                          ProductLift team response
                        </p>

                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-(--text)">
                          {post.adminReply}
                        </p>
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-(--text-muted)">
                      <span>{formatCategory(post.category)}</span>
                      <span>·</span>
                      <span>By {post.author?.name ?? "Unknown user"}</span>
                      <span>·</span>
                      <span>{formatDate(post.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </article>
            ))}
        </section>
      </main>

      {/* Create Idea Modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateForm();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-idea-title"
            className="my-auto w-full max-w-lg rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="create-idea-title"
                  className="text-2xl font-bold"
                >
                  Submit an idea
                </h2>
                <p className="mt-2 text-sm text-(--text-muted)">
                  Tell the team what you would like to see improved.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateForm}
                disabled={submitting}
                aria-label="Close form"
                className="rounded-lg px-3 py-1 text-xl text-(--text-muted) hover:bg-(--surface-secondary) disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="mt-6 space-y-5">
              <div>
                <label
                  htmlFor="idea-title"
                  className="mb-2 block text-sm font-semibold"
                >
                  Idea title
                </label>

                <input
                  id="idea-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  minLength={3}
                  maxLength={100}
                  required
                  placeholder="e.g. Add dark mode"
                  disabled={submitting}
                  className="w-full rounded-lg border border-(--border) bg-(--page-bg) px-4 py-3 text-(--text) outline-none placeholder:text-(--text-muted) focus:border-(--accent) disabled:opacity-60"
                />

                <p className="mt-1 text-right text-xs text-(--text-muted)">
                  {title.length}/100
                </p>
              </div>

              <div>
                <label
                  htmlFor="idea-description"
                  className="mb-2 block text-sm font-semibold"
                >
                  Description
                </label>

                <textarea
                  id="idea-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  rows={5}
                  required
                  placeholder="Explain the problem this idea solves and how it would help..."
                  disabled={submitting}
                  className="w-full resize-y rounded-lg border border-(--border) bg-(--page-bg) px-4 py-3 text-(--text) outline-none placeholder:text-(--text-muted) focus:border-(--accent) disabled:opacity-60"
                />

                <p className="mt-1 text-right text-xs text-(--text-muted)">
                  {description.length}/1000
                </p>
              </div>

              <div>
                <label
                  htmlFor="idea-category"
                  className="mb-2 block text-sm font-semibold"
                >
                  Category
                </label>

                <select
                  id="idea-category"
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value as PostCategory)
                  }
                  disabled={submitting}
                  className="w-full rounded-lg border border-(--border) bg-(--page-bg) px-4 py-3 text-(--text) outline-none focus:border-(--accent) disabled:opacity-60"
                >
                  <option value="feature">Feature request</option>
                  <option value="improvement">Improvement</option>
                  <option value="bug">Bug report</option>
                </select>
              </div>

              {formError && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
                >
                  {formError}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateForm}
                  disabled={submitting}
                  className="rounded-lg border border-(--border) px-5 py-3 text-sm font-semibold text-(--text) transition hover:bg-(--surface-secondary) disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-(--accent) px-5 py-3 text-sm font-semibold text-(--accent-text) transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit idea"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAuth && (
        <AuthForm
          onSuccess={(newToken, name) => {
            localStorage.setItem("productlift_token", newToken);
            setToken(newToken);
            setUserName(name);
            setShowAuth(false);
            setVoteError("");
          }}
          onCancel={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}

export default FeedbackBoard;
