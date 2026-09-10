/**
 * Fabrique un middleware de validation Zod.
 * Valide req.body contre le schéma, retourne 400 générique + détails champs.
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || 'body',
        message: i.message,
      }));
      return res.status(400).json({ error: 'Données invalides', details });
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validate };
