const mongoose = require("mongoose");

const AddonSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Service",
  },
  type: {
    type: String,
    enum: ["product", "service"],
    required: true,
  },
  addonService: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "Service",
  },
  //   addonProduct: {
  //     type: mongoose.Schema.Types.ObjectId,
  //     required: true,
  //     ref: "Product",
  //   },
  free: {
    type: Boolean,
    default: false,
  },
});

const Addon = mongoose.model("Addon", AddonSchema);

module.exports = Addon;
