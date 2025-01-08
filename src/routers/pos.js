const express = require("express");
const auth = require("../middleware/auth");
const Product = require("../models/product");
const User = require("../models/user");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const Sale = require("../models/sales");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.get("/api/pos/search", auth, async (req, res) => {
  const user = req.user;
  const { searchQuery } = req.query;

  const eventHandler = async (branch) => {
    const products = await Product.find({
      branch, // Limit to a specific branch
      $or: [
        { name: { $regex: searchQuery, $options: "i" } },
        { SKU: { $regex: searchQuery, $options: "i" } },
        { barcode: { $regex: searchQuery, $options: "i" } },
      ],
    });

    res.send({ message: products });
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
        const isPermitted = await checkPermission("pos", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.branch);
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

router.get("/api/pos/fetch/data", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const products = await Product.find({ admin, branch }).limit(6);
    const customers = await User.find({ admin, type: "customer" }).select(
      "fname lname email"
    );

    res.send({ message: { products, customers } });
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

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("pos", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
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

router.post("/api/calculate/tax/pos", auth, async (req, res) => {
  const user = req.user;
  const { cart } = req.body;

  const eventHandler = async (branchId) => {
    const branch = await Branch.findOne({ _id: branchId }).select("address");
    const branchAdr = branch.address;
    const address = {
      line1: branchAdr.line1,
      city: branchAdr.city.cityName,
      state: branchAdr.state.stateCode,
      postal_code: branchAdr.postalCode,
      country: branchAdr.country.countryCode,
    };

    const line_items = cart.map((cartItem) => {
      return {
        amount: Math.round(cartItem.amount * 100),
        product: cartItem.stripeProductId,
        reference: cartItem.name,
        quantity: cartItem.quantity,
      };
    });

    const calculation = await stripe.tax.calculations.create({
      currency: "usd",
      customer_details: {
        address,
        address_source: "shipping",
      },
      line_items,
      expand: ["line_items"],
    });

    const lineItemData = calculation.line_items.data.map((item) => {
      return {
        amount: item.amount,
        amount_tax: item.amount_tax,
        quantity: item.quantity,
      };
    });

    res.send({ message: lineItemData });
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
        const isPermitted = await checkPermission("pos", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

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

router.post("/api/pos/sale", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const sale = new Sale({
      branch,
      admin,
      ...req.body,
    });

    await sale.save();

    const bulkProductUpdates = [];
    const products = req.body.products;

    products.forEach((product) => {
      const size = product?.size;

      if (size) {
        bulkProductUpdates.push({
          updateOne: {
            filter: {
              _id: product.product,
              "sizeBasedQuantity.details.sizeType": size,
            },
            update: {
              $inc: {
                "sizeBasedQuantity.details.$.quantity": -product.quantity,
              },
            },
          },
        });
      } else {
        bulkProductUpdates.push({
          updateOne: {
            filter: { _id: product.product },
            update: { $inc: { quantity: -product.quantity } },
          },
        });
      }
    });

    Product.bulkWrite(bulkProductUpdates);
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

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("pos", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.send({ message: "Sales Uploaded" });
  } catch (e) {
    console.log(e);
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/pos/sale", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (branch) => {
    const sales = await Sale.find({ branch })
      .populate({
        path: "customer",
        select: "fname lname email", // Select specific fields from the customer
      })
      .populate({
        path: "products.product",
        select: "name", // Select specific fields from the product
      })
      .exec();

    res.send({ message: sales });
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
        const isPermitted = await checkPermission("pos", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.branch);
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
