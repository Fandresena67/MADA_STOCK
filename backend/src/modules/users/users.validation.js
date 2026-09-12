const { z } = require('zod');
const { PERMISSION_CODES } = require('../../rbac/permissions');

const emailSchema = z.string().email('Email invalide').max(255).toLowerCase().trim();
const passwordSchema = z
  .string()
  .min(8, 'Mot de passe : 8 caractères minimum')
  .max(128, 'Mot de passe trop long')
  .regex(/[A-Z]/, 'Mot de passe : au moins une majuscule')
  .regex(/[a-z]/, 'Mot de passe : au moins une minuscule')
  .regex(/[0-9]/, 'Mot de passe : au moins un chiffre');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Recherche + filtres serveur de la liste tenant (tout reste scopé company_id côté service).
const usersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
  role: z.enum(['company_admin', 'employee']).optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

const permissionsArraySchema = z
  .array(z.enum(PERMISSION_CODES, { errorMap: () => ({ message: 'Permission inconnue' }) }))
  .max(100)
  .refine((arr) => new Set(arr).size === arr.length, { message: 'Permissions en double' });

const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(255),
  email: emailSchema,
  password: passwordSchema,
  // Rôle ignoré sauf pour super_admin (jamais 'super_admin' via API).
  role: z.enum(['employee', 'company_admin']).optional(),
  // Permissions initiales (employés uniquement, validées côté service).
  permissions: permissionsArraySchema.optional(),
});

const patchUserSchema = z
  .object({
    name: z.string().trim().min(2).max(255).optional(),
    email: emailSchema.optional(),
    is_active: z.boolean().optional(),
    role: z.enum(['employee', 'company_admin']).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

// Alias explicite : activation / désactivation (même garde-fous que PATCH /:id).
const statusSchema = z.object({
  is_active: z.boolean(),
});

const grantPermissionSchema = z.object({
  permission: z.enum(PERMISSION_CODES, { errorMap: () => ({ message: 'Permission inconnue' }) }),
});

// Remplacement complet des permissions explicites d'un employé.
const setPermissionsSchema = z.object({
  permissions: permissionsArraySchema.default([]),
});

// Reset administratif : l'admin ne connaît jamais l'ancien mot de passe.
const adminPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirmation requise').max(128),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'La confirmation ne correspond pas au nouveau mot de passe',
    path: ['confirmPassword'],
  });

module.exports = { idParamSchema, paginationSchema, usersQuerySchema, createUserSchema, patchUserSchema, statusSchema, grantPermissionSchema, setPermissionsSchema, adminPasswordSchema };
