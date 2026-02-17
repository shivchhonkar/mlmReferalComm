import { Router } from "express"
import mongoose from "mongoose"
import { UserModel } from "../models/User"
// import { requireAuth } from "@/middleware/auth"
import { requireAuth } from "../middleware/auth"
// import { requireAuth } from "@/middleware/auth";

const router = Router()

router.get("/search", async (req, res) => {
  try {
    await requireAuth(req)

    const q = String(req.query.q ?? "").trim()
    if (!q) return res.json({ items: [] })

    const qRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")

    const users = await UserModel.find({
      status: { $ne: "deleted" },
      $or: [{ email: qRegex }, { referralCode: qRegex }, { name: qRegex }, { fullName: qRegex }],
    })
      .select("_id name fullName email referralCode status activityStatus position createdAt parent")
      .limit(10)
      .lean()

    return res.json({
      items: users.map((u: any) => ({
        id: String(u._id),
        name: u.name || u.fullName || "User",
        email: u.email || "",
        referralCode: u.referralCode,
        status: u.status,
        activityStatus: u.activityStatus,
        position: u.position ?? null,
        joinedAt: u.createdAt,
        parentId: u.parent ? String(u.parent) : null,
      })),
    })
  } catch (e: any) {
    return res.status(401).json({ error: e?.message ?? "Unauthorized" })
  }
})

export default router