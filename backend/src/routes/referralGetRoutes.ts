import { Router } from "express"
import mongoose from "mongoose"
import { UserModel } from "../models/User"
import { ServiceModel } from "@/models/Service";
// import { requireAuth } from "@/middleware/auth"
import { requireAuth } from "../middleware/auth"
// import { requireAuth } from "@/middleware/auth";


const router = Router()

router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req) // ✅ uses cookie "token" or Bearer token
    const userId = ctx.userId

    const depthRaw = Number(req.query.depth ?? 4)
    const depth = Number.isFinite(depthRaw) ? Math.min(Math.max(depthRaw, 1), 10) : 4

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" })
    }

    const meId = new mongoose.Types.ObjectId(userId)

    const rows = await UserModel.aggregate([
  { $match: { _id: meId } },
  {
    $graphLookup: {
      from: "users",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "parent",
      as: "downline",
      maxDepth: depth - 1,
      depthField: "level",
      restrictSearchWithMatch: { status: { $ne: "deleted" } },
    },
  },
  {
    $project: {
      root: {
        _id: "$_id",
        name: "$name",
        fullName: "$fullName",
        email: "$email",
        referralCode: "$referralCode",
        status: "$status",
        activityStatus: "$activityStatus",
        parent: "$parent",
        position: "$position",
        createdAt: "$createdAt",
      },
      downline: {
        $map: {
          input: "$downline",
          as: "d",
          in: {
            _id: "$$d._id",
            name: "$$d.name",
            fullName: "$$d.fullName",
            email: "$$d.email",
            referralCode: "$$d.referralCode",
            status: "$$d.status",
            activityStatus: "$$d.activityStatus",
            parent: "$$d.parent",
            position: "$$d.position",
            createdAt: "$$d.createdAt",
            level: "$$d.level",
          },
        },
      },
    },
  },
]).option({ allowDiskUse: true })


    if (!rows?.length) return res.json({ root: null, stats: null })

    const root = rows[0].root
    const downline = (rows[0].downline ?? []) as any[]

    const byId = new Map<string, any>()
    const childrenByParent = new Map<string, any[]>()

    const normalize = (u: any) => ({
      id: String(u._id),
      name: (u.name || u.fullName || "User") as string,
      email: (u.email || "") as string,
      referralCode: u.referralCode as string,
      status: u.status,
      activityStatus: u.activityStatus,
      position: u.position ?? null,
      joinedAt: u.createdAt,
      children: [] as any[],
    })

    const rootNode = normalize(root)
    byId.set(rootNode.id, rootNode)

    for (const u of downline) {
      const n = normalize(u)
      byId.set(n.id, n)

      const pid = u.parent ? String(u.parent) : null
      if (!pid) continue
      const list = childrenByParent.get(pid) ?? []
      list.push(n)
      childrenByParent.set(pid, list)
    }

    for (const [pid, kids] of childrenByParent.entries()) {
      const parentNode = byId.get(pid)
      if (!parentNode) continue

      kids.sort((a, b) => (a.position === "left" ? 0 : 1) - (b.position === "left" ? 0 : 1))
      parentNode.children = kids.slice(0, 2)
    }

    const total = downline.length
    const allUsers = await Promise.all([
            UserModel.estimatedDocumentCount()
    ]);
    const active = downline.filter((x) => x.status === "active").length
    const depthFound = downline.reduce((m, x) => Math.max(m, (x.level ?? 0) + 1), 0)

    const directKids = childrenByParent.get(rootNode.id) ?? []
    const directLeft = directKids.filter((k) => k.position === "left").length
    const directRight = directKids.filter((k) => k.position === "right").length

    return res.json({
      root: rootNode,
      stats: { directLeft, directRight, allUsers, total, active, depth: depthFound },
    })
  } catch (e: any) {
    // Your global error handler returns 400 for thrown errors.
    // Here we can be explicit:
    const msg = e?.message ?? "Server error"
    const isAuth = msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("session")
    return res.status(isAuth ? 401 : 500).json({ error: msg })
  }
})

export default router
