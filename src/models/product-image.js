const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema(
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
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
  },
  {
    timestamps: true,
  }
);

const ProductImage = mongoose.model("ProductImage", productImageSchema);

module.exports = ProductImage;
