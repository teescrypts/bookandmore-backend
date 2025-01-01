const mongoose = require("mongoose");

const customerInfoSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    loyaltyPoint: {
      total: {
        type: Number,
        default: 0,
      },
      redeemed: {
        type: Number,
        default: 0,
      },
    },

    referralCode: {
      value: {
        type: String,
      },
      count: {
        type: Number,
      },
    },

    referred: {
      code: {
        type: String,
      },
      used: {
        type: Boolean,
      },
    },

    firstTransaction: { type: Boolean, default: true },

    cancelledAppointments: {
      type: Number,
      default: 0,
    },
    completedAppointments: {
      type: Number,
      default: 0,
    },
    totalAppointments: {
      type: Number,
      default: 0,
    },
    purcheses: {
      type: Number,
      default: 0,
    },
    stripePaymentMethodId: { type: String },
    promotionCode: { type: String },
  },
  {
    timestamps: true,
  }
);

const CustomerInfo = mongoose.model("CustomerInfo", customerInfoSchema);

module.exports = CustomerInfo;
