const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema(
  {
    service: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Service",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    staff: {
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
      cancelFee: {
        enabled: {
          type: Boolean,
          required: true,
        },
        window: {
          type: Number,
        },
        fee: {
          type: Number,
        },
      },
      noShowFee: {
        enabled: {
          type: Boolean,
          required: true,
        },
        fee: {
          type: Number,
        },
      },
    },

    price: {
      serviceFee: {
        type: Number,
        required: true,
      },
      tax: {
        type: Number,
      },
      taxRate: { type: Number },
      total: {
        type: Number,
        required: true,
      },
    },

    status: {
      type: String,
      enum: ["pending", "cancelled", "completed", "no show"],
      required: true,
      default: "pending",
    },

    date: {
      type: String,
      required: true,
    },
    bookedTime: {
      from: {
        type: String,
        required: true,
      },
      to: {
        type: String,
        required: true,
      },
    },
    bookedTimeWithBuffer: {
      from: {
        type: String,
        required: true,
      },
      to: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const Appointment = mongoose.model("Appointments", appointmentSchema);

module.exports = Appointment;
