import { createCustomer, listCustomers, updateCustomer } from '../api/catalog';
import { makeTierPage } from '../components/TierPage';

const CustomersPage = makeTierPage({
  title: 'Clients',
  subtitle: 'Tiers de votre entreprise',
  createLabel: '+ Nouveau client',
  api: { list: listCustomers, create: createCustomer, update: updateCustomer },
  managePerm: 'customers.manage',
});

export default CustomersPage;
