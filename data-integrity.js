(() => {
  const summary = /saldo anterior|pagamento(?:\s+|-)de\s+fatura|subtotal|total da fatura|valor total|total a pagar|encargos do periodo/i;
  const isSummary = (row) => summary.test(String(row?.original_description || row?.description || row?.normalized_description || ''));
  const db = window.clarezaDb;
  if (!db || db.__integrityFilter) return;
  window.clarezaDb = new Proxy(db, {
    get(target, property) {
      if (property === '__integrityFilter') return true;
      if (property === 'select') return async (table, query) => {
        const rows = await target.select(table, query);
        if (table !== 'import_rows') return rows;
        return rows.filter((row) => !isSummary(row));
      };
      if (property === 'insert') return (table, rows) => {
        if (table === 'import_rows') rows = rows.filter((row) => !isSummary(row));
        return target.insert(table, rows);
      };
      return target[property];
    }
  });
})();
