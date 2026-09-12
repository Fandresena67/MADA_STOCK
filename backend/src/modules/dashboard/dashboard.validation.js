const { z } = require('zod');

const MAX_RANGE_DAYS = 400;

function startOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d) {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}

const periodBase = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

function periodRefine(d, ctx) {
  if (d.from && d.to && d.to < d.from) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La date de fin doit suivre la date de début' });
  }
  if (d.from && d.to && (d.to - d.from) / 86400000 > MAX_RANGE_DAYS) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Période maximale : ${MAX_RANGE_DAYS} jours` });
  }
}

const periodSchema = periodBase.superRefine(periodRefine);

function normalizePeriod(q) {
  const to = q.to ? endOfDay(q.to) : endOfDay(new Date());
  const from = q.from ? startOfDay(q.from) : startOfDay(new Date(to.getTime() - 29 * 86400000));
  return { from: from.toISOString(), to: to.toISOString() };
}

const trendsQuerySchema = periodSchema;
const summaryQuerySchema = periodBase
  .extend({
    // Comparaison période précédente : ?compare=true (champ `compare` additif).
    compare: z
      .enum(['true', 'false', '1', '0'])
      .transform((v) => v === 'true' || v === '1')
      .optional(),
  })
  .superRefine(periodRefine);

const topQuerySchema = periodBase.extend({
  limit: z.coerce.number().int().min(1).max(20).default(5),
}).superRefine(periodRefine);

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(15).default(10),
});

const alertsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

module.exports = { normalizePeriod, trendsQuerySchema, summaryQuerySchema, topQuerySchema, activityQuerySchema, alertsQuerySchema };
