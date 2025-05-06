import express from "express";
import { connectToDB } from "../dbConnect.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const db = await connectToDB();
    const result = await db.collection("test").insertOne({
      message: "Hello from Realtra server",
      createdAt: new Date(),
    });
    res.json({ success: true, insertedId: result.insertedId });
  } catch (err) {
    console.error("MongoDB insert failed:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
