
import { Router } from "express"
import { UserModel } from "@/models/User";
import { requireAuth } from "@/middleware/auth";

const router = Router()

router.post("/seller", async (req, res) => {
  try {
    const ctx = await requireAuth(req)
    const userId = ctx.userId

    const user = await UserModel.findById(userId)
    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    if (user.sellerStatus === "pending") {
      return res.status(400).json({ error: "Request already pending" })
    }

    if (user.isSeller) {
      return res.status(400).json({ error: "Already approved as seller" })
    }

    user.sellerStatus = "pending"
    await user.save()

    res.json({ message: "Seller request submitted for approval" })
  } catch (err: unknown) {
    console.error('Error becoming seller:', err);
    const msg = err instanceof Error ? err.message : "Unable to become seller. Please try again.";
    res.status(400).json({ error: msg });
  }
})

// get all pending sellers
router.get("/pending-sellers", async (req, res) => {
  try {
    const ctx = await requireAuth(req)
    const userId = ctx.userId

    // 🔐 Only admin or super_admin
    const admin = await UserModel.findById(userId)
    const isAdmin = admin?.role === "admin" || admin?.role === "super_admin"
    if (!admin || !isAdmin) {
      return res.status(403).json({ error: "Access denied" })
    }

    // 📄 Pagination
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Number(req.query.limit) || 10, 50)
    const skip = (page - 1) * limit

    const [requests, total] = await Promise.all([
      UserModel.find({ sellerStatus: "pending" })
        .select("_id name fullName email createdAt sellerStatus")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      UserModel.countDocuments({ sellerStatus: "pending" }),
    ])

    return res.json({
      data: requests.map((u) => ({
        id: u._id,
        name: u.name || u.fullName,
        email: u.email,
        requestedAt: u.createdAt,
        status: u.sellerStatus,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
})

router.patch("/approve/:userId", async (req, res) => {
  try {
    const ctx = await requireAuth(req)
    const admin = await UserModel.findById(ctx.userId)
    const isAdmin = admin?.role === "admin" || admin?.role === "super_admin"
    if (!admin || !isAdmin) return res.status(403).json({ error: "Access denied" })

    const { userId } = req.params
    const user = await UserModel.findById(userId)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.sellerStatus !== "pending") {
      return res.status(400).json({ error: "User is not pending for seller approval" })
    }

    user.sellerStatus = "approved"
    user.sellerApprovedAt = new Date()
    user.isSeller = true
    user.sellerRejectedAt = undefined
    user.sellerRejectionReason = undefined
    await user.save()

    return res.json({ message: "User approved as seller" })
  } catch (e: any) {
    return res.status(e?.status === 401 ? 401 : 500).json({ error: e?.message || "Failed to approve" })
  }
})

router.patch("/reject/:userId", async (req, res) => {
  try {
    const ctx = await requireAuth(req)
    const admin = await UserModel.findById(ctx.userId)
    const isAdmin = admin?.role === "admin" || admin?.role === "super_admin"
    if (!admin || !isAdmin) return res.status(403).json({ error: "Access denied" })

    const { userId } = req.params
    const body = req.body || {}
    const user = await UserModel.findById(userId)
    if (!user) return res.status(404).json({ error: "User not found" })
    if (user.sellerStatus !== "pending") {
      return res.status(400).json({ error: "User is not pending for seller approval" })
    }

    user.sellerStatus = "rejected"
    user.sellerRejectedAt = new Date()
    user.sellerRejectionReason = (body.reason || "").toString().trim() || undefined
    await user.save()

    return res.json({ message: "Seller request rejected" })
  } catch (e: any) {
    return res.status(e?.status === 401 ? 401 : 500).json({ error: e?.message || "Failed to reject" })
  }
})

export default router;