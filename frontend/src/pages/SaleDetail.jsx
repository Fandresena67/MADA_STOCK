import { getSale, updateSale, confirmSale } from '../api/catalog';
import { makeDocDetail } from '../components/DocDetail';

const SaleDetail = makeDocDetail({
  singular: 'Vente',
  tierLabel: 'Client',
  basePath: '/app/sales',
  confirmText: 'Confirmer cette vente ? Cette action retirera les quantités du stock.',
  perms: { confirm: 'sales.confirm', update: 'sales.update' },
  api: { get: getSale, update: updateSale, confirm: confirmSale },
});

export default SaleDetail;
