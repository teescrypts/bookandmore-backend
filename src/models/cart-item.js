const mongoose = require("mongoose");

const cartItemSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Branch",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Product",
    },
    quantity: {
      sizeBasedQuantity: {
        enabled: {
          type: Boolean,
          required: true,
        },
        size: {
          type: String,
        },
      },
      value: {
        type: Number,
        required: true,
      },
    },
    status: {
      type: String,
      enum: ["inCart", "removed", "purchased"],
      default: "inCart",
    },
  },
  {
    timestamps: true,
  }
);

const CartItem = mongoose.model("CartItem", cartItemSchema);

module.exports = CartItem;
