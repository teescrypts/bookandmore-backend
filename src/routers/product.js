const express = require("express");
const Product = require("../models/product");
const sharp = require("sharp");
const multer = require("multer");
const ProductImage = require("../models/product-image");
const auth = require("../middleware/auth");
const Branch = require("../models/branch");
const areArraysEqual = require("../utils/compare-array");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

router.post("/api/products", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const images = req.body.images.map(
      (image) => `${process.env.API_BASE_URL}/${image.url}`
    );

    const stripeProduct = await stripe.products.create({
      name: req.body.name,
      ...(req.body.description && { description: req.body.description }),
      tax_code: req.body.category.taxCode,
      images,
      default_price_data: {
        currency: "USD",
        unit_amount: Math.round(req.body.price * 100),
      },
    });

    const product = new Product({
      admin,
      branch,
      stripeData: {
        priceId: stripeProduct.default_price,
        productId: stripeProduct.id,
      },
      ...req.body,
    });

    await product.save();
    await ProductImage.updateMany(
      { owner: user._id, status: "draft" },
      { status: "upload" }
    );
  };

  try {
    switch (user.type) {
      case "admin": {
        const activeBranch = await Branch.findOne({
          active: true,
          admin: user._id,
        }).select("_id");

        if (!activeBranch) {
          throw new Error("No active branch found");
        }

        await eventHandler(user._id, activeBranch._id);
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Product Uploaded successfully" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/products", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const products = await Product.find({ admin, branch });
    res.status(201).send({ message: products });
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
        const isPermitted = await checkPermission("products", user._id);

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

router.get("/api/products/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const product = await Product.findOne({ _id: req.params.id });
    if (!product) {
      return res.status(400).send({ error: "Invalid Operation" });
    }

    const draftImagesRaw = await ProductImage.find({
      owner: user._id,
      status: "draft",
      product: product._id,
    });

    let draftImages = [];

    if (draftImagesRaw.length > 0) {
      draftImages = draftImagesRaw.map((draftImage) => ({
        url: `products/${draftImage._id}/image`,
        imageId: draftImage._id,
        fileName: draftImage.fileName,
      }));
    }

    const updatedImages = [...product.images, ...draftImages];

    res
      .status(200)
      .send({ message: { ...product.toObject(), images: updatedImages } });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
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

router.patch("/api/products/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "name",
      "category",
      "description",
      "price",
      "expiryDate",
      "SKU",
      "barcode",
      "sizeBasedQuantity",
      "quantity",
      "images",
      "sellOnlyWithAppointment",
      "discount",
      "inStock",
    ];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const product = await Product.findOne({
      _id: req.params.id,
    });

    if (!product) {
      return res.status(404).send({ error: "Invalid Operation" });
    }

    if (req.body.price !== product.price) {
      await stripe.prices.update(product.stripeData.priceId, {
        active: false,
      });

      const price = await stripe.prices.create({
        currency: "usd",
        unit_amount: Math.round(req.body.price * 100),
        product: product.stripeData.productId,
      });

      await stripe.products.update(product.stripeData.productId, {
        default_price: price.id,
      });

      product.stripeData.priceId = price.id;
    }

    if (req.body.name !== product.name) {
      await stripe.products.update(product.stripeData.productId, {
        name: req.body.name,
      });
    }

    if (req.body.description !== product.description) {
      await stripe.products.update(product.stripeData.productId, {
        description: req.body.description,
      });
    }

    if (req.body.category.taxCode !== product.category.taxCode) {
      await stripe.products.update(product.stripeData.productId, {
        tax_code: req.body.category.taxCode,
      });
    }

    if (!areArraysEqual(req.body.images, product.images)) {
      const images = req.body.images.map(
        (image) => `${process.env.API_BASE_URL}/${image.url}`
      );
      await stripe.products.update(product.stripeData.productId, {
        images,
      });
    }

    updates.forEach((update) => (product[update] = req.body[update]));
    await product.save();
    await ProductImage.updateMany(
      { owner: user._id, status: "draft", product: req.params.id },
      { status: "upload" }
    );
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Product updated" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.delete("/api/products/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.send({ error: "Something went wrong. Please try again" });
    }

    await stripe.products.update(deletedProduct.stripeData.productId, {
      active: false,
    });

    await stripe.prices.update(deletedProduct.stripeData.priceId, {
      active: false,
    });

    const images = deletedProduct.images;
    for (let i = 0; i < images.length; i++) {
      await ProductImage.findByIdAndDelete(images[i].imageId);
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(200).send({ message: "Product deleted" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

// ----------------------------- Handling Product Image ----------------------------- //

const upload = multer({
  fileFilter(req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return cb(new Error("Please upload an image"));
    }

    cb(undefined, true);
  },
});

router.post(
  "/api/products/single/image",
  auth,
  upload.single("image"),
  async (req, res) => {
    const user = req.user;
    const body = req.body;

    const eventHandler = async () => {
      const buffer = await sharp(req.file.buffer)
        .webp({ quality: 35 })
        .toBuffer();

      const productImage = new ProductImage({
        image: buffer,
        owner: user._id,
        fileName: body.fileName,
        ...(req.query.product && { product: req.query.product }),
      });

      const draftImage = await productImage.save();
      res.send({
        message: { imageId: draftImage._id, fileName: draftImage.fileName },
      });
    };

    try {
      switch (user.type) {
        case "admin":
          await eventHandler();
          break;

        case "staff": {
          const isPermitted = await checkPermission("products", user._id);

          if (!isPermitted) return res.send({ error: "Invalid Operation" });

          await eventHandler();
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
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

router.delete("/api/products/image", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    await ProductImage.deleteMany({ owner: user._id });
  };

  try {
    switch (user.type) {
      case "admin":
        await eventHandler();
        break;

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "All Images deleted" });
  } catch (e) {
    res.status(400).send({ error: error.message });
  }
});

router.delete("/api/products/:id/image", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    await ProductImage.findByIdAndDelete({
      _id: req.params.id,
    });

    if (req.query?.product) {
      const product = await Product.findOne({ _id: req.query.product });
      const productImages = product.images;
      const newImages = productImages.filter(
        (img) => img.imageId !== req.params.id
      );

      product.images = newImages;
      await product.save();
    }
  };

  try {
    switch (user.type) {
      case "admin":
        await eventHandler();
        break;

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Image deleted" });
  } catch (e) {
    res.status(400).send({ error: error.message });
  }
});

router.get("/api/products/:id/image", async (req, res) => {
  try {
    const productImage = await ProductImage.findById(req.params.id);

    if (!productImage) {
      throw new Error();
    }

    res.set("Content-Type", "image/webp");
    res.send(productImage.image);
  } catch (e) {
    res.status(404).send();
  }
});

router.get("/api/products/image", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const draftImages = await ProductImage.find({
      owner: user._id,
      status: "draft",
    }).select("fileName");

    const data = draftImages.map((img) => {
      return {
        url: `products/${img._id}/image`,
        fileName: img.fileName,
        imageId: img._id,
      };
    });

    res.send({ message: data });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("products", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        break;
    }
  } catch (e) {
    res.status(400).send({ error: error.message });
  }
});

module.exports = router;
