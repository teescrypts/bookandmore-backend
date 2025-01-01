const mongoose = require("mongoose");
const validator = require("validator");

const rentFormSchema = mongoose.Schema(
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
    category: {
      type: String,
      required: true,
      enum: ["one time pay", "subscription"],
    },
    oneTimePay: {
      price: {
        type: Number,
      },
      duration: {
        type: Number,
      },
      startDate: {
        type: Date,
      },
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    tenantInfo: {
      fname: {
        type: String,
        required: true,
      },
      lname: {
        type: String,
        required: true,
      },
      email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        validate(value) {
          if (!validator.isEmail(value)) {
            throw new Error("Email is invalid");
          }
        },
      },
    },
    note: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const RentForm = mongoose.model("RentForm", rentFormSchema);

module.exports = RentForm;
