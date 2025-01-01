const mongoose = require("mongoose");

const bookingSettingsSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Branch",
    },
    policy: {
      collectCancelFee: { type: Boolean, default: false },
      feeTypeForCancel: {
        type: String,
        enum: ["fixed", "percent"],
        default: null,
      },
      cancelFeeValue: { type: Number, default: 0 },
      cancellationNotice: {type: Number, default: 0},

      collectNoshowFee: { type: Boolean, default: false },
      feeTypeForNoshow: {
        type: String,
        enum: ["fixed", "percent"],
        default: null,
      },
      noshowFeeValue: { type: Number, default: 0 },
    },

    leadTime: { type: Number, required: true },
    bookingWindow: { type: Number, required: true },
  },
  { timestamps: true }
);

const BookingSettings = mongoose.model(
  "BookingSettings",
  bookingSettingsSchema
);

module.exports = BookingSettings;
