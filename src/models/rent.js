const mongoose = require("mongoose");

const rentSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    tenant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
    },
    paidOn: {
      type: Number,
      required: true,
    },
    dueOn: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: [
        "incomplete",
        "incomplete_expired",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
    },
    stripeCustomer: {
      type: String,
    },
    stripePrice: {
      type: String,
    },
    stripeProduct: {
      type: String,
    },
    stripeSubscription: {
      type: String,
    },
    paymentStatus: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Rent = mongoose.model("Rent", rentSchema);

module.exports = Rent;
