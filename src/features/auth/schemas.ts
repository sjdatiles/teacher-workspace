import { z } from "zod";

/** Result shape shared by all auth/profile server actions. */
export type FormState =
  | { ok?: undefined }
  | { ok: true; message: string }
  | { ok: false; errors: Record<string, string> };

const email = z.string().trim().toLowerCase().email("Enter a valid email address.");

const newPassword = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use at most 72 characters.")
  .regex(/[A-Za-z]/, "Include at least one letter.")
  .regex(/\d/, "Include at least one number.");

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
    email,
    password: newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});

export const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  jobTitle: z.string().trim().min(1, "Enter your job title.").max(80),
  schoolName: z.string().trim().max(160),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match.",
  });
