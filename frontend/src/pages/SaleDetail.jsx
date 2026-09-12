import { getSale, updateSale, confirmSale, listInvoices } from '../api/catalog';
import { makeDocDetail } from '../components/DocDetail';

const SaleDetail = makeDocDetail({
  singular: 'Vente',
  tierLabel: 'Client',
  basePath: '/app/sales',
  confirmText: 'Confirmer cette vente ? Cette action retirera les quantités du stock.',
  perms: { confirm: 'sales.confirm', update: 'sales.update' },
  api: { get: getSale, update: updateSale, confirm: confirmSale },
  linkedInvoice: {
    basePath: '/app/invoices',
    list: (saleId) => listInvoices({ sale_id: saleId, limit: 1 }).then((r) => r.data),
  },
});

export default SaleDetail;
