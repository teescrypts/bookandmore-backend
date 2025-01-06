const express = require("express");
const Branch = require("../models/branch");
const Service = require("../models/service");
const BookingSettings = require("../models/booking-settings");
const getBookingDates = require("../utils/get-booking-dates");
const OpeningHour = require("../models/opening-hour");
const getDayOfWeek = require("../utils/get-day-of-the-week");
const generateAvailableSlots = require("../utils/get-available-slots");
const convertDurationToMinutes = require("../utils/convert-to-minutes");
const auth = require("../middleware/auth");
const Appointment = require("../models/booking");
const isPaymentMethodRequired = require("../utils/is-payment-method-required");
const getAdminId = require("../utils/get-admin-id");
const { DateTime, Interval } = require("luxon");
const Coupon = require("../models/coupon");
const CustomerInfo = require("../models/customer-info");
const PromotionCode = require("../models/promotion-code");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// ----------------------------- Customer Public Endpoints ----------------------------- //

router.post("/api/bookings", auth, async (req, res) => {
  try {
    const user = req.user;

    // Validate branch
    const branch = await Branch.findById(req.body.branch).select("address");
    if (!branch) {
      return res.status(400).json({ error: "Invalid branch specified." });
    }

    // Validate booking settings
    const settings = await BookingSettings.findOne({ branch: branch._id });
    if (!settings) {
      return res.status(400).json({ error: "Booking settings not found." });
    }

    // Check if payment method is required
    const paymentMethodRequired = await isPaymentMethodRequired(user, settings);
    if (paymentMethodRequired) {
      return res
        .status(400)
        .send({ message: "Customer payment method required." });
    }

    // Validate service
    const service = await Service.findById(req.body.service);
    if (!service) {
      return res.status(400).send({ error: "Invalid service specified." });
    }

    // Calculate fees
    const calculateFee = (feeType, feeValue, price) =>
      feeType === "percent" ? (feeValue / 100) * price : feeValue;

    const cancelFee = settings.policy.collectCancelFee
      ? calculateFee(
          settings.policy.feeTypeForCancel,
          settings.policy.cancelFeeValue,
          service.priceAmount
        )
      : null;

    const noShowFee = settings.policy.collectNoshowFee
      ? calculateFee(
          settings.policy.feeTypeForNoshow,
          settings.policy.noshowFeeValue,
          service.priceAmount
        )
      : null;

    const policy = {
      cancelFee: {
        enabled: settings.policy.collectCancelFee,
        ...(settings.policy.collectCancelFee && {
          window: settings.policy.cancellationNotice,
          fee: cancelFee,
        }),
      },
      noShowFee: {
        enabled: settings.policy.collectNoshowFee,
        ...(settings.policy.collectNoshowFee && { fee: noShowFee }),
      },
    };

    // Prepare address for tax calculation
    const { line1, city, state, postalCode, country } = branch.address;
    const address = {
      line1,
      city: city.cityName,
      state: state.stateCode,
      postal_code: postalCode,
      country: country.countryCode,
    };

    // Perform tax calculation
    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      customer_details: { address, address_source: "shipping" },
      line_items: [
        {
          amount: Math.round(service.priceAmount * 100),
          product: service.stripeData.productId,
          reference: service.name,
        },
      ],
      expand: ["line_items"],
    });

    const data = calculation.line_items.data[0];
    const taxRate = Number(
      ((data.amount_tax / service.priceAmount) * 100).toFixed(2)
    );
    const price = {
      serviceFee: service.priceAmount,
      tax: data.amount_tax / 100,
      taxRate,
      total: service.priceAmount + data.amount_tax / 100,
    };

    // Check slot availability
    const existingAppointmentCount = await Appointment.countDocuments({
      date: req.body.date,
      bookedTime: req.body.bookedTime,
      staff: req.body.staff,
    });

    if (existingAppointmentCount > 0) {
      return res.status(400).send({ error: "Selected slot is not available." });
    }

    // Create and save appointment
    const appointment = new Appointment({
      owner: user._id,
      price,
      policy,
      ...req.body,
    });

    await CustomerInfo.findOneAndUpdate(
      { customer: user._id },
      {
        $inc: { totalAppointments: 1 },
      }
    );

    await appointment.save();

    res.status(200).send({ message: "Appointment booked successfully." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/bookings/fetch/locations", async (req, res) => {
  try {
    const adminId = await getAdminId();

    
    if (!adminId)
      return res.send({ error: "Still setting up. Please try again later" });

    const branches = await Branch.find({
      admin: adminId,
    }).select("name address opened timeZone");

    res.send({ message: branches });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/bookings/fetch/services", async (req, res) => {
  try {
    const services = await Service.find({
      branch: req.query.branch,
    })
      .select(
        "name description priceAmount estimatedTime staffs bufferTime stripeData"
      )
      .populate({ path: "staffs", select: "fname lname active" });

    res.send({ message: services });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/bookings/fetch/available-slots", async (req, res) => {
  const { ownerId, branchId, estimatedServiceTime } = req.body;

  try {
    // Fetch branch and timezone
    const selectedBranch = await Branch.findById(branchId).select("timeZone");
    if (!selectedBranch) {
      return res.status(404).send({ error: "Branch not found" });
    }
    const timeZone = selectedBranch.timeZone;

    // Fetch opening hours
    const openingHours = await OpeningHour.findOne({
      owner: ownerId,
      branch: branchId,
    });

    if (!openingHours) {
      return res.status(404).send({ error: "Opening hours not found" });
    }

    // Fetch booking settings
    const bookingSettings = await BookingSettings.findOne({ branch: branchId });
    if (!bookingSettings) {
      return res.status(404).send({ error: "Booking settings not found" });
    }

    // Fetch existing appointments
    const appointments = await Appointment.find({
      staff: ownerId,
      branch: branchId,
    }).select("bookedTimeWithBuffer date");

    // Lead time and booking window
    const leadTimeHours = bookingSettings.leadTime;
    const bookingWindowDays = bookingSettings.bookingWindow;

    // Calculate current time and booking window end
    const now = DateTime.now().setZone(timeZone).plus({ hours: leadTimeHours });
    const bookingWindowEnd = now.plus({ days: bookingWindowDays });

    // Parse estimated service time
    const serviceDurationMinutes =
      estimatedServiceTime.hours * 60 + estimatedServiceTime.minutes;

    const availability = [];

    // Iterate through each day within the booking window
    for (
      let day = now.startOf("day");
      day < bookingWindowEnd;
      day = day.plus({ days: 1 })
    ) {
      const dayName = day.toFormat("cccc").toLowerCase(); // e.g., "monday"
      const timeSlots = openingHours[dayName];

      if (!timeSlots || timeSlots.length === 0) {
        availability.push({ date: day.toISODate(), slots: [] });
        continue;
      }

      const dailyAvailability = [];

      // Iterate through each time slot
      for (const slot of timeSlots) {
        const slotStart = DateTime.fromISO(`${day.toISODate()}T${slot.from}`, {
          zone: timeZone,
        });
        const slotEnd = DateTime.fromISO(`${day.toISODate()}T${slot.to}`, {
          zone: timeZone,
        });

        let currentStart = slotStart;

        // Iterate through time slots and check for conflicts
        while (
          currentStart.plus({ minutes: serviceDurationMinutes }) <= slotEnd
        ) {
          const proposedInterval = Interval.fromDateTimes(
            currentStart,
            currentStart.plus({ minutes: serviceDurationMinutes })
          );

          const isConflict = appointments.some((appointment) => {
            const appointmentStart = DateTime.fromISO(
              `${appointment.date}T${appointment.bookedTimeWithBuffer.from}`,
              { zone: timeZone }
            );
            const appointmentEnd = DateTime.fromISO(
              `${appointment.date}T${appointment.bookedTimeWithBuffer.to}`,
              { zone: timeZone }
            );

            const appointmentInterval = Interval.fromDateTimes(
              appointmentStart,
              appointmentEnd
            );

            return proposedInterval.overlaps(appointmentInterval);
          });

          if (!isConflict) {
            // dailyAvailability.push({
            //   from: currentStart.toFormat("HH:mm"),
            //   to: currentStart
            //     .plus({ minutes: serviceDurationMinutes })
            //     .toFormat("HH:mm"),
            // });

            dailyAvailability.push(currentStart.toFormat("HH:mm"));
          }

          currentStart = currentStart.plus({ minutes: 15 }); // Increment by a minimum buffer (e.g., 15 minutes)
        }
      }

      if (dailyAvailability.length > 0) {
        availability.push({
          date: day.toISODate(),
          slots: dailyAvailability,
        });
      }
    }

    res.status(200).send({ message: availability });
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

router.get("/api/bookings/fetch/validCoupons", async (req, res) => {
  const { addedServiceId, branch } = req.query;

  if (!addedServiceId || !branch) {
    return res
      .status(400)
      .send({ error: "addedServiceId and branch are required" });
  }

  try {
    // Fetch the branch and its time zone
    const selectedBranch = await Branch.findById(branch).select("timeZone");
    if (!selectedBranch) {
      return res.status(404).send({ error: "Branch not found" });
    }
    const timeZone = selectedBranch.timeZone;

    // Get current date and time in the branch's time zone using Luxon
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    // Query to find active coupons that match the addedServiceId and have not expired
    const coupons = await Coupon.find({
      addedServices: addedServiceId,
      branch: branch,
      expiresAt: { $gte: currentDate }, // Only fetch coupons that have not expired
    })
      .select("value valueType promotionCodes expiresAt") // Select only required fields
      .populate("promotionCodes", "code") // Optional: populate promotion codes (adjust as needed)
      .exec();

    if (coupons.length === 0) {
      return res.status(404).send({
        message: "No active coupons found for this service and branch",
      });
    }

    // Map the coupon data for response
    const couponData = coupons.map((coupon) => ({
      value: coupon.value,
      valueType:
        coupon.valueType === "percent_off"
          ? `${coupon.value}%`
          : `$${coupon.value}`,
      promotionCodes: coupon.promotionCodes.map((code) => code.code),
    }));

    res.status(200).send({ message: couponData });
  } catch (error) {
    res.status(500).send({ error: "Server error" });
  }
});

router.get("/api/bookings/fetch/booking-settings", async (req, res) => {
  const { location } = req.query;
  try {
    const settings = await BookingSettings.findOne({
      branch: location,
    }).populate({ path: "branch", select: "timeZone" });

    if (!settings) {
      return res.send({
        message: "We are still setting up. Please try again later",
      });
    }

    res.status(201).send({ message: settings });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/bookings", auth, async (req, res) => {
  const user = req.user;

  try {
    const bookings = await Appointment.find({ owner: user._id })
      .sort({ createdAt: -1 }) // Sort by creation time (descending)
      .limit(req.query?.limit || 20)
      .populate({ path: "service", select: "name description stripeData" })
      .populate({ path: "staff", select: "fname lname email" })
      .populate({ path: "branch", select: "name" });

    if (!bookings || bookings.length === 0) {
      return res.send({ message: bookings });
    }

    const enhancedBookings = await Promise.all(
      bookings.map(async (booking) => {
        const selectedBranch = await Branch.findById(booking.branch).select(
          "timeZone"
        );

        if (!selectedBranch) {
          return {
            ...booking.toObject(),
            actions: {
              cancellable: false,
              rescheduable: false,
              payable: false,
            },
          };
        }

        const timeZone = selectedBranch.timeZone;
        const now = DateTime.now().setZone(timeZone);

        const appointmentDateTime = DateTime.fromISO(
          `${booking.date}T${booking.bookedTime.from}`,
          { zone: timeZone }
        );

        let actions = {
          cancellable: false,
          payable: false,
        };

        if (booking.status === "pending") {
          if (now < appointmentDateTime) {
            actions.cancellable = true;
          } else {
            actions.payable = true;
          }
        } else if (
          booking.status === "completed" ||
          booking.status === "cancelled"
        ) {
          actions = { cancellable: false, payable: false };
        }

        return {
          ...booking.toObject(),
          actions,
        };
      })
    );

    return res.status(200).send({ message: enhancedBookings });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/check-action/bookings", auth, async (req, res) => {
  const user = req.user;

  if (user.type !== "customer") {
    return res.send({ error: "Invalid operation" });
  }
  const { window, fee, branch, bookedTime, bookedDate } = req.body;

  try {
    const selectedBranch = await Branch.findById(branch).select("timeZone");

    if (!selectedBranch) {
      return res.status(404).send({ error: "Branch not found." });
    }

    const timeZone = selectedBranch.timeZone;
    const now = DateTime.now().setZone(timeZone);

    const bookedDateTime = DateTime.fromISO(`${bookedDate}T${bookedTime}`, {
      zone: timeZone,
    });

    const adjustedDateTime = bookedDateTime.minus({ hours: window });

    if (now > adjustedDateTime) {
      return res.status(200).send({
        message: {
          condition: `Cancelling will incur a cancellation fee of ${fee} USD.`,
          charge: true,
        },
      });
    } else {
      return res.status(200).send({
        message: {
          condition: "You can cancel without being charged.",
          charge: false,
        },
      });
    }
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/booking/cancel/:id", auth, async (req, res) => {
  const user = req.user;
  const { charge, amount, branch, bookedDate, bookedTime, collectFee, window } =
    req.body;

  try {
    if (collectFee) {
      const selectedBranch = await Branch.findById(branch).select("timeZone");

      if (!selectedBranch) {
        return res.status(404).send({ error: "Branch not found." });
      }

      const timeZone = selectedBranch.timeZone;
      const now = DateTime.now().setZone(timeZone);

      const bookedDateTime = DateTime.fromISO(`${bookedDate}T${bookedTime}`, {
        zone: timeZone,
      });

      const adjustedDateTime = bookedDateTime.minus({ hours: window });

      const isPast = now > adjustedDateTime;

      if (!charge && isPast) {
        return res.send({
          error: "The free cancellation window has just closed.",
        });
      }
    }

    if (charge) {
      const customerInfo = await CustomerInfo.findOne({
        customer: user._id,
      }).select("stripePaymentMethodId");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: "usd",
        customer: user.stripeCustomer,
        payment_method: customerInfo.stripePaymentMethodId,
        return_url: `${process.env.FRONTEND_BASE_URL}/demo/barber/dashboard/appointments`,
        // off_session: true,
        confirm: true,
      });

      if (paymentIntent.status === "succeeded") {
        await Appointment.findByIdAndUpdate(req.params.id, {
          status: "cancelled",
        });

        res.send({
          message: `Appointment Cancelled and your card was charged ${amount} USD`,
        });
      } else {
        res.send({ error: `Unable to charge card. ${paymentIntent.status}` });
      }
    } else {
      await Appointment.findByIdAndUpdate(req.params.id, {
        status: "cancelled",
      });

      res.send({ message: "Appointment Cancelled" });
    }
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

router.post("/api/bookings/validate/coupon-code", auth, async (req, res) => {
  const user = req.user;
  const { code, amount, branch, serviceId } = req.body;

  try {
    // Find the promotion code and populate coupon details
    const promotionCode = await PromotionCode.findOne({
      code: code.toUpperCase(),
      active: true,
    }).populate({
      path: "coupon",
      select: "expiresAt valueType value addedServices",
    });

    if (!promotionCode) {
      return res.status(400).send({ error: "Invalid code" });
    }

    // Check if the promotion code is limited to first transactions
    const limitToFirstTransaction =
      promotionCode.restrictions?.firstTransactionOnly;

    if (limitToFirstTransaction) {
      const customerInfo = await CustomerInfo.findById(user._id).select(
        "firstTransaction"
      );

      if (!customerInfo || !customerInfo.firstTransaction) {
        return res
          .status(400)
          .send({ error: "Code is limited to first transaction only" });
      }
    }

    // Check if the amount meets the minimum restriction
    const minimumAmount = promotionCode.restrictions?.minimumAmount;
    if (minimumAmount && amount < minimumAmount) {
      return res.status(400).send({
        error: `The minimum amount to qualify is ${minimumAmount} USD`,
      });
    }

    // Get the branch details and current time in the branch's timezone
    const selectedBranch = await Branch.findById(branch).select("timeZone");

    if (!selectedBranch) {
      return res.status(404).send({ error: "Branch not found." });
    }

    const timeZone = selectedBranch.timeZone;
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    // Check if the coupon has expired
    const coupon = promotionCode.coupon;
    const stripeCoupon = await stripe.coupons.retrieve(
      coupon.stripeData.coupondId
    );

    if (!stripeCoupon) return res.send({ error: "Invalid Coupon" });

    if (!stripeCoupon.valid)
      return res.send({ error: "Coupon Is no more valid" });

    const couponServices = promotionCode.coupon.addedServices;

    const isPresent = couponServices.find(
      (service) => service.toString() === serviceId
    );

    if (!isPresent)
      return res.send({ error: "Code can not be applied to this service" });

    if (new Date(coupon.expiresAt) < currentDate) {
      return res.status(400).send({ error: "Coupon has expired" });
    }

    // Calculate the discount
    let discount = 0;
    if (coupon.valueType === "percent_off") {
      discount = Number((coupon.value / 100) * amount);
    } else if (coupon.valueType === "amount_off") {
      discount = coupon.value;
    }

    // Ensure the discount doesn't exceed the total amount
    discount = Math.min(discount, amount);

    return res.status(200).send({
      message: { discount, coupondId: coupon._id },
    });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
