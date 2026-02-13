import { z } from 'zod';

// User-friendly error messages for validation
export const VALIDATION_MESSAGES = {
  // Auth related
  INVALID_EMAIL: 'Please enter a valid email address',
  EMAIL_REQUIRED: 'Email address is required',
  EMAIL_EXISTS: 'This email is already registered',
  MOBILE_INVALID: 'Please enter a valid mobile number',
  MOBILE_EXISTS: 'This mobile number is already registered',
  PASSWORD_SHORT: 'Password must be at least 8 characters long',
  PASSWORD_WEAK: 'Password must contain letters and numbers',
  TERMS_REQUIRED: 'You must accept the terms and conditions',
  
  // Profile related
  NAME_REQUIRED: 'Name is required',
  NAME_TOO_SHORT: 'Name must be at least 2 characters long',
  FULL_NAME_REQUIRED: 'Full name is required',
  COMPANY_NAME_REQUIRED: 'Company name is required',
  
  // File upload related
  FILE_TOO_LARGE: 'File size cannot exceed 2MB',
  INVALID_FILE_TYPE: 'Only image files are allowed (JPG, PNG, GIF, WebP)',
  NO_FILE_UPLOADED: 'Please select a file to upload',
  
  // General
  UNAUTHORIZED: 'Please log in to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  ACCOUNT_DELETED: 'Your account has been deleted',
  ACCOUNT_SUSPENDED: 'Your account has been suspended',
  SESSION_EXPIRED: 'Your session has expired, please log in again',
  INVALID_INPUT: 'Please check your input and try again',
  SERVER_ERROR: 'Something went wrong, please try again later',
  
  // Business related
  SERVICE_NAME_REQUIRED: 'Service name is required',
  SERVICE_PRICE_INVALID: 'Please enter a valid price',
  CATEGORY_REQUIRED: 'Please select a category',
  DESCRIPTION_REQUIRED: 'Description is required',
  
  // KYC related
  DOCUMENT_REQUIRED: 'Please upload required documents',
  INVALID_DOCUMENT_TYPE: 'Invalid document format',
  KYC_ALREADY_SUBMITTED: 'Your KYC is already submitted',
  
  // Payment related
  INVALID_AMOUNT: 'Please enter a valid amount',
  PAYMENT_FAILED: 'Payment processing failed',
  INSUFFICIENT_BALANCE: 'Insufficient balance'
} as const;

// Custom error handling for Zod validation
export function formatZodError(error: z.ZodError): string {
  const firstError = error.issues[0];
  if (!firstError) return VALIDATION_MESSAGES.INVALID_INPUT;
  
  const field = firstError.path.join('.');
  const message = firstError.message;
  
  // Map common Zod errors to user-friendly messages
  switch (message) {
    case 'Required':
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is required`;
    case 'Invalid email':
      return VALIDATION_MESSAGES.INVALID_EMAIL;
    case 'Too small':
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is too short`;
    case 'Too big':
      return `${field.charAt(0).toUpperCase() + field.slice(1)} is too long`;
    default:
      return message;
  }
}

