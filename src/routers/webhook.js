const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const endpointSecret = process.env.STRIPE_ENDPOINT_SECRET_KEY;
const express = require("express");
const Rent = require("../models/rent");
const User = require("../models/user");
const RentForm = require("../models/rent-form");
const Appointment = require("../models/booking");
const Order = require("../models/order");
const CartItem = require("../models/cart-item");
const Product = require("../models/product");
const CustomerInfo = require("../models/customer-info");
const LoyaltyPointsSettings = require("../models/loyalty-point-settings");
const getAdminId = require("../utils/get-admin-id");
const Branch = require("../models/branch");
const Service = require("../models/service");
const BookingSettings = require("../models/booking-settings");
const router = new express.Router();

const processEvent = async (event, req) => {
  switch (event.type) {
    case "customer.subscription.created":
      const subscriptionCreated = event.data.object;

      const paidOn = subscriptionCreated.current_period_start;
      const dueOn = subscriptionCreated.current_period_end;
      const status = subscriptionCreated.status;
      const stripePrice = subscriptionCreated.plan.id;
      const stripeProduct = subscriptionCreated.plan.product;
      const stripeCustomer = subscriptionCreated.customer;
      const stripeSubscription = subscriptionCreated.id;

      const rent = new Rent({
        type: "subscription",
        paidOn,
        dueOn,
        status,
        stripePrice,
        stripeProduct,
        stripeCustomer,
        stripeSubscription,
      });

      try {
        await rent.save();

        await stripe.billingPortal.configurations.create({
          business_profile: {
            headline:
              "Welcome to BookAndMore stripe hosted billing management page",
          },
          features: {
            invoice_history: {
              enabled: true,
            },
            payment_method_update: {
              enabled: true,
            },
            subscription_cancel: {
              enabled: true,
              mode: "at_period_end",
            },
          },
        });
      } catch (e) {
        console.log(e.message);
      }

      break;

    case "checkout.session.completed":
      const session = event.data.object;

      const metadata = session.metadata;

      try {
        if (session.mode === "subscription") {
          const user = new User({
            fname: metadata.fname,
            lname: metadata.lname,
            email: metadata.email,
            password: metadata.password,
            type: "tenant",
            admin: metadata.admin,
            branch: metadata.branch,
          });

          const tenant = await user.save();

          await Rent.findOneAndUpdate(
            { stripeCustomer: session.customer },
            {
              admin: metadata.admin,
              branch: metadata.branch,
              tenant: tenant._id,
            }
          );

          await RentForm.findOneAndDelete({ _id: metadata.formId });
        }

        if (session.mode === "setup") {
          const setupIntentId = session.setup_intent;
          const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

          await stripe.paymentMethods.attach(setupIntent.payment_method, {
            customer: session.customer,
          });

          const user = await User.findOne({
            stripeCustomer: session.customer,
          }).select("_id");

          const data = JSON.parse(metadata.data);

          await CustomerInfo.findOneAndUpdate(
            { customer: user._id },
            { stripePaymentMethodId: setupIntent.payment_method }
          );

          const branch = await Branch.findById(data.branch).select("address");
          if (!branch) {
            return;
          }

          // Validate booking settings
          const settings = await BookingSettings.findOne({
            branch: branch._id,
          });

          if (!settings) {
            return;
          }

          const service = await Service.findById(data.service);
          if (!service) {
            return;
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

          const lineItemdata = calculation.line_items.data[0];
          const taxRate = Number(
            ((lineItemdata.amount_tax / service.priceAmount) * 100).toFixed(2)
          );
          const price = {
            serviceFee: service.priceAmount,
            tax: lineItemdata.amount_tax / 100,
            taxRate,
            total: service.priceAmount + lineItemdata.amount_tax / 100,
          };

          // Check slot availability
          const existingAppointmentCount = await Appointment.countDocuments({
            date: data.date,
            bookedTime: data.bookedTime,
            staff: data.staff,
          });

          if (existingAppointmentCount > 0) {
            return;
          }

          const appointment = new Appointment({
            owner: user._id,
            price,
            policy,
            ...data,
          });

          const newApt = await appointment.save();

          if (newApt) {
            await CustomerInfo.findOneAndUpdate(
              { customer: user._id },
              {
                $inc: { totalAppointments: 1 },
              }
            );
          }
        }

        if (session.mode === "payment") {
          const { type } = metadata;

          if (type === "shop") {
            const customer = JSON.parse(metadata.customer);
            const branch = JSON.parse(metadata.branch);

            // Fetch cart items with related product data
            const cartItems = await CartItem.find({
              owner: customer,
              status: "inCart",
              branch: branch,
            }).populate({
              path: "product",
              select: "price sizeBasedQuantity",
            });

            // Prepare products for the order
            const products = cartItems.map((item) => {
              const { quantity } = item;
              return {
                product: item.product._id,
                quantity: quantity.value,
                ...(quantity.sizeBasedQuantity.enabled && {
                  size: quantity.sizeBasedQuantity.size,
                }),
                price: item.product.price,
              };
            });

            // Create and save the order
            const order = new Order({
              customer,
              branch,
              products,
              totalAmount: session.amount_total / 100,
              totalDiscount: session.total_details.amount_discount / 100,
              totalShipping: session.total_details.amount_shipping / 100,
              totalTax: session.total_details.amount_tax / 100,
              shippingAddress: session.shipping_details.address,
            });

            await order.save();

            // Process inventory updates and cart status
            const bulkProductUpdates = [];
            const bulkCartUpdates = cartItems.map((item) => ({
              updateOne: {
                filter: { _id: item._id },
                update: { status: "purchased" },
              },
            }));

            cartItems.forEach((item) => {
              const { sizeBasedQuantity } = item.quantity;

              if (sizeBasedQuantity.enabled) {
                bulkProductUpdates.push({
                  updateOne: {
                    filter: {
                      _id: item.product._id,
                      "sizeBasedQuantity.details.sizeType":
                        sizeBasedQuantity.size,
                    },
                    update: {
                      $inc: {
                        "sizeBasedQuantity.details.$.quantity":
                          -item.quantity.value,
                      },
                    },
                  },
                });
              } else {
                bulkProductUpdates.push({
                  updateOne: {
                    filter: { _id: item.product._id },
                    update: { $inc: { quantity: -item.quantity.value } },
                  },
                });
              }
            });

            // Execute bulk updates
            await Promise.all([
              Product.bulkWrite(bulkProductUpdates),
              CartItem.bulkWrite(bulkCartUpdates),
            ]);

            // ---------------------- Loyalty Point Management ----------------------  //

            const admin = await getAdminId();

            // Fetch loyalty point settings for the admin
            const loyaltyPointSettings = await LoyaltyPointsSettings.findOne({
              admin,
              active: true,
            });

            if (!loyaltyPointSettings) return;

            // Extract settings
            const {
              enableReferral,
              enableProduct,
              minimumAmountEnabledProd,
              appliesToProd,
              prodServiceIds,
              minimumAmountProd,
              minimumReferral,
            } = loyaltyPointSettings;

            // Handle product sale loyalty points
            if (enableProduct) {
              const totalAmount = session.amount_total / 100;
              const isAboveMinAmount =
                !minimumAmountEnabledProd || totalAmount > minimumAmountProd;

              if (appliesToProd) {
                // Filter purchased products to match settings
                const purchasedProductIds = products.map(
                  (item) => item.product
                );
                const matchingProducts = purchasedProductIds.filter(
                  (productId) => prodServiceIds.includes(productId)
                );

                if (matchingProducts.length > 0 && isAboveMinAmount) {
                  await CustomerInfo.findOneAndUpdate(
                    { customer },
                    { $inc: { "loyaltyPoint.total": 1 } }
                  );
                }
              } else if (isAboveMinAmount) {
                await CustomerInfo.findOneAndUpdate(
                  { customer },
                  { $inc: { "loyaltyPoint.total": 1 } }
                );
              }
            }

            // Handle referral loyalty points
            if (enableReferral) {
              const customerInfo = await CustomerInfo.findOne({ customer });
              const { referred } = customerInfo || {};

              if (referred?.code && !referred.used) {
                const referredBy = await CustomerInfo.findOne({
                  "referralCode.value": referred.code,
                });

                if (referredBy) {
                  referredBy.referralCode.count += 1;
                  await referredBy.save();

                  if (referredBy.referralCode.count >= minimumReferral) {
                    referredBy.loyaltyPoint.total += 1;
                    referredBy.referralCode.count = 0;
                    await referredBy.save();
                  }

                  referred.used = true;
                  await customerInfo.save();
                }
              }
            }

            // ---------------------- Loyalty Point Management ----------------------  //

            await CustomerInfo.findOneAndUpdate(
              { customer },
              { firstTransaction: false }
            );
          }
        }
      } catch (e) {
        console.log(e);
      }

      break;

    case "customer.subscription.updated":
      const subscriptionUpdated = event.data.object;

      try {
        await Rent.findOneAndUpdate(
          { stripeSubscription: subscriptionUpdated.id },
          {
            status: subscriptionUpdated.status,
            paidOn: subscriptionUpdated.current_period_start,
            dueOn: subscriptionUpdated.current_period_end,
          }
        );
      } catch (e) {
        console.log(e.message);
      }
      break;

    case "invoice.payment_succeeded":
      const paymentSucceeded = event.data.object;

      try {
        await Rent.findOneAndUpdate(
          { stripeCustomer: paymentSucceeded.customer },
          {
            paymentStatus: paymentSucceeded.status,
            paidOn: paymentSucceeded.current_period_start,
            dueOn: paymentSucceeded.current_period_end,
          }
        );
      } catch (e) {
        console.log(e.message);
      }

      break;

    case "invoice.payment_failed":
      const paymentFailed = event.data.object;

      try {
        await Rent.findOneAndUpdate(
          { stripeCustomer: paymentFailed.customer },
          {
            paymentStatus: paymentFailed.status,
            paidOn: paymentFailed.current_period_start,
            dueOn: paymentFailed.current_period_end,
          }
        );
      } catch (e) {
        console.log(e.message);
      }

      break;

    case "customer.subscription.deleted":
      const subscriptionDeleted = event.data.object;

      try {
        await Rent.findOneAndUpdate(
          { stripeSubscription: subscriptionDeleted.id },
          {
            status: subscriptionDeleted.status,
            paidOn: paymentFailed.current_period_start,
            dueOn: paymentFailed.current_period_end,
          }
        );
      } catch (e) {
        console.log(e.message);
      }
      break;

    case "payment_intent.succeeded":
      const paymentIntentObject = event.data.object;
      const { appointmentId, customer, staff, type, service } =
        paymentIntentObject.metadata;

      if (type === "booking") {
        const bookedApt = await Appointment.findByIdAndUpdate(appointmentId, {
          status: "completed",
        });

        await CustomerInfo.findOneAndUpdate(
          { customer },
          {
            $inc: { completedAppointments: 1 },
          },
          { $set: { firstTransaction: false } }
        );

        // ---------------------- Loyalty Point Management ----------------------  //

        const admin = await getAdminId();

        // Fetch loyalty point settings for the admin
        const loyaltyPointSettings = await LoyaltyPointsSettings.findOne({
          admin,
          active: true,
        });

        if (!loyaltyPointSettings) return;

        // Extract settings
        const {
          enableReferral,
          enableAppointment,
          minimumAmountEnabledApt,
          appliesToApt,
          aptServiceIds,
          minimumAmountApt,
          minimumReferral,
        } = loyaltyPointSettings;

        // Handle product sale loyalty points
        if (enableAppointment) {
          const totalAmount = bookedApt.price.total;
          const isAboveMinAmount =
            !minimumAmountEnabledApt || totalAmount > minimumAmountApt;

          if (appliesToApt) {
            const isPresent = aptServiceIds.includes(JSON.parse(service));

            if (isPresent && isAboveMinAmount) {
              await CustomerInfo.findOneAndUpdate(
                { customer },
                { $inc: { "loyaltyPoint.total": 1 } }
              );
            }
          } else if (isAboveMinAmount) {
            await CustomerInfo.findOneAndUpdate(
              { customer },
              { $inc: { "loyaltyPoint.total": 1 } }
            );
          }
        }

        // Handle referral loyalty points
        if (enableReferral) {
          const customerInfo = await CustomerInfo.findOne({ customer });
          const { referred } = customerInfo || {};

          if (referred?.code && !referred.used) {
            const referredBy = await CustomerInfo.findOne({
              "referralCode.value": referred.code,
            });

            if (referredBy) {
              referredBy.referralCode.count += 1;
              await referredBy.save();

              if (referredBy.referralCode.count >= minimumReferral) {
                referredBy.loyaltyPoint.total += 1;
                referredBy.referralCode.count = 0;
                await referredBy.save();
              }

              referred.used = true;
              await customerInfo.save();
            }
          }
        }

        // ---------------------- Loyalty Point Management ----------------------  //
      }

      break;

    default:
    //   console.log(`Unhandled event type ${event.type}`);
  }
};

router.post(
  "/api/webhooks",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let event = req.body;

    if (endpointSecret) {
      const signature = req.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          signature,
          endpointSecret
        );
      } catch (err) {
        console.log(`⚠️  Webhook signature verification failed.`, err.message);
        return res.sendStatus(400);
      }
    }

    res.status(200).json({ received: true });

    processEvent(event, req).catch((err) => {
      console.error("Failed to process event:", err);
    });
  }
);

module.exports = router;
