const mongoose = require("mongoose");

const blogImageSchema = new mongoose.Schema(
  {
    image: {
      type: Buffer,
      required: true,
    },
    status: {
      type: String,
      required: true,
      emum: ["draft", "upload"],
      default: "draft",
    },
    fileName: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
  },
  {
    timestamps: true,
  }
);

const BlogImage = mongoose.model("BlogImage", blogImageSchema);

module.exports = BlogImage;
