import { createCustomer, listCustomers, updateCustomer } from '../api/catalog';
import { makeTierPage } from '../components/TierPage';

const CustomersPage = makeTierPage({
  title: 'Clients',
  subtitle: 'Entreprises et particuliers que vous facturez',
  singular: 'client',
  createLabel: '+ Nouveau client',
  emptyTitle: 'Aucun client',
  emptyMessage: 'Ajoutez votre premier client pour le retrouver ici.',
  api: { list: listCustomers, create: createCustomer, update: updateCustomer },
  managePerm: 'customers.manage',
});

export default CustomersPage;
