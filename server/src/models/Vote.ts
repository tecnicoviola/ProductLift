import mongoose, { Schema, type Model, type Types } from "mongoose";

export interface IVote {
  user: Types.ObjectId;
  post: Types.ObjectId;
  createdAt: Date;
}

const voteSchema = new Schema<IVote>({
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  post: {
    type: Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

voteSchema.index({ user: 1, post: 1 }, { unique: true });

const Vote: Model<IVote> =
  mongoose.models.Vote ||
  mongoose.model<IVote>("Vote", voteSchema);

export default Vote;