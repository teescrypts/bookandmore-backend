const mongoose = require("mongoose");

const stripeTaxSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    active: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const StripeTax = mongoose.model("StripeTax", stripeTaxSchema);

module.exports = StripeTax;