// Enhanced validation schemas with custom messages
export const authValidation = {
  register: z.object({
    mobile: z.string()
      .min(10, VALIDATION_MESSAGES.MOBILE_INVALID)
      .max(15, VALIDATION_MESSAGES.MOBILE_INVALID)
      .regex(/^[0-9+\-\s()]+$/, VALIDATION_MESSAGES.MOBILE_INVALID),
    countryCode: z.string().default("+91"),
    name: z.string()
      .min(2, VALIDATION_MESSAGES.NAME_TOO_SHORT)
      .max(50, 'Name cannot exceed 50 characters'),
    email: z.string()
      .email(VALIDATION_MESSAGES.INVALID_EMAIL)
      .optional()
      .or(z.literal('')),
    password: z.string()
      .min(8, VALIDATION_MESSAGES.PASSWORD_SHORT)
      .regex(/^(?=.*[A-Za-z])(?=.*\d)/, VALIDATION_MESSAGES.PASSWORD_WEAK),
    acceptedTerms: z.literal(true, { message: VALIDATION_MESSAGES.TERMS_REQUIRED }),
    referralCode: z.string()
      .optional()
      .transform((v) => (typeof v === "string" ? v.trim() : v))
      .transform((v) => (v ? v : undefined)),
    fullName: z.string()
      .min(2, VALIDATION_MESSAGES.FULL_NAME_REQUIRED)
      .max(100, 'Full name cannot exceed 100 characters'),
  }),
  
  login: z.object({
    mobile: z.string()
      .min(10, VALIDATION_MESSAGES.MOBILE_INVALID)
      .max(15, VALIDATION_MESSAGES.MOBILE_INVALID),
    password: z.string()
      .min(1, 'Password is required'),
  }),
  
  updateProfile: z.object({
    name: z.string()
      .min(2, VALIDATION_MESSAGES.NAME_TOO_SHORT)
      .max(50, 'Name cannot exceed 50 characters')
      .optional(),
    email: z.string()
      .email(VALIDATION_MESSAGES.INVALID_EMAIL)
      .optional()
      .or(z.literal('')),
    fullName: z.string()
      .min(2, VALIDATION_MESSAGES.FULL_NAME_REQUIRED)
      .max(100, 'Full name cannot exceed 100 characters')
      .optional(),
  }).refine((v) => Object.keys(v).length > 0, {
    message: 'Please provide at least one field to update'
  })
};

export const serviceValidation = {
  create: z.object({
    name: z.string()
      .min(2, VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED)
      .max(100, 'Service name cannot exceed 100 characters'),
    description: z.string()
      .min(10, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
      .max(2000, 'Description cannot exceed 2000 characters'),
    price: z.number()
      .min(0, VALIDATION_MESSAGES.SERVICE_PRICE_INVALID)
      .max(999999, 'Price cannot exceed 999,999'),
    categoryId: z.string()
      .min(1, VALIDATION_MESSAGES.CATEGORY_REQUIRED),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().default(true),
  }),
  
  update: z.object({
    name: z.string()
      .min(2, VALIDATION_MESSAGES.SERVICE_NAME_REQUIRED)
      .max(100, 'Service name cannot exceed 100 characters')
      .optional(),
    description: z.string()
      .min(10, VALIDATION_MESSAGES.DESCRIPTION_REQUIRED)
      .max(2000, 'Description cannot exceed 2000 characters')
      .optional(),
    price: z.number()
      .min(0, VALIDATION_MESSAGES.SERVICE_PRICE_INVALID)
      .max(999999, 'Price cannot exceed 999,999')
      .optional(),
    categoryId: z.string()
      .min(1, VALIDATION_MESSAGES.CATEGORY_REQUIRED)
      .optional(),
    features: z.array(z.string()).optional(),
    isActive: z.boolean().optional(),
  }).refine((v) => Object.keys(v).length > 0, {
    message: 'Please provide at least one field to update'
  })
};

export const categoryValidation = {
  create: z.object({
    name: z.string()
      .min(2, 'Category name must be at least 2 characters')
      .max(50, 'Category name cannot exceed 50 characters'),
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    isActive: z.boolean().default(true),
  }),
  
  update: z.object({
    name: z.string()
      .min(2, 'Category name must be at least 2 characters')
      .max(50, 'Category name cannot exceed 50 characters')
      .optional(),
    description: z.string()
      .max(500, 'Description cannot exceed 500 characters')
      .optional(),
    isActive: z.boolean().optional(),
  }).refine((v) => Object.keys(v).length > 0, {
    message: 'Please provide at least one field to update'
  })
};

// Error response helper
export function sendValidationError(res: any, message: string, status: number = 400) {
  return res.status(status).json({ 
    error: message,
    type: 'validation_error'
  });
}

// Success response helper
export function sendSuccessResponse(res: any, data: any, message: string = 'Success') {
  return res.status(200).json({ 
    success: true,
    message,
    data
  });
}
