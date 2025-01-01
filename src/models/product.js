const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "User",
    },
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: "Branch",
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      taxCode: {
        type: String,
        required: true,
        trim: true,
      },
    },
    description: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    expiryDate: {
      type: Date,
    },
    SKU: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
    },
    sizeBasedQuantity: {
      enabled: {
        type: Boolean,
        default: false,
      },
      details: [
        {
          sizeType: {
            type: String,
            trim: true,
          },
          quantity: {
            type: Number,
          },
        },
      ],
    },
    quantity: {
      type: Number,
    },
    images: [
      {
        url: {
          type: String,
          required: true,
        },
        fileName: {
          type: String,
        },
        imageId: {
          type: String,
          required: true,
        },
      },
    ],

    sellOnlyWithAppointment: {
      type: Boolean,
      default: false,
    },

    inStock: {
      type: Boolean,
      required: true,
      default: true,
    },

    stripeData: {
      priceId: {
        type: String,
      },
      productId: {
        type: String,
      },
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ branch: 1, name: 1 });
productSchema.index({ branch: 1, SKU: 1 });
productSchema.index({ branch: 1, barcode: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
