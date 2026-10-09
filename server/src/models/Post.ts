
import mongoose, { Schema, type Model, type Types } from "mongoose";

export type PostCategory = "feature" | "bug" | "improvement";

export type PostStatus =
  | "open"
  | "planned"
  | "in-progress"
  | "shipped";

export interface IPost {
  title: string;
  description: string;
  category: PostCategory;
  status: PostStatus;
  author: Types.ObjectId;
  voteCount: number;
  adminReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ["feature", "bug", "improvement"],
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "planned", "in-progress", "shipped"],
      default: "open",
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    voteCount: {
      type: Number,
      default: 0,
    },
    adminReply: {
      type: String,
    },
  },
  { timestamps: true }
);

postSchema.index({ status: 1 });
postSchema.index({ category: 1 });
postSchema.index({ voteCount: -1, createdAt: -1 });
postSchema.index({ createdAt: -1 });

const Post: Model<IPost> =
  mongoose.models.Post || mongoose.model<IPost>("Post", postSchema);

export default Post;
