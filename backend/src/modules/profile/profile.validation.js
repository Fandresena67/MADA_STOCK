const { z } = require('zod');

// Cohérent avec users.validation (create/patch) : 2–255 caractères, espaces rognés.
const updateNameSchema = z.object({
  name: z.string().trim().min(2, 'Nom : 2 caractères minimum').max(255),
});

module.exports = { updateNameSchema };
