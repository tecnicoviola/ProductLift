import { Router } from "express";
import auth, { authOptional } from "../middleware/auth";
import adminOnly from "../middleware/adminOnly";
import {
  postValidation,
  statusValidation,
} from "../middleware/validate";
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
  updateStatus,
} from "../controllers/postController";
import { toggleVote } from "../controllers/voteController";

const router = Router();

// Public routes; logged-in users can also see their vote state.
router.get("/", authOptional, getPosts);
router.get("/:id", authOptional, getPost);

// Authenticated user routes.
router.post("/", auth, ...postValidation, createPost);
router.put("/:id", auth, ...postValidation, updatePost);
router.delete("/:id", auth, deletePost);
router.post("/:id/vote", auth, toggleVote);

// Admin-only route.
router.patch(
  "/:id/status",
  auth,
  adminOnly,
  ...statusValidation,
  updateStatus
);

export default router;