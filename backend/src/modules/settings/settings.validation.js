const { z } = require('zod');

const emailOpt = z.string().trim().max(255).optional()
  .refine((v) => v === undefined || v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Email invalide' });

const settingsPatchSchema = z
  .object({
    name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(255).optional(),
    email: emailOpt,
    phone: z.string().trim().max(64).optional(),
    address: z.string().trim().max(500).optional(),
    city: z.string().trim().max(120).optional(),
    country: z.string().trim().max(120).optional(),
    // currency verrouillée : MGA/Ariary (contexte malgache, pas de multi-devise à cette étape).
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'Aucune modification fournie' });

module.exports = { settingsPatchSchema };
