import { listSales, getSale, createSale, updateSale, confirmSale, listCustomers, listProducts } from '../api/catalog';
import { makeDocPage } from '../components/DocPage';

const SalesPage = makeDocPage({
  title: 'Ventes',
  subtitle: 'Brouillons puis ventes confirmées (sorties de stock)',
  singular: 'vente',
  createLabel: '+ Nouvelle vente',
  createTitle: 'Nouvelle vente (brouillon)',
  tierLabel: 'Client',
  tierKey: 'customer_id',
  basePath: '/app/sales',
  priceKey: 'sale_price',
  stockHint: true,
  perms: { create: 'sales.create' },
  api: {
    list: listSales, get: getSale, create: createSale, update: updateSale, confirm: confirmSale,
    listTiers: listCustomers, listProducts,
  },
});

export default SalesPage;
