const mongoose = require("mongoose");
const moment = require("moment-timezone");

const branchSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
    },
    address: {
      line1: {
        type: String,
        required: true,
      },
      line2: {
        type: String,
      },
      city: {
        cityName: {
          type: String,
          required: true,
        },
        cityCode: {
          type: String,
          required: true,
        },
      },
      state: {
        stateName: {
          type: String,
          required: true,
        },
        stateCode: {
          type: String,
          required: true,
        },
      },
      country: {
        countryName: {
          type: String,
          required: true,
        },
        countryCode: {
          type: String,
          required: true,
        },
      },
      postalCode: {
        type: String,
        required: true,
      },
    },

    timeZone: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          return moment.tz.names().includes(value);
        },
        message: (props) => `${props.value} is not a valid time zone!`,
      },
    },

    opened: {
      type: Boolean,
      default: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Branch = mongoose.model("Branch", branchSchema);

module.exports = Branch;
