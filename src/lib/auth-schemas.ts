import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
  .regex(/[A-Za-z]/, "Ajoutez au moins une lettre.")
  .regex(/[0-9]/, "Ajoutez au moins un chiffre.");

export const loginSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Prénom requis.").max(80),
    lastName: z.string().trim().min(1, "Nom requis.").max(80),
    email: z.string().trim().email("Adresse e-mail invalide."),
    phone: z.string().trim().min(8, "Téléphone requis (au moins 8 caractères)."),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirmez le mot de passe."),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type SignupValues = z.infer<typeof signupSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
