import { Router } from "express"
import mongoose from "mongoose"
import { UserModel } from "../models/User"
import { requireAuth } from "../middleware/auth"

const router = Router()

/**
 * GET /api/referrals/list?depth=20&limit=50&offset=0&q=...&status=active
 * Returns paginated downline list with referredBy (parent user info).
 *
 * NOTE:
 * - This endpoint is designed to be mounted as:
 *   app.use("/api/referrals/list", referralListRoutes);
 * - Therefore the route path here is "/" (NOT "/list").
 */
router.get("/", async (req, res) => {
  try {
    const ctx = await requireAuth(req)
    const userId = ctx.userId

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: "Invalid user id" })
    }
    const meId = new mongoose.Types.ObjectId(userId)

    const depthRaw = Number(req.query.depth ?? 10)
    const depth = Number.isFinite(depthRaw) ? Math.min(Math.max(depthRaw, 1), 20) : 10

    const limitRaw = Number(req.query.limit ?? 50)
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50

    const offsetRaw = Number(req.query.offset ?? 0)
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0

    const q = String(req.query.q ?? "").trim()
    const status = String(req.query.status ?? "").trim() // "active" | "suspended" | "" (no filter)

    const qRegex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null

    const pipeline: any[] = [
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
          downline: {
            $map: {
              input: "$downline",
              as: "d",
              in: {
                _id: "$$d._id",
                name: "$$d.name",
                fullName: "$$d.fullName",
                email: "$$d.email",
                mobile: "$$d.mobile",
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
    ]

    // Optional filters
    if (qRegex || status) {
      pipeline.push({
        $addFields: {
          downline: {
            $filter: {
              input: "$downline",
              as: "d",
              cond: {
                $and: [
                  ...(status ? [{ $eq: ["$$d.status", status] }] : []),
                  ...(qRegex
                    ? [
                        {
                          $or: [
                            { $regexMatch: { input: { $ifNull: ["$$d.email", ""] }, regex: qRegex } },
                            { $regexMatch: { input: { $ifNull: ["$$d.referralCode", ""] }, regex: qRegex } },
                            { $regexMatch: { input: { $ifNull: ["$$d.name", ""] }, regex: qRegex } },
                            { $regexMatch: { input: { $ifNull: ["$$d.fullName", ""] }, regex: qRegex } },
                          ],
                        },
                      ]
                    : []),
                ],
              },
            },
          },
        },
      })
    }

    // Pagination + referredBy lookup
    pipeline.push({
      $facet: {
        meta: [{ $project: { total: { $size: "$downline" } } }],
        data: [
          { $unwind: "$downline" },
          { $replaceRoot: { newRoot: "$downline" } },
          { $sort: { level: 1, createdAt: -1 } },
          { $skip: offset },
          { $limit: limit },

          // Join parent user info for each downline row
          {
            $lookup: {
              from: "users",
              localField: "parent",
              foreignField: "_id",
              as: "parentUser",
              pipeline: [{ $project: { _id: 1, name: 1, fullName: 1, email: 1, mobile: 1, referralCode: 1 } }],
            },
          },
          { $addFields: { parentUser: { $first: "$parentUser" } } },

          // Create referredBy object
          {
            $addFields: {
              referredBy: {
                $cond: [
                  { $ifNull: ["$parentUser._id", false] },
                  {
                    id: { $toString: "$parentUser._id" },
                    name: { $ifNull: ["$parentUser.name", "$parentUser.fullName"] },
                    email: "$parentUser.email",
                    mobile: "$parentUser.mobile",
                    referralCode: "$parentUser.referralCode",
                  },
                  null,
                ],
              },
            },
          },

          // Clean up
          { $project: { parentUser: 0 } },
        ],
      },
    })

    const rows = await UserModel.aggregate(pipeline).option({ allowDiskUse: true })

    const meta = rows?.[0]?.meta?.[0] ?? { total: 0 }
    const data = rows?.[0]?.data ?? []

    return res.json({
      total: meta.total ?? 0,
      offset,
      limit,
      depth,
      items: data.map((u: any) => ({
        id: String(u._id),
        name: u.name || u.fullName || "User",
        email: u.email || "",
        referralCode: u.referralCode,
        status: u.status,
        activityStatus: u.activityStatus,
        position: u.position ?? null,
        joinedAt: u.createdAt,
        level: (u.level ?? 0) + 1, // downline level (root children = 1)
        parentId: u.parent ? String(u.parent) : null,

        // ✅ referredBy (parent details)
        referredBy: u.referredBy?.id
          ? {
              id: u.referredBy.id,
              name: u.referredBy.name || "—",
              email: u.referredBy.email || "",
              mobile: u.referredBy.mobile || "",
              referralCode: u.referredBy.referralCode || "",
            }
          : null,
      })),
    })
  } catch (e: any) {
    const msg = e?.message ?? "Unauthorized"
    return res.status(401).json({ error: msg })
  }
})

export default router
