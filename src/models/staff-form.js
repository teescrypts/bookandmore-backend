const mongoose = require("mongoose");
const validator = require("validator");

const staffFormSchema = mongoose.Schema({
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
  dob: {
    day: {
      type: String,
      required: true,
    },
    month: {
      type: String,
      required: true,
    },
    year: {
      type: String,
      required: true,
    },
  },
  category: {
    type: String,
    required: true,
    enum: ["regular", "commission"],
  },

  regularSettings: {
    allowBooking: {
      type: Boolean,
    },
  },

  commissionSettings: {
    commission: {
      type: Number,
      min: [1, "Commission must be greater than 0%."],
      max: [100, "Commission must be less than or equal to 100%."],
    },
  },

  services: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
    },
  ],

  permissions: {
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

const StaffForm = mongoose.model("StaffForm", staffFormSchema);

module.exports = StaffForm;
