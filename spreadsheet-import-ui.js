(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const render = () => {
    if (window.financeState?.view !== 'import') return;
    const content = document.getElementById('content'), pdfInput = content?.querySelector('#invoice-files');
    if (!content || !pdfInput || content.querySelector('#spreadsheet-file')) return;
    const pdfLabel = pdfInput.closest('label'), label = document.createElement('label');
    label.className = 'secondary import-picker';
    label.innerHTML = 'Subir planilha<input id="spreadsheet-file" type="file" accept=".xlsx,.xls,.csv,.tsv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />';
    (pdfLabel?.parentElement || content.querySelector('.section-title')).appendChild(label);
    const mount = () => {
      content.querySelector('#spreadsheet-preview')?.remove();
      const data = window.ClarezaSpreadsheet?.read(); if (!data?.rows?.length) return;
      const total = data.rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), card = document.createElement('section');
      card.id = 'spreadsheet-preview'; card.className = 'card spreadsheet-preview';
      card.innerHTML = `<div class="section-title"><div><h3>Planilha em revisão</h3><p class="muted">${esc(data.fileName)} · aba ${esc(data.sheetName)} · ${data.rows.length} linhas · rascunho, ainda não contabilizado.</p></div><span class="pill pending">Conferência necessária</span></div><div class="reconciliation"><span>Banco: <b>${esc(data.bank || 'Revisão necessária')}</b></span><span>Mês: <b>${esc(data.referenceMonth || 'Revisão necessária')}</b></span><span>Cartão: <b>${esc(data.card || 'Não identificado')}</b></span><span>Total lido: <b>${money(total)}</b></span><span>Sem categoria: <b>${data.rows.filter((row) => !row.category).length}</b></span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>DATA</th><th>ESTABELECIMENTO</th><th>DESCRIÇÃO</th><th>MÊS</th><th>CATEGORIA</th><th>VALOR</th></tr></thead><tbody>${data.rows.slice(0, 100).map((row) => `<tr><td>${esc(row.date || 'Revisar')}</td><td>${esc(row.merchant || row.normalized || 'Revisar')}</td><td><strong>${esc(row.original || 'Sem descrição')}</strong></td><td>${esc(row.referenceMonth || data.referenceMonth || 'Revisar')}</td><td>${esc(row.category || 'Pendente')}</td><td>${money(row.amount)}</td></tr>`).join('')}</tbody></table></div>${data.rows.length > 100 ? '<p class="muted">Exibidas as primeiras 100 linhas. O arquivo completo permanece no rascunho.</p>' : ''}<div class="review-actions"><button type="button" id="remove-spreadsheet" class="secondary">Remover rascunho</button><button type="button" id="confirm-spreadsheet" class="primary">Confirmar após revisar</button></div><p class="muted" id="spreadsheet-message" role="status"></p>`;
      (content.querySelector('.duplicate-alert') || content.querySelector('.invoice-tabs'))?.before(card);
      card.querySelector('#remove-spreadsheet').onclick = () => { localStorage.removeItem(window.ClarezaSpreadsheet.KEY); mount(); };
      card.querySelector('#confirm-spreadsheet').onclick = () => { card.querySelector('#spreadsheet-message').textContent = 'Prévia registrada. A gravação definitiva continua bloqueada até a conferência das linhas.'; };
    };
    label.querySelector('input').onchange = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { localStorage.setItem(window.ClarezaSpreadsheet.KEY, JSON.stringify(await window.ClarezaSpreadsheet.parse(file))); mount(); } catch (error) { alert(error.message || 'Não foi possível ler a planilha.'); } };
    mount();
  };
  const content = document.getElementById('content'); if (!content) return;
  new MutationObserver(render).observe(content, { childList: true, subtree: true }); render();
})();
