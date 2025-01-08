const express = require("express");
const auth = require("../middleware/auth");
const CartItem = require("../models/cart-item");
const Product = require("../models/product");
const ShippingOption = require("../models/shipping-option");
const AllowedCountry = require("../models/allowed-country");
const Branch = require("../models/branch");
const Appointment = require("../models/booking");
const Coupon = require("../models/coupon");
const CustomerInfo = require("../models/customer-info");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/checkout/setup-intent", auth, async (req, res) => {
  const user = req.user;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: user.stripeCustomer,
      currency: "usd",
      mode: "setup",
      ui_mode: "embedded",
      return_url: `${process.env.FRONTEND_BASE_URL}/demo/barber/dashboard/appointments`,
      metadata: {
        data: JSON.stringify(req.body),
      },
    });

    res.send({ clientSecret: session.client_secret });
  } catch (e) {
    return res.status(400).send({ error: "Unable to fetch data" });
  }
});

router.post("/api/checkout/subscription", async (req, res) => {
  const price = req.body.price;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: req.body.email,
      line_items: [
        {
          price,
          quantity: 1,
        },
      ],
      ui_mode: "embedded",
      return_url: `${process.env.FRONTEND_BASE_URL}/register/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        ...req.body,
      },
    });

    const clientSecret = session.client_secret;

    res.status(201).send({ message: clientSecret });
  } catch (e) {
    return res.status(400).send({ error: "Unable to fetch data" });
  }
});

router.post("/api/tax/calculation/service", async (req, res) => {
  const { branchId, amount, stripeProductId, name } = req.body;

  try {
    const branch = await Branch.findOne({ _id: branchId }).select("address");
    const branchAdr = branch.address;
    const address = {
      line1: branchAdr.line1,
      city: branchAdr.city.cityName,
      state: branchAdr.state.stateCode,
      postal_code: branchAdr.postalCode,
      country: branchAdr.country.countryCode,
    };

    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      customer_details: {
        address,
        address_source: "shipping",
      },
      line_items: [
        {
          amount: Math.round(amount * 100),
          product: stripeProductId,
          reference: name,
        },
      ],
      expand: ["line_items"],
    });

    const data = calculation.line_items.data;

    res.send({ message: data });
  } catch (e) {
    return res.status(400).send({ error: "Unable to fetch data" });
  }
});

router.post("/api/checkout/appointment/payment", auth, async (req, res) => {
  const user = req.user;
  const { appointmentId, couponId } = req.body;

  try {
    const appointment = await Appointment.findOne({
      _id: appointmentId,
    }).select("price staff service");

    const price = appointment.price;

    let amount;

    if (couponId) {
      const coupon = await Coupon.findOne({ _id: couponId });
      const type = coupon.valueType;

      if (type === "percent") {
        const value = Number(
          ((coupon.value / 100) * price.serviceFee).toFixed(2)
        );

        const newServiceFee = price.serviceFee - value;

        const newTax = Number(
          ((price.taxRate / 100) * newServiceFee).toFixed(2)
        );

        amount = newServiceFee + newTax;
      } else {
        const value = coupon.value;

        const newServiceFee = price.serviceFee - value;
        const newTax = Number(
          ((price.taxRate / 100) * newServiceFee).toFixed(2)
        );

        amount = newServiceFee + newTax;
      }
    } else {
      amount = price.total;
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      customer: user.stripeCustomer,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        appointmentId,
        service: JSON.stringify(appointment.service),
        customer: user._id.toString(),
        staff: appointment.staff.toString(),
        type: "booking",
      },
      // payment_method: customerInfo.stripePaymentMethodId,
      // return_url: `${process.env.FRONTEND_BASE_URL}/demo/barber/dashboard/appointments`,
      // off_session: true,
      // confirm: true,
    });

    res.send({ clientSecret: paymentIntent.client_secret });
  } catch (e) {
    console.log(e.message);
    return res.status(400).send({ error: "Unable to fetch data" });
  }
});

router.post("/api/checkout/shop/payment", auth, async (req, res) => {
  const user = req.user;
  const { branch } = req.query;

  const shippingOptions = await ShippingOption.find({ branch }).select(
    "-admin -branch"
  );

  const allowedCountries = await AllowedCountry.find({ branch }).select(
    "country"
  );

  const allowed_countries = allowedCountries.map((ac) => ac.country.isoCode);

  const shipping_options = shippingOptions.map((so) => {
    return {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: {
          amount: Math.round(so.amount * 100),
          currency: "usd",
        },
        display_name: so.displayName,
        delivery_estimate: {
          minimum: {
            unit: so.unit,
            value: so.minEstimate,
          },
          maximum: {
            unit: so.unit,
            value: so.maxEstimate,
          },
        },
      },
    };
  });

  const cart = await CartItem.find({
    owner: user._id,
    status: "inCart",
    branch,
  }).populate({
    path: "product",
    select: "stripeData admin branch price",
  });

  const priceData = cart.map((cartItem) => {
    return {
      price: cartItem.product.stripeData.priceId,
      quantity: cartItem.quantity.value,
    };
  });

  const line_items = priceData;
  const customer = user.stripeCustomer;

  try {
    const session = await stripe.checkout.sessions.create({
      line_items,
      automatic_tax: {
        enabled: true,
      },
      customer,
      customer_update: {
        shipping: "auto",
      },
      shipping_options,
      shipping_address_collection: {
        allowed_countries,
      },
      allow_promotion_codes: true,
      mode: "payment",
      ui_mode: "embedded",
      return_url: `${process.env.FRONTEND_BASE_URL}/demo/barber/dashboard/orders`,
      metadata: {
        type: "shop",
        customer: JSON.stringify(user._id),
        branch: JSON.stringify(branch),
      },
    });

    res.send({ clientSecret: session.client_secret });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: "Unable to fetch data" });
  }
});

router.get("/api/checkout", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      req.query.session_id
    );
    const customer = await stripe.customers.retrieve(session.customer);

    res.send({
      message: {
        status: session.status,
        payment_status: session.payment_status,
        customer_email: customer.email,
      },
    });
  } catch (e) {
    return res
      .status(400)
      .send({ error: "Something went wrong. Please go back" });
  }
});

module.exports = router;
