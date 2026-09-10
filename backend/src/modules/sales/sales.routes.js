const { buildDocRouter } = require('../documents/doc.routes');
const service = require('./sales.service');
const { idParamSchema, saleListQuerySchema, saleBodySchema, salePatchSchema } = require('./sales.validation');

module.exports = buildDocRouter({
  service,
  validation: { idParam: idParamSchema, listQuery: saleListQuerySchema, body: saleBodySchema, patch: salePatchSchema },
  perms: { view: 'sales.view', create: 'sales.create', update: 'sales.update', confirm: 'sales.confirm' },
  tierFilterKey: 'customer_id',
});
