const service = require('./reports.service');

function sendMaybeCSV(res, result, columns, baseName) {
  if (result.__csv) {
    const csv = service.toCSV(columns, result.data);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
    return res.send('﻿' + csv);
  }
  return res.json(result);
}

async function stock(req, res, next) {
  try {
    const result = await service.stockReport(req.authUser.companyId, req.query);
    result.__csv = req.query.format === 'csv';
    sendMaybeCSV(res, result, service.CSV_COLUMNS.stock, 'rapport-stock');
  } catch (err) {
    next(err);
  }
}

async function stockouts(req, res, next) {
  try {
    const result = await service.stockoutsReport(req.authUser.companyId, req.query);
    result.__csv = req.query.format === 'csv';
    sendMaybeCSV(res, result, service.CSV_COLUMNS.stockouts, 'rapport-ruptures');
  } catch (err) {
    next(err);
  }
}

async function sales(req, res, next) {
  try {
    const result = await service.salesReport(req.authUser.companyId, req.query);
    result.__csv = req.query.format === 'csv';
    sendMaybeCSV(res, result, service.CSV_COLUMNS.sales, 'rapport-ventes');
  } catch (err) {
    next(err);
  }
}

async function purchases(req, res, next) {
  try {
    const result = await service.purchasesReport(req.authUser.companyId, req.query);
    result.__csv = req.query.format === 'csv';
    sendMaybeCSV(res, result, service.CSV_COLUMNS.purchases, 'rapport-achats');
  } catch (err) {
    next(err);
  }
}

async function profit(req, res, next) {
  try {
    res.json({ data: await service.profitReport(req.authUser.companyId, req.query) });
  } catch (err) {
    next(err);
  }
}

async function movements(req, res, next) {
  try {
    const result = await service.movementsReport(req.authUser.companyId, req.query);
    result.__csv = req.query.format === 'csv';
    sendMaybeCSV(res, result, service.CSV_COLUMNS.movements, 'rapport-mouvements');
  } catch (err) {
    next(err);
  }
}

module.exports = { stock, stockouts, sales, purchases, profit, movements };
