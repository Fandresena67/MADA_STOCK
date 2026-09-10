const { makeDocService } = require('../documents/doc.service');

const sales = makeDocService({
  table: 'sales',
  tierTable: 'customers',
  tierKey: 'customer_id',
  tierLabel: 'customer',
  refSeq: 'sale_ref_seq',
  refPrefix: 'VTE',
  movementType: 'out',
  movementReason: 'Vente',
  auditPrefix: 'SALE',
  snapshotCost: true, // coût d'achat figé par ligne (bénéfice historique exact)
});

module.exports = sales;
