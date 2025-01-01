const mongoose = require("mongoose");

const ServiceSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
    },
    category: {
      name: {
        type: String,
        required: true,
      },
      taxCode: {
        type: String,
        required: true,
      },
    },
    description: {
      type: String,
    },
    color: {
      type: String,
      required: true,
    },

    priceAmount: {
      type: Number,
      required: true,
    },

    estimatedTime: {
      hours: {
        type: Number,
      },
      minutes: {
        type: Number,
      },
    },
    
    bufferTime: {
      hours: {
        type: Number,
        default: 0,
      },
      minutes: {
        type: Number,
        default: 0,
      },
    },

    // homeService: {
    //   type: Boolean,
    //   default: false,
    // },
    status: {
      type: String,
      enum: ["active", "paused"],
      required: true,
      default: "active",
    },

    stripeData: {
      priceId: {
        type: String,
      },
      productId: {
        type: String,
      },
    },

    staffs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

const Service = mongoose.model("Service", ServiceSchema);

module.exports = Service;
