
import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

interface StoredUser {
  role?: string;
}

export default function AdminRoute({
  children,
}: {
  children: ReactNode;
}) {
  const token = localStorage.getItem("productlift_token");
  const storedUser = localStorage.getItem("productlift_user");

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  let user: StoredUser | null = null;

  try {
    user = storedUser ? (JSON.parse(storedUser) as StoredUser) : null;
  } catch {
    user = null;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/app" replace />;
  }

  return children;
}
