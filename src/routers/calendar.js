const express = require("express");
const auth = require("../middleware/auth");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const Appointment = require("../models/booking");
const { DateTime } = require("luxon");
const router = new express.Router();

router.get("/api/calendar/get/time-zone", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (branchId) => {
    const branch = await Branch.findById(branchId).select("timeZone");
    res.send({ message: branch.timeZone });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          return res.send({ message: "No active branch found" });
        }

        await eventHandler(activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("calendar", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/calendar/get/appointments", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (branchId) => {
    const { startDate, endDate } = req.query;

    // Validate date range
    if (!startDate || !endDate) {
      return res
        .status(400)
        .send({ error: "startDate and endDate are required" });
    }

    const branch = await Branch.findById(branchId).select("timeZone");
    if (!branch) {
      return res.status(404).send({ error: "Branch not found" });
    }

    const timeZone = branch.timeZone;
    const now = DateTime.now().setZone(timeZone);

    // Ensure dates are in the format YYYY-MM-DD
    const start = startDate;
    const end = endDate;

    // Fetch appointments within the date range
    const appointments = await Appointment.find({
      date: {
        $gte: start,
        $lte: end,
      },
      staff: user._id,
      branch: branchId,
    })
      .populate({
        path: "service",
        select: "name description color",
      })
      .populate({
        path: "owner",
        select: "fname lname email",
      })
      .populate({
        path: "staff",
        select: "fname lname email",
      });

    // Enhance appointments with comparison to current date and time
    const enhancedAppointments = appointments.map((appointment) => {
      const appointmentDateTimeFrom = DateTime.fromISO(
        `${appointment.date}T${appointment.bookedTime.from}`,
        { zone: timeZone }
      );
      //   const appointmentDateTimeTo = DateTime.fromISO(
      //     `${appointment.date}T${appointment.bookedTime.to}`,
      //     { zone: timeZone }
      //   );
      const isPast = appointmentDateTimeFrom < now;

      return {
        ...appointment.toObject(),
        id: appointment._id,
        isPast,
        // start: appointmentDateTimeFrom.toSeconds(), // Unix epoch time in seconds
        // end: appointmentDateTimeTo.toSeconds(), // Unix epoch time in seconds
      };
    });

    res.status(200).send({ message: enhancedAppointments });
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          return res
            .status(404)
            .send({ error: "No active branch found for admin" });
        }

        await eventHandler(activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("calendar", user._id);

        if (!isPermitted) {
          return res.status(403).send({ error: "Invalid Operation" });
        }

        await eventHandler(user.branch);
        break;
      }

      default:
        throw new Error("Invalid Operation");
    }
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
