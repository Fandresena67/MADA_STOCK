const { z } = require('zod');
const { NOTIFICATION_TYPES } = require('./notification.service');

const idParamSchema = z.object({
  id: z.coerce.number().int().positive('ID invalide'),
});

const dateSchema = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), { message: 'Date invalide' });

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .optional(),
  type: z.enum(NOTIFICATION_TYPES).optional(),
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
});

module.exports = { idParamSchema, listQuerySchema };
