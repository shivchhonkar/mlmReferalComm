import type { Express } from "express";

// Import all modular route files
import authRoutes from "@/routes/authRoutes";
import userRoutes from "@/routes/userRoutes";
import serviceRoutes from "@/routes/serviceRoutes";
import purchaseRoutes from "@/routes/purchaseRoutes";
import ordersRoutes from "@/routes/ordersRoutes";
import incomeRoutes from "@/routes/incomeRoutes";
// import referralRoutes from "@/routes/referralRoutes";
import referralRoutes from "@/routes/referralGetRoutes";
import referralListRoutes from "@/routes/referralListRoutes";
import referralSearchRoutes from "@/routes/referralSearchRoutes";
// import referralRoutes from ""
import businessOpportunityRoutes from "@/routes/businessOpportunityRoutes";
import contactRoutes from "@/routes/contactRoutes";
import sliderRoutes from "@/routes/sliderRoutes";
import categoryRoutes from "@/routes/categoryRoutes";
import subcategoryRoutes from "@/routes/subcategoryRoutes";
import adminSetupRoutes from "@/routes/admin/setupRoutes";
import { registerAdminRoutes } from "@/routes/admin/index";
import { registerSellerServiceRoutes } from "@/routes/sellerServiceRoutes";
import requestRoutes from "@/routes/requestRoutes";

/**
 * Register all application routes
 * Routes are organized by feature/module for better maintainability
 */
export function registerRoutes(app: Express) {
  // ============================================================================
  // AUTHENTICATION ROUTES
  // ============================================================================
  // Register auth routes (login, register, logout, check-exists)
  // Includes rate limiting for security
  app.use("/api/auth", authRoutes);

  // ============================================================================
  // USER ROUTES
  // ============================================================================
  // Profile management, image upload, KYC submission
  app.use("/api", userRoutes);

  // ============================================================================
  // PUBLIC ROUTES
  // ============================================================================
  // Public-facing endpoints accessible without authentication
  
  // Services (public catalog)
  app.use("/api/services", serviceRoutes);

  // Categories and subcategories (public taxonomy)
  app.use("/api/categories", categoryRoutes);
  app.use("/api/subcategories", subcategoryRoutes);

  // Homepage sliders (public content)
  app.use("/api/sliders", sliderRoutes);

  // Contact form
  app.use("/api/contact", contactRoutes);

  // Business opportunity email request
  app.use("/api/business-opportunity", businessOpportunityRoutes);

  // ============================================================================
  // AUTHENTICATED USER ROUTES
  // ============================================================================
  // These routes require user authentication
  
  // Purchase management and BV distribution
  app.use("/api/purchases", purchaseRoutes);
  app.use("/api/orders", ordersRoutes);

  // Income tracking and history
  app.use("/api/income", incomeRoutes);

  // Referral tree visualization
  app.use("/api/referrals", referralRoutes);
  app.use("/api/referrals/list", referralListRoutes);
  
  app.use("/api/referrals/search", referralSearchRoutes);
  

  // ============================================================================
  // ADMIN ROUTES
  // ============================================================================
  // All admin routes are consolidated for better organization
  // Includes: dashboard, analytics, user management, service management,
  // service approval, contacts, sliders, categories, subcategories,
  // distribution rules, payment settings, KYC management
  
  // All admin functionality (must be before adminSetupRoutes so specific routes match first)
  registerAdminRoutes(app);

  // Admin setup (initial admin account creation) - mounted after specific admin routes
  app.use("/api/admin", adminSetupRoutes);

  // Become a seller route
  app.use("/api/requests", requestRoutes);

  // Seller service management (own services only)
  registerSellerServiceRoutes(app);
}
