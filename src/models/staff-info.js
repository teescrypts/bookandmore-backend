const mongoose = require("mongoose");

const staffInfoSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  branch: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Branch",
    required: true,
  },

  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  type: {
    type: String,
    required: true,
    enum: ["commission", "regular"],
  },

  commission: {
    type: Number,
  },
  stripeAccountId: {
    type: String,
  },

  permissions: {
    account: {
      type: Boolean,
      required: true,
      default: true,
    },
    locations: {
      type: Boolean,
      required: true,
      default: false,
    },
    tax: {
      type: Boolean,
      required: true,
      default: false,
    },
    customers: {
      type: Boolean,
      required: true,
      default: false,
    },
    staffs: {
      type: Boolean,
      required: true,
      default: false,
    },
    services: {
      type: Boolean,
      required: true,
      default: false,
    },
    settings: {
      type: Boolean,
      required: true,
      default: false,
    },
    rent: {
      type: Boolean,
      required: true,
      default: false,
    },
    products: {
      type: Boolean,
      required: true,
      default: false,
    },
    pos: {
      type: Boolean,
      required: true,
      default: false,
    },
    orders: {
      type: Boolean,
      required: true,
      default: false,
    },
    shipping: {
      type: Boolean,
      required: true,
      default: false,
    },
    openingHours: {
      type: Boolean,
      required: true,
      default: false,
    },
    calendar: {
      type: Boolean,
      required: true,
      default: false,
    },
    blog: {
      type: Boolean,
      required: true,
      default: false,
    },
    marketing: {
      type: Boolean,
      required: true,
      default: false,
    },
  },
});

const StaffInfo = mongoose.model("StaffInfo", staffInfoSchema);

module.exports = StaffInfo;
