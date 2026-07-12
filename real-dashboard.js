(() => {
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const hasSession = () => { try { return Boolean(JSON.parse(sessionStorage.getItem('clareza_supabase_session') || 'null')?.access_token); } catch { return false; } };
  let loading = false;
  const query = async (table) => window.clarezaDb?.select(table, '?select=*') || [];
  const renderReal = async () => {
    if (loading || !hasSession() || window.financeState?.view !== 'dashboard' || !window.clarezaDb) return;
    const content = document.getElementById('content'); if (!content || content.dataset.realDashboard === 'true') return;
    loading = true; content.dataset.realDashboard = 'true';
    try {
      const [officialTransactions, receivables, invoices, predictions, importedRows] = await Promise.all([query('transactions'), query('receivables'), query('invoices'), query('future_expense_predictions'), query('import_rows')]);
      const importedTransactions = importedRows.filter((item) => item.review_status === 'approved').map((item) => ({ ...item, id: `import-${item.id}`, description: item.normalized_description || item.original_description || 'Lançamento importado', type: item.type === 'income' ? 'income' : 'expense', source: 'import' }));
      const transactions = [...officialTransactions, ...importedTransactions];
      const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const expenses = transactions.filter((item) => item.type !== 'income').reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const received = receivables.reduce((sum, item) => sum + Number(item.received_amount || 0), 0);
      const future = [...receivables, ...predictions].reduce((sum, item) => sum + Number(item.expected_amount || item.estimated_amount || 0), 0) - received;
      const recent = transactions.slice(-8).reverse();
      content.innerHTML = `<div class="welcome"><div><h2>Visão real da sua conta</h2><p class="muted">Dados oficiais e linhas de importação aprovadas no Supabase. Rascunhos não entram nestes totais.</p></div><span class="pill">${officialTransactions.length} oficiais · ${importedTransactions.length} importados</span></div><div class="metrics">${metric('SALDO REAL', money(income - expenses), 'Receitas menos despesas', income >= expenses ? 'up' : 'down')}${metric('RECEITAS', money(income), `${transactions.filter((item) => item.type === 'income').length} lançamentos`, 'up')}${metric('DESPESAS', money(expenses), `${transactions.filter((item) => item.type !== 'income').length} lançamentos`, 'down')}${metric('FUTURO', money(future), `${invoices.length} faturas oficiais`, '')}</div><div class="bottom-grid"><div class="card"><div class="card-head"><h3>Faturas oficiais</h3><span class="pill">${invoices.length}</span></div>${invoices.length ? invoices.slice(0, 6).map((item) => `<div class="category-row"><span>${escapeHtml(item.reference_month || 'Fatura')}</span><div class="bar"><i style="width:100%"></i></div><strong>${money(item.total_amount)}</strong></div>`).join('') : '<p class="empty-note">Nenhuma fatura oficial aprovada ainda. Os lançamentos importados já estão refletidos nos totais.</p>'}</div><div class="card"><div class="card-head"><h3>Últimos lançamentos</h3><button class="card-link" data-view="transactions">Ver todos →</button></div>${recent.length ? recent.map((item) => `<div class="category-row"><span>${escapeHtml(item.description)}</span><div class="bar"><i style="width:35%"></i></div><strong>${money(item.amount)}</strong></div>`).join('') : '<p class="empty-note">Nenhum lançamento foi gravado.</p>'}</div></div>`;
    } catch (error) {
      content.innerHTML = `<div class="card"><h2>Não foi possível carregar os dados reais</h2><p class="muted">${escapeHtml(error.message)}</p></div>`;
    } finally { loading = false; }
  };
  const observer = new MutationObserver(() => { const content = document.getElementById('content'); if (content?.dataset.realDashboard === 'true' && window.financeState?.view !== 'dashboard') delete content.dataset.realDashboard; renderReal(); });
  observer.observe(document.getElementById('content'), { childList: true, subtree: true }); window.addEventListener('clareza:authenticated', renderReal); renderReal();
})();
