import bcrypt from "bcryptjs";

export async function hashPassword(plainText: string) {
  // Reduced cost factor for better performance while maintaining security
  // 10 is a good balance between security and speed for most applications
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

export async function verifyPassword(plainText: string, passwordHash: string) {
  return bcrypt.compare(plainText, passwordHash);
}
