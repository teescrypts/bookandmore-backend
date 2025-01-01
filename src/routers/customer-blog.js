const express = require("express");
const Blog = require("../models/blog");
const router = new express.Router();

router.get("/api/customer/fetch/blogs", async (req, res) => {
  try {
    const skip = parseInt(req.query.skip, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 9;

    const blogs = await Blog.find({})
      .skip(skip)
      .limit(limit)
      .select("-admin -branch");
    res.send({ message: blogs });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

router.get("/api/customer/fetch/blogs/:id", async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) return res.send({ error: "Blog has been removed" });

    res.send({ message: blog });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
});

module.exports = router;
