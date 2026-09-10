const { z } = require('zod');

const emailSchema = z.string().email('Email invalide').max(255).toLowerCase().trim();
const passwordSchema = z
  .string()
  .min(8, 'Mot de passe : 8 caractères minimum')
  .max(128, 'Mot de passe trop long')
  .regex(/[A-Z]/, 'Mot de passe : au moins une majuscule')
  .regex(/[a-z]/, 'Mot de passe : au moins une minuscule')
  .regex(/[0-9]/, 'Mot de passe : au moins un chiffre');

const registerSchema = z
  .object({
    companyName: z.string().trim().min(2, 'Nom entreprise : 2 caractères minimum').max(255),
    name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(255),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

const refreshSchema = z.object({
  // Optionnel : le refresh transite prioritairement par cookie HttpOnly.
  refreshToken: z.string().min(10, 'Refresh token invalide').optional(),
});

const logoutAllSchema = z.object({
  // Optionnel : admin → révoque les sessions d'un employé de son entreprise.
  userId: z.coerce.number().int().positive('userId invalide').optional(),
});

module.exports = { registerSchema, loginSchema, refreshSchema, logoutAllSchema };
