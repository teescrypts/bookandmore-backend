const mongoose = require("mongoose");

const allowedCountrySchema = mongoose.Schema(
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
    country: {
      name: {
        type: String,
        required: true,
      },
      isoCode: {
        type: String,
        required: true,
      },
    },
  },
  {
    timestamps: true,
  }
);

const AllowedCountry = mongoose.model("AllowedCountry", allowedCountrySchema);

module.exports = AllowedCountry;
