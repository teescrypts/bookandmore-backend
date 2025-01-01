const express = require("express");
const auth = require("../middleware/auth");
const Blog = require("../models/blog");
const multer = require("multer");
const BlogImage = require("../models/blog-image");
const sharp = require("sharp");
const Branch = require("../models/branch");
const checkPermission = require("../utils/check-permission");
const router = new express.Router();

router.post("/api/blogs", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const blog = new Blog({
      admin,
      branch,
      ...req.body,
    });

    await blog.save();
    await BlogImage.updateMany(
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
        const isPermitted = await checkPermission("blog", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler(user.admin, user.branch);
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(200).send({ message: "Blog post publised" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/blogs", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async (admin, branch) => {
    const blogs = await Blog.find({ admin, branch }).select(
      "title createdAt shortDescription author content coverImage engagements"
    );

    res.status(200).send({ message: blogs });
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
        const isPermitted = await checkPermission("blog", user._id);

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

router.delete("/api/blogs/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const deletedPost = await Blog.findByIdAndDelete(req.params.id);

    if (!deletedPost) {
      res.send({ error: "Invalid Operation" });
    }
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }
      case "staff": {
        const isPermitted = await checkPermission("blog", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Blog deleted" });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/blogs/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const blog = await Blog.findOne({ _id: req.params.id });

    if (!blog) return res.send({ error: "Invalid operation" });

    res.status(201).send({ message: blog });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("blog", user._id);

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

router.patch("/api/blogs/:id", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const updates = Object.keys(req.body);
    const allowedUpdates = [
      "title",
      "shortDescription",
      "author",
      "content",
      "coverImage",
    ];
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).send({ error: "Invalid updates!" });
    }

    const blog = await Blog.findOne({
      _id: req.params.id,
    });

    if (!blog) {
      return res.status(404).send();
    }

    updates.forEach((update) => (blog[update] = req.body[update]));
    await blog.save();
    await BlogImage.updateMany(
      { owner: user._id, status: "draft" },
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
        const isPermitted = await checkPermission("blog", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Blog Updated" });
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
  "/api/blogs/single/image",
  auth,
  upload.single("image"),
  async (req, res) => {
    const user = req.user;
    const body = req.body;

    const eventHandler = async () => {
      const buffer = await sharp(req.file.buffer)
        .webp({ quality: 40 })
        .toBuffer();

      const existingDraft = await BlogImage.findOne({
        owner: user._id,
        status: "draft",
      });

      if (existingDraft) {
        existingDraft.image = buffer;
        existingDraft.fileName = body.fileName;

        const draftImage = await existingDraft.save();
        res.send({
          message: { imageId: draftImage._id, fileName: draftImage.fileName },
        });
      } else {
        const blogImage = new BlogImage({
          image: buffer,
          owner: user._id,
          fileName: body.fileName,
        });

        const draftImage = await blogImage.save();
        res.send({
          message: { imageId: draftImage._id, fileName: draftImage.fileName },
        });
      }
    };

    try {
      switch (user.type) {
        case "admin": {
          await eventHandler();
          break;
        }

        case "staff": {
          const isPermitted = await checkPermission("blog", user._id);

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
  },
  (error, req, res, next) => {
    res.status(400).send({ error: error.message });
  }
);

// router.delete("/api/blogs/image", auth, async (req, res) => {
//   const user = req.user;

//   const eventHandler = async () => {
//     await BlogImage.deleteMany({ owner: user._id });
//   };

//   try {
//     switch (user.type) {
//       case "admin":
//         await eventHandler();
//         break;

//       default:
//         throw new Error("Invalid Opearation");
//         break;
//     }

//     res.status(201).send({ message: "All Images deleted" });
//   } catch (e) {
//     res.status(400).send({ error: error.message });
//   }
// });

router.delete("/api/blogs/:id/image", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    await BlogImage.findByIdAndDelete({ _id: req.params.id });
  };

  try {
    switch (user.type) {
      case "admin": {
        await eventHandler();
        break;
      }

      case "staff": {
        const isPermitted = await checkPermission("blog", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        throw new Error("Invalid Opearation");
        break;
    }

    res.status(201).send({ message: "Image removed" });
  } catch (e) {
    res.status(400).send({ error: error.message });
  }
});

router.get("/blogs/:id/image", async (req, res) => {
  try {
    const blogImage = await BlogImage.findById(req.params.id);

    if (!blogImage) {
      throw new Error();
    }

    res.set("Content-Type", "image/webp");
    res.send(blogImage.image);
  } catch (e) {
    res.status(404).send();
  }
});

router.get("/blogs/image", auth, async (req, res) => {
  const user = req.user;

  const eventHandler = async () => {
    const draftImages = await BlogImage.findOne({
      owner: user._id,
      status: "draft",
    }).select("fileName");

    if (!draftImages) {
      return res.send({ message: "No draft" });
    }

    const data = {
      _id: draftImages._id,
      url: `blogs/${draftImages._id}/image`,
      fileName: draftImages.fileName,
      imageId: draftImages._id,
    };

    res.send({ message: data });
  };

  try {
    switch (user.type) {
      case "admin":
        await eventHandler();
        break;

      case "staff": {
        const isPermitted = await checkPermission("blog", user._id);

        if (!isPermitted) return res.send({ error: "Invalid Operation" });

        await eventHandler();
        break;
      }

      default:
        break;
    }
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
});



module.exports = router;
