const express = require("express");
const auth = require("../middleware/auth");
const StripeTax = require("../models/stripe-tax");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/taxes/stripe/registrations", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin) => {
    const taxSettings = await stripe.tax.settings.retrieve();

    if (taxSettings.status === "pending")
      return res.send({ error: "Kindly Upload Tax Settings" });

    await stripe.tax.registrations.create({
      country: req.body.country,
      country_options: {
        us: {
          state: req.body.state,
          type: "state_sales_tax",
        },
      },
      ...(req.body.activeFrom
        ? { active_from: req.body.activeFrom }
        : { active_from: "now" }),
    });

    const existingSettings = await StripeTax.find({ admin });

    if (existingSettings.length === 0) {
      const stripeTax = new StripeTax({
        admin: user._id,
      });

      await stripeTax.save();
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("tax", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "success" });
  } catch (e) {
    res.status(401).send({ error: e.message });
  }
});

router.post("/api/taxes/stripe/settings", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin) => {
    const selectedBranch = await Branch.findOne({ _id: req.body.branch });

    if (!selectedBranch) {
      throw new Error("Invalid Operation");
    }

    const originAddress = selectedBranch.address;

    await stripe.tax.settings.update({
      defaults: {
        tax_behavior:
          req.body.taxBehavior === "automatic"
            ? "inferred_by_currency"
            : req.body.taxBehavior,
        tax_code: "txcd_20030000",
      },
      head_office: {
        address: {
          line1: originAddress.line1,
          state: originAddress.state.stateCode,
          city: originAddress.city.cityCode,
          country: originAddress.country.countryCode,
          postal_code: originAddress.postalCode,
        },
      },
    });

    const existingTax = await StripeTax.findOne({ admin });

    if (!existingTax) {
      const tax = new StripeTax({
        admin,
      });

      await tax.save();
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("tax", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Settings Updated" });
  } catch (e) {
    res.status(401).send({ error: e.message });
  }
});

// router.get("/api/taxes/stripe", auth, async (req, res) => {
//   const user = req.user;

//   const eventHandler = async () => {
//     const stripeRegistrations = await stripe.tax.registrations.list({});

//     let registrations = [];
//     if (stripeRegistrations.length > 0) {
//       registrations = registrations.map((reg) => {
//         return {
//           id: reg.id,
//           active_from: reg.active_from,
//           country: reg.country,
//           type: reg.country_options.us.type,
//           state: reg.state,
//         };
//       });
//     }

//     const stripeSettings = await stripe.tax.settings.retrieve();
//     const address = stripeSettings.head_office;
//     const settings = {
//       status: settings.status,
//       tax_behavior: settings.defaults.tax_behavior,
//       ...(address && {
//         head_office: {
//           country: address.country,
//           line1: address.line1,
//           postal_code: address.postal_code,
//           state: address.state,
//           city: address.city,
//         },
//       }),
//     };

//     data = {
//       registrations,
//       settings,
//     };

//     res.status(200).send({ message: data });
//   };

//   try {
//     switch (user.key) {
//       case "admin":
//         await eventHandler();
//         break;

//       default:
//         break;
//     }
//   } catch (e) {
//     res.status(401).send({ error: e.message });
//   }
// });

router.get("/api/taxes", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin) => {
    const stripeTax = await StripeTax.findOne({ admin });

    let data;
    if (stripeTax) {
      const registrations = await stripe.tax.registrations.list({});
      const regParsed = registrations.data.map((reg) => {
        return {
          id: reg.id,
          country: reg.country,
          type: reg.country_options.us.type,
          state: reg.country_options.us.state,
        };
      });

      const settings = await stripe.tax.settings.retrieve();
      const address = settings.head_office.address;
      const settingsParsed = {
        status: settings.status,
        tax_behavior: settings.defaults.tax_behavior,
        head_office: {
          country: address.country,
          line1: address.line1,
          postal_code: address.postal_code,
          state: address.state,
          city: address.city,
        },
      };

      data = {
        registrations: regParsed,
        settings: settingsParsed,
      };
    }

    if (!stripeTax) {
      return res.send({ message: "No tax settings" });
    }

    res.status(200).send({ message: { taxSettings: data } });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler(user._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("tax", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        await eventHandler(user.admin);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    res.status(401).send({ error: e.message });
  }
});

router.get("/api/taxes/locations", auth, async (req, res) => {
  const user = req.user;

  try {
    switch (user.type) {
      case "admin": {
        const branches = await Branch.find({ admin: user._id }).select("name");
        res.status(200).send({ message: branches });
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("tax", user._id);

        if (!isPermitted) {
          return res.send({ error: "Invalid Operation" });
        }

        const branches = await Branch.find({ admin: user.admin }).select(
          "name"
        );
        res.status(200).send({ message: branches });
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
