const express = require("express");
const auth = require("../middleware/auth");
const Rent = require("../models/rent");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.get("/api/billings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (action) => {
    const rent = await Rent.findOne({ tenant: user._id }).select(
      "stripeCustomer stripeSubscription"
    );

    if (action === "cancel") {
      const session = await stripe.billingPortal.sessions.create({
        customer: rent.stripeCustomer,
        return_url: `${process.env.FRONTEND_BASE_URL}/tenant/account`,
        flow_data: {
          type: "subscription_cancel",
          subscription_cancel: {
            subscription: rent.stripeSubscription,
          },
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${process.env.FRONTEND_BASE_URL}/tenant/account?action-completed=true`,
            },
          },
        },
      });

      const url = session.url;
      res.status(201).send({ message: url });
    }

    if (action === "update") {
      const session = await stripe.billingPortal.sessions.create({
        customer: rent.stripeCustomer,
        return_url: `${process.env.FRONTEND_BASE_URL}/tenant/account`,
        flow_data: {
          type: "payment_method_update",
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${process.env.FRONTEND_BASE_URL}/tenant/account?action-completed=true`,
            },
          },
        },
      });

      const url = session.url;
      res.status(201).send({ message: url });
    }
  };

  try {
    switch (user.type) {
      case "tenant":
        await eventHandler(req.query.action);
        break;

      default:
        res.status(400).send({ error: "Invalid Operation" });
        break;
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
