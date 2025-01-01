const express = require("express");
const auth = require("../middleware/auth");
const CartItem = require("../models/cart-item");
const Coupon = require("../models/coupon");
const { DateTime } = require("luxon");
const Branch = require("../models/branch");
const Product = require("../models/product");
const router = new express.Router();

router.get("/api/fetch/customer/coupons", async (req, res) => {
  const { branch } = req.query;

  try {
    const branchObj = await Branch.findById(branch).select("timeZone");
    const timeZone = branchObj.timeZone;
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    const validCoupons = await Coupon.find({
      expiresAt: { $gt: currentDate },
      branch: branchObj._id,
    })
      .sort({ expiresAt: 1 })
      .populate("addedProducts", "_id")
      .populate("promotionCodes", "code")
      .select("valueType value addedProducts promotionCodes");

    res.send({ message: validCoupons });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.post("/api/confirm-stock-qty/cartItems", async (req, res) => {
  const { product, size, newQty } = req.body;

  try {
    const query = { _id: product };

    // Add `size` to query if provided
    if (size) {
      query["sizeBasedQuantity.details.sizeType"] = size;
    }

    // Execute the query
    const productData = await Product.findOne(query).select(
      "sizeBasedQuantity quantity"
    );

    if (!productData) {
      return res
        .status(404)
        .send({ error: "Product has been removed from store." });
    }

    // Check if size-based quantity is enabled
    if (productData.sizeBasedQuantity.enabled) {
      if (!size) {
        return res
          .status(400)
          .send({ error: "Size is required for this product." });
      }

      const sizeDetails = productData.sizeBasedQuantity.details.find(
        (detail) => detail.sizeType === size
      );

      if (!sizeDetails) {
        return res.status(404).send({
          error: `Size '${size}' has been removed for this product.`,
        });
      }

      // Compare newQty with the size-based quantity
      if (newQty > sizeDetails.quantity) {
        return res.status(400).send({
          error: `Requested quantity exceeds available stock. Only ${sizeDetails.quantity} items are available for size '${size}'.`,
        });
      }
    } else {
      // Compare newQty with the product quantity
      if (newQty > productData.quantity) {
        return res.status(400).send({
          error: `Requested quantity exceeds available stock. Only ${productData.quantity} items are available.`,
        });
      }
    }

    // If all checks pass
    return res.status(200).send({ message: "Stock is sufficient." });
  } catch (e) {
    res.status(500).send({ error: "Internal server error" });
  }
});

router.post("/api/confirm-stock/checkout/cartItems", async (req, res) => {
  const cartItems = req.body;

  try {
    if (!Array.isArray(cartItems) || cartItems.length === 0) {
      return res.status(400).send({ error: "Invalid or empty cart items." });
    }

    const insufficientStockItems = [];

    for (const item of cartItems) {
      const { product, quantity, size } = item;

      if (!product || !quantity || quantity <= 0) {
        return res
          .status(400)
          .send({ error: "Product ID and valid quantity are required." });
      }

      // Construct query
      const query = { _id: product };
      if (size) {
        query["sizeBasedQuantity.details.sizeType"] = size;
      }

      // Fetch product
      const productData = await Product.findOne(query).select(
        "name sizeBasedQuantity quantity"
      );

      if (!productData) {
        return res
          .status(404)
          .send({ error: `${product.name} has been removed from store.` });
      }

      if (productData.sizeBasedQuantity.enabled) {
        // Validate size and check stock
        if (!size) {
          return res.status(400).send({
            error: `Size is required for product '${productData.name}'.`,
          });
        }

        const sizeDetails = productData.sizeBasedQuantity.details.find(
          (detail) => detail.sizeType === size
        );

        if (!sizeDetails) {
          return res.status(404).send({
            error: `Size '${size}' has been removed for '${productData.name}'.`,
          });
        }

        if (quantity > sizeDetails.quantity) {
          insufficientStockItems.push({
            productName: productData.name,
            available: sizeDetails.quantity,
          });
        }
      } else {
        // Validate stock for non-size-based product
        if (quantity > productData.quantity) {
          insufficientStockItems.push({
            productName: productData.name,
            available: productData.quantity,
          });
        }
      }
    }

    // If any insufficient stock items found, return them
    if (insufficientStockItems.length > 0) {
      return res.status(400).send({
        error: "Some items exceed available stock.",
        insufficientStockItems,
      });
    }

    // All items have sufficient stock
    return res
      .status(200)
      .send({ message: "All items have sufficient stock." });
  } catch (e) {
    console.log(e)
    res.status(500).send({ error: "Internal server error" });
  }
});

router.post("/api/merge/cartItems", auth, async (req, res) => {
  const user = req.user;
  const { product, quantity, branch } = req.body;
  const sizeBased = quantity.sizeBasedQuantity.enabled;
  const size = quantity.sizeBasedQuantity?.size;

  if (sizeBased && !size) {
    return res.send({ error: "Invalid Operation" });
  }

  try {
    const existingCartItem = await CartItem.findOne({
      owner: user._id,
      product,
      ...(sizeBased && { "quantity.sizeBasedQuantity.size": size }),
      status: "inCart",
    });

    if (existingCartItem) {
      existingCartItem.quantity.value += quantity.value;
      await existingCartItem.save();

      return res.status(200).send({ message: "success" });
    } else {
      const newCartItem = new CartItem({
        owner: user._id,
        product,
        branch,
        quantity: {
          sizeBasedQuantity: {
            enabled: sizeBased,
            ...(sizeBased && { size }),
          },
          value: quantity.value,
        },
      });

      await newCartItem.save();

      return res.status(201).send({ message: "success" });
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.post("/api/cart-items", auth, async (req, res) => {
  try {
    const { _id: userId } = req.user;
    const { productId, sizeBased, selectedSize, branch, inStock, quantity } =
      req.body;

    // Validation
    if (sizeBased && !selectedSize) {
      return res.status(400).send({ error: "Please select a size." });
    }

    if (!inStock || inStock === 0) {
      return res.status(400).send({ error: "Product is out of stock." });
    }

    // Define the query for finding an existing cart item
    const query = {
      owner: userId,
      product: productId,
      status: "inCart",
      ...(sizeBased && { "quantity.sizeBasedQuantity.size": selectedSize }),
    };

    // Check for existing cart item
    const existingCartItem = await CartItem.findOne(query);

    if (existingCartItem) {
      // Calculate new quantity and validate stock
      const newQuantity = existingCartItem.quantity.value + quantity;
      if (newQuantity > inStock) {
        return res.status(400).send({
          error: `Cannot add more. Only ${inStock} items in stock.`,
        });
      }

      // Update the cart item quantity
      await CartItem.updateOne(query, {
        $set: { "quantity.value": newQuantity },
      });

      return res.status(200).send({ message: "Cart updated successfully." });
    }

    // Validate stock for new cart items
    if (quantity > inStock) {
      return res.status(400).send({
        error: `Cannot add more. Only ${inStock} items in stock.`,
      });
    }

    // Create a new cart item
    const newCartItem = new CartItem({
      owner: userId,
      product: productId,
      branch,
      quantity: {
        sizeBasedQuantity: {
          enabled: sizeBased,
          ...(sizeBased && { size: selectedSize }),
        },
        value: quantity,
      },
    });

    await newCartItem.save();

    return res
      .status(201)
      .send({ message: "Product added to cart successfully." });
  } catch (error) {
    return res.status(500).send({ error: "Internal server error." });
  }
});

router.get("/api/cart-item", auth, async (req, res) => {
  const user = req.user;
  const { branch } = req.query;

  try {
    const branchObj = await Branch.findById(branch).select("timeZone");
    const timeZone = branchObj.timeZone;
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    const cartItems = await CartItem.find({
      owner: user._id,
      status: "inCart",
      branch,
    }).populate("product");

    const validCoupons = await Coupon.find({
      expiresAt: { $gt: currentDate },
      branch,
    })
      .sort({ expiresAt: 1 })
      .populate("addedProducts", "_id")
      .populate("promotionCodes", "code")
      .select("valueType value addedProducts promotionCodes");

    res.send({ messaage: { cartItems, validCoupons } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/count/cart-item", auth, async (req, res) => {
  const user = req.user;
  const { branch } = req.query;

  if (user.type !== "customer") {
    return res.send({ error: "Please authenticate." });
  }

  try {
    const cartItemsCount = await CartItem.countDocuments({
      owner: user._id,
      status: "inCart",
      branch,
    });

    res.send({ message: cartItemsCount });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.patch("/api/cart-items/:id", auth, async (req, res) => {
  const user = req.user;
  const { newQty } = req.body;

  try {
    await CartItem.findOneAndUpdate(
      { _id: req.params.id, owner: user._id },
      { "quantity.value": newQty }
    );

    res.send({ message: "success" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.delete("/api/cart-items/:id", auth, async (req, res) => {
  const user = req.user;

  try {
    await CartItem.findOneAndDelete({ owner: user._id, _id: req.params.id });
    res.send({ message: "Cart Item Deleted" });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
