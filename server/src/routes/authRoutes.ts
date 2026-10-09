import { Router } from "express";
import { register, login, getMe } from "../controllers/authController";
import auth from "../middleware/auth";
import {
  registerValidation,
  loginValidation,
} from "../middleware/validate";

const router = Router();

router.post("/register", ...registerValidation, register);
router.post("/login", ...loginValidation, login);
router.get("/me", auth, getMe);

export default router;