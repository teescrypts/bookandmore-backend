const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      // required: true,
      ref: "User",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      // required: true,
      ref: "Branch",
    },
    valueType: {
      type: String,
      required: true,
      enum: ["percent_off", "amount_off"],
    },
    value: {
      type: Number,
      required: true,
    },
    maxRedemptions: {
      type: Number,
      // required: true,
    },
    expiresAt: {
      type: Date,
      // required: true,
    },

    addedProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    addedServices: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service",
      },
    ],

    promotionCodes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PromotionCode",
      },
    ],

    stripeData: {
      couponId: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
