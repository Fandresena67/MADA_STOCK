const { makeTierService } = require('./tier.service');

const suppliers = makeTierService('suppliers', 'SUPPLIER');
const customers = makeTierService('customers', 'CUSTOMER');

module.exports = { suppliers, customers };
