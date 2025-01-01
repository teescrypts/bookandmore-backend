const express = require("express");
const Product = require("../models/product");
const Coupon = require("../models/coupon");
const { DateTime } = require("luxon");
const Branch = require("../models/branch");
const getAdminId = require("../utils/get-admin-id");
const CartItem = require("../models/cart-item");
const Blog = require("../models/blog");
const router = new express.Router();

router.get("/api/shop/home-page/products/blogs/tests", async (req, res) => {
  try {
    // Assume getAdminId retrieves the current admin's ID
    const admin = await getAdminId();

    // Fetch the latest three products associated with the admin
    const products = await Product.find({ admin })
      .sort({ createdAt: -1 }) // Sort by creation date, latest first
      .limit(3); // Limit to 3 results

    const blogs = await Blog.find({ admin })
      .sort({ createdAt: -1 }) // Sort by creation date, latest first
      .limit(3); // Limit to 3 results

    res.status(200).send({ message: { products, blogs } });
  } catch (e) {
    console.log(e);
    res.status(500).send({ error: e.message });
  }
});

router.get("/api/shop/fetch/branches", async (req, res) => {
  try {
    const admin = await getAdminId();
    const branches = await Branch.aggregate([
      {
        $match: {
          admin,
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "branch",
          as: "products",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          productCount: { $size: "$products" },
        },
      },
    ]);

    const formattedBranches = branches.map((branch) => ({
      id: branch._id,
      name: branch.name,
      productCount: branch.productCount,
    }));

    res.status(200).send({ message: formattedBranches });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
});

router.get("/api/shop/fetch/shop-data", async (req, res) => {
  try {
    const { branch } = req.query;
    const branchObj = await Branch.findById(branch).select("timeZone");
    const timeZone = branchObj.timeZone;
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    const name = req.query.name || "";
    const category = req.query.category || "";
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 9;

    const categories = await Product.distinct("category.name", { branch });

    const products = await Product.find({
      ...(name && { name: { $regex: name, $options: "i" } }),
      ...(category && { "category.name": category }),
      branch,
    })
      .skip(skip)
      .limit(limit)
      .select("-admin -branch -SKU -barcode");

    const total = await Product.countDocuments({
      ...(name && { name: { $regex: name, $options: "i" } }),
      ...(category && { "category.name": category }),
      branch,
    });

    const validCoupons = await Coupon.find({
      expiresAt: { $gt: currentDate },
      branch,
    })
      .sort({ expiresAt: 1 })
      .populate("addedProducts", "_id")
      .populate("promotionCodes", "code")
      .select("valueType value addedProducts promotionCodes");

    res
      .status(200)
      .send({ message: { products, total, validCoupons, categories } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

router.get("/api/shop/:id", async (req, res) => {
  const _id = req.params.id;

  try {
    const product = await Product.findById(_id).select(
      "-admin -SKU -barcode -createdAt -updatedAt"
    );

    const branchObj = await Branch.findById(product.branch).select("timeZone");
    const timeZone = branchObj.timeZone;
    const currentDate = DateTime.now().setZone(timeZone).toJSDate();

    if (!product) return res.send({ error: "Invalid Operation" });

    const validCoupons = await Coupon.find({
      expiresAt: { $gt: currentDate },
      branch: branchObj._id,
    })
      .sort({ expiresAt: 1 })
      .populate("addedProducts", "_id")
      .populate("promotionCodes", "code")
      .select("valueType value addedProducts promotionCodes");

    res.send({ message: { product, validCoupons } });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});

module.exports = router;
