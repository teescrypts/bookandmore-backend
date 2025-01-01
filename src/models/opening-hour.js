const mongoose = require("mongoose");

const timeSlotSchema = new mongoose.Schema({
  from: { type: String, required: true },
  to: { type: String, required: true },
});

const openingHoursSchema = new mongoose.Schema({
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
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  monday: { type: [timeSlotSchema], default: [] },
  tuesday: { type: [timeSlotSchema], default: [] },
  wednesday: { type: [timeSlotSchema], default: [] },
  thursday: { type: [timeSlotSchema], default: [] },
  friday: { type: [timeSlotSchema], default: [] },
  saturday: { type: [timeSlotSchema], default: [] },
  sunday: { type: [timeSlotSchema], default: [] },
  availability: {
    type: String,
    required: true,
    enum: ["available", "unavailable"],
    default: "available",
  },
});

const OpeningHour = mongoose.model("OpeningHour", openingHoursSchema);

module.exports = OpeningHour;
