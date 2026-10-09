
import { useEffect, useState } from "react";
import ThemeToggle from "../ThemeToggle";

interface LoadingPageProps {
  message?: string;
}

export default function LoadingPage({
  message = "Getting everything ready for you...",
}: LoadingPageProps) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDots((current) => (current.length >= 3 ? "." : current + "."));
    }, 400);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center bg-(--page-bg) px-6 text-(--text) transition-colors duration-200">
      <div className="absolute right-5 top-5">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center text-center">
        {/* ProductLift logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-(--accent) text-xl font-black text-(--accent-text)">
            P
          </div>

          <span className="text-2xl font-bold tracking-tight">
            ProductLift
          </span>
        </div>

        {/* Loading animation */}
        <div className="relative mb-7 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-(--border) border-t-(--accent)" />

          <div className="h-3 w-3 rounded-full bg-(--accent)" />
        </div>

        <h1 className="text-xl font-semibold sm:text-2xl">
          Just a moment
        </h1>

        <p className="mt-3 max-w-sm text-sm text-(--text-muted)">
          {message}
          <span className="inline-block w-6 text-left">{dots}</span>
        </p>

        {/* Progress indicator */}
        <div className="mt-8 h-1.5 w-48 overflow-hidden rounded-full bg-(--border)">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-(--accent)" />
        </div>

        <p className="mt-6 text-xs text-(--text-muted)">
          Turning feedback into better products.
        </p>
      </div>
    </main>
  );
}
