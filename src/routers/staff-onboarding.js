const express = require("express");
const User = require("../models/user");
const StaffInfo = require("../models/staff-info");
const StaffForm = require("../models/staff-form");
const Service = require("../models/service");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/staff-onboarding/regular", async (req, res) => {
  const {
    admin,
    branch,
    formId,
    fname,
    lname,
    email,
    dob,
    permissions,
    password,
  } = req.body;

  try {
    const user = new User({
      fname,
      lname,
      email,
      password,
      type: "staff",
      admin,
      branch,
      dob,
    });

    const newUser = await user.save();

    const staffInfo = new StaffInfo({
      admin,
      branch,
      staff: newUser._id,
      type: "regular",
      permissions,
    });

    await staffInfo.save();

    const services = req.body.services;

    if (services.length > 0) {
      await Promise.all(
        services.map(async (serviceId) => {
          const service = await Service.findById(serviceId);
          if (service) {
            service.staffs.push(user._id);
            await service.save();
          }
        })
      );
    }

    await StaffForm.findOneAndDelete({ _id: formId });

    res.status(201).send({ message: "Onboarded succesfully" });
  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
});

router.post("/api/staff-onboarding/commission", async (req, res) => {
  const {
    admin,
    branch,
    formId,
    fname,
    lname,
    email,
    dob,
    commission,
    permissions,
    password,
  } = req.body;

  try {
    const account = await stripe.accounts.create({
      country: "US",
      email,
      controller: {
        stripe_dashboard: {
          type: "express",
        },
        fees: {
          payer: "application",
        },
        losses: {
          payments: "application",
        },
      },
    });

    const user = new User({
      fname,
      lname,
      email,
      password,
      type: "staff",
      admin,
      branch,
      dob,
    });

    const newUser = await user.save();

    const staffInfo = new StaffInfo({
      admin,
      branch,
      staff: newUser._id,
      type: "commission",
      commission,
      permissions,
      stripeAccountId: account.id,
    });

    await staffInfo.save();
    
    const services = req.body.services;

    if (services.length > 0) {
      await Promise.all(
        services.map(async (serviceId) => {
          const service = await Service.findById(serviceId);
          if (service) {
            service.staffs.push(user._id);
            await service.save();
          }
        })
      );
    }

    await StaffForm.findOneAndDelete({ _id: formId });

    res.status(200).send({ message: account.id });
  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
});

router.post("/api/staff-onboarding/account-session", async (req, res) => {
  const { account } = req.body;

  try {
    const accountSession = await stripe.accountSessions.create({
      account: account,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    res.status(201).send({ message: accountSession.client_secret });
  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
});

module.exports = router;
