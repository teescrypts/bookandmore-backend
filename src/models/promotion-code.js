const mongoose = require("mongoose");

const promotionCodeSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Coupon",
    },
    code: {
      type: String,
      required: true,
    },
    maxRedemptions: {
      type: Number,
    },
    restrictions: {
      firstTransactionOnly: {
        type: Boolean,
      },
      minimumAmount: {
        type: Number,
      },
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
    },

    isLoyalty: {
      enabled: {
        type: Boolean,
      },
      customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    },

    stripeData: {
      promotionCodeId: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

const PromotionCode = mongoose.model("PromotionCode", promotionCodeSchema);

module.exports = PromotionCode;
