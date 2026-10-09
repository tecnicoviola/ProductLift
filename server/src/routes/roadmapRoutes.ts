import { Router } from "express";
import { getRoadmap } from "../controllers/postController";

const router = Router();

router.get("/", getRoadmap);

export default router;