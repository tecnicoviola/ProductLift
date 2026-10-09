import { validationResult, body } from "express-validator";
import type { RequestHandler } from "express";

export const handleValidationErrors: RequestHandler = (
  req,
  res,
  next
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: errors.array().map((error) => error.msg),
    });
    return;
  }

  next();
};

export const registerValidation = [
  body("name").notEmpty().withMessage("Name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),
  handleValidationErrors,
];

export const loginValidation = [
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").notEmpty().withMessage("Password is required"),
  handleValidationErrors,
];

export const postValidation = [
  body("title")
    .notEmpty()
    .withMessage("Title is required")
    .bail()
    .isLength({ min: 3, max: 100 })
    .withMessage("Title must be between 3 and 100 characters"),

  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .bail()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters"),

  body("category")
    .isIn(["feature", "bug", "improvement"])
    .withMessage("Invalid category"),

  handleValidationErrors,
];

export const statusValidation = [
  body("status")
    .optional()
    .isIn(["open", "planned", "in-progress", "shipped"])
    .withMessage("Invalid status"),

  body("adminReply")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Admin reply cannot exceed 500 characters"),

  handleValidationErrors,
];