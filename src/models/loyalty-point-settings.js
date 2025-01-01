const mongoose = require("mongoose");

const LoyaltyPointsSettingsSchema = new mongoose.Schema({
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  // branch: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   required: true,
  //   ref: "Branch",
  // },

  active: {
    type: Boolean,
    required: true,
    default: true,
  },

  monetaryEquivalent: {
    type: Number,
    required: true,
    min: 0,
  },

  enableReferral: {
    type: Boolean,
    default: false,
  },
  minimumReferral: {
    type: Number,
    required: function () {
      return this.enableReferral;
    },
    min: 0,
  },

  enableAppointment: {
    type: Boolean,
    default: false,
  },
  minimumAmountEnabledApt: {
    type: Boolean,
    default: false,
  },
  minimumAmountApt: {
    type: Number,
    required: function () {
      return this.enableAppointment && this.minimumAmountEnabledApt;
    },
    min: 0,
  },
  appliesToApt: {
    type: Boolean,
    default: false,
  },
  aptServiceIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: function () {
        return this.appliesToApt;
      },
    },
  ],

  // Product Purchase Points Settings
  enableProduct: {
    type: Boolean,
    default: false,
  },
  minimumAmountEnabledProd: {
    type: Boolean,
    default: false,
  },
  minimumAmountProd: {
    type: Number,
    required: function () {
      return this.enableProduct && this.minimumAmountEnabledProd;
    },
    min: 0,
  },
  appliesToProd: {
    type: Boolean,
    default: false,
  },
  prodServiceIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: function () {
        return this.appliesToProd;
      },
    },
  ],
});

const LoyaltyPointsSettings = mongoose.model(
  "LoyaltyPointsSettings",
  LoyaltyPointsSettingsSchema
);

module.exports = LoyaltyPointsSettings;
