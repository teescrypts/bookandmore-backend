const mongoose = require("mongoose");

const ShippingOptionchema = new mongoose.Schema(
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
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    minEstimate: {
      type: Number,
      required: true,
      min: 0,
    },
    maxEstimate: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (value) {
          return value >= this.minEstimate;
        },
        message:
          "Maximum delivery estimate must be greater than or equal to the minimum delivery estimate.",
      },
    },
    unit: {
      type: String,
      enum: ["business_day", "day", "hour", "month", "week"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const ShippingOption = mongoose.model("ShippingOption", ShippingOptionchema);

module.exports = ShippingOption;
