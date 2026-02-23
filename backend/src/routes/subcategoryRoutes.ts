import { Router } from "express";
import { connectToDatabase } from "@/lib/db";
import { SubcategoryModel } from "@/models/Subcategory";

const router = Router();

// Get all active subcategories (public)
router.get("/", async (req, res) => {
  try {
    await connectToDatabase();
    const categoryId = req.query.categoryId as string | undefined;
    const filter: Record<string, unknown> = { isActive: true };
    if (categoryId) filter.categoryId = categoryId;

    const subcategories = await SubcategoryModel.find(filter)
      .populate("categoryId", "name code _id")
      .sort({ sortOrder: 1, name: 1 })
      .lean();

    const formatted = subcategories.map((sub) => {
      const catId = sub.categoryId;
      const categoryId = typeof catId === "object" && catId
        ? { _id: (catId as any)._id?.toString(), name: (catId as any).name, code: (catId as any).code }
        : catId != null ? String(catId) : "";
      return {
        _id: sub._id?.toString() || "",
        name: sub.name,
        slug: sub.slug,
        code: sub.code,
        categoryId,
        sortOrder: sub.sortOrder,
        createdAt: sub.createdAt,
      };
    });

    return res.json({ subcategories: formatted });
  } catch (err: unknown) {
    console.error("Error fetching subcategories:", err);
    const msg = err instanceof Error ? err.message : "Unable to load subcategories";
    return res.status(500).json({ error: msg });
  }
});

export default router;
