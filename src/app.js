const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
require("./db/mongoose");

const userRouter = require("./routers/user");
const branchRouter = require("./routers/branch");
const stripeTaxRouter = require("./routers/stripe-tax");
const subscriptionRouter = require("./routers/subscription");
const rentFormRouter = require("./routers/rent-form");
const checkoutRouter = require("./routers/checkout");
const webhookRouter = require("./routers/webhook");
const billingRouter = require("./routers/billing");
const rentRouter = require("./routers/rent");
const staffFormRouter = require("./routers/staff-form");
const staffOnboardingRouter = require("./routers/staff-onboarding");
const openingHoursRouter = require("./routers/opening-hour");
const serviceRouter = require("./routers/service");
const bookingSettingsRouter = require("./routers/booking-settings");
const productRouter = require("./routers/product");
const shippingOptionRouter = require("./routers/shipping-option");
const allowedCountryRouter = require("./routers/allowed-country");
const blogRouter = require("./routers/blog");
const couponRouter = require("./routers/coupon");
const promotionCodeRouter = require("./routers/promotion-code");
const loyaltyPointSettingsRouter = require("./routers/loyalty-point-settings");
const staffInfoRouter = require("./routers/staff-info");
const bookingRouter = require("./routers/booking");
const shopRouter = require("./routers/shop");
const cartItemRouter = require("./routers/cart-item");
const customerBlogRouter = require("./routers/customer-blog");
const customerOrderRouter = require("./routers/customer-order");
const customerInfoRouter = require("./routers/customer-info");
const orderRouter = require("./routers/order");
const posRouter = require("./routers/pos");
const calendarRouter = require("./routers/calendar");

const app = express();

const allowedOrigins = [
  process.env.API_BASE_URL,
  "https://stripe.com",
  "https://*.stripe.com",
];

app.use(cookieParser());
app.use(
  cors({
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204,
  })
);
app.use(webhookRouter);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(userRouter);
app.use(branchRouter);
app.use(stripeTaxRouter);
app.use(subscriptionRouter);
app.use(rentFormRouter);
app.use(checkoutRouter);
app.use(billingRouter);
app.use(rentRouter);
app.use(staffFormRouter);
app.use(staffOnboardingRouter);
app.use(openingHoursRouter);
app.use(serviceRouter);
app.use(bookingSettingsRouter);
app.use(productRouter);
app.use(shippingOptionRouter);
app.use(allowedCountryRouter);
app.use(blogRouter);
app.use(couponRouter);
app.use(promotionCodeRouter);
app.use(loyaltyPointSettingsRouter);
app.use(staffInfoRouter);
app.use(bookingRouter);
app.use(shopRouter);
app.use(cartItemRouter);
app.use(customerBlogRouter);
app.use(customerOrderRouter);
app.use(customerInfoRouter);
app.use(orderRouter);
app.use(posRouter);
app.use(calendarRouter);

module.exports = app;
