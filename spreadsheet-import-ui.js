(() => {
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const userId = () => { try { const token = JSON.parse(sessionStorage.getItem('clareza_supabase_session') || 'null')?.access_token; return token ? JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).sub : null; } catch { return null; } };
  const remoteType = (type) => ({ 'Crédito': 'credit', 'Estorno': 'refund', 'Juros': 'interest', 'Tarifa': 'fee', 'Parcela': 'expense', 'Compra': 'expense' }[type] || 'expense');
  const saveData = (data) => localStorage.setItem(window.ClarezaSpreadsheet.KEY, JSON.stringify(data));
  const confirmBatch = async (data, card) => {
    const message = card.querySelector('#spreadsheet-message'), button = card.querySelector('#confirm-spreadsheet');
    if (!window.clarezaDb) { message.textContent = 'Cliente Supabase indisponível.'; return; }
    const uid = userId(); if (!uid) { message.textContent = 'Sua sessão expirou. Entre novamente para enviar a planilha.'; return; }
    if (data.remoteBatchId) { message.textContent = 'Esta planilha já foi enviada ao Supabase neste rascunho.'; return; }
    button.disabled = true; button.textContent = 'Enviando...'; message.textContent = 'Enviando lote e linhas para o Supabase...';
    try {
      const batch = (await window.clarezaDb.insert('import_batches', [{ user_id: uid, status: 'approved', file_count: 1, row_count: data.rows.length, imported_count: data.rows.length }]))[0];
      const fileHash = `browser-${data.size}-${data.importedAt}`;
      const existingFiles = await window.clarezaDb.select('import_files', `?user_id=eq.${encodeURIComponent(uid)}&file_hash=eq.${encodeURIComponent(fileHash)}&limit=1`);
      if (!existingFiles.length) await window.clarezaDb.insert('import_files', [{ user_id: uid, import_batch_id: batch.id, filename: data.fileName, mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', file_hash: fileHash, file_size: data.size, parser_status: 'reviewed' }]);
      await window.clarezaDb.insert('import_rows', data.rows.map((row) => ({ user_id: uid, import_batch_id: batch.id, original_description: row.original || 'Sem descrição', normalized_description: row.normalized || row.original || null, merchant_name: row.merchant || row.original || null, transaction_date: row.date || null, amount: Number(row.amount) || 0, type: remoteType(row.type), installment_number: row.installmentNumber ? Number(row.installmentNumber) : null, installment_total: row.installmentTotal ? Number(row.installmentTotal) : null, review_status: 'approved', confidence: row.confidence || 'unclassified', note: row.note, raw_data: { source: 'spreadsheet', filename: data.fileName, bank: row.bank || data.bank, card: row.card || data.card, reference_month: row.referenceMonth || data.referenceMonth, source_date: row.sourceDate || row.date || null, category: row.category, subcategory: row.subcategory, source_row: row.sourceRow } })));
      data.remoteBatchId = batch.id; localStorage.setItem(window.ClarezaSpreadsheet.KEY, JSON.stringify(data));
      message.textContent = `Lote confirmado e enviado ao Supabase: ${data.rows.length} linhas. O vínculo financeiro definitivo ainda depende da conciliação das faturas.`;
    } catch (error) { message.textContent = error.message || 'Não foi possível enviar a planilha ao Supabase.'; button.disabled = false; button.textContent = 'Confirmar lote e enviar ao Supabase'; }
  };
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
      card.innerHTML = `<div class="section-title"><div><h3>Planilha em revisão</h3><p class="muted">${esc(data.fileName)} · aba ${esc(data.sheetName)} · ${data.rows.length} linhas · ${data.remoteBatchId ? 'enviada ao Supabase' : 'rascunho, ainda não contabilizado'}.</p></div><span class="pill ${data.remoteBatchId ? '' : 'pending'}">${data.remoteBatchId ? 'Enviada ao Supabase' : 'Conferência necessária'}</span></div><div class="reconciliation"><span>Banco: <b>${esc(data.bank || 'Revisão necessária')}</b></span><span>Mês: <b>${esc(data.referenceMonth || 'Revisão necessária')}</b></span><span>Cartão: <b>${esc(data.card || 'Não identificado')}</b></span><span>Total lido: <b>${money(total)}</b></span><span>Sem categoria: <b>${data.rows.filter((row) => !row.category).length}</b></span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>DATA</th><th>ESTABELECIMENTO</th><th>DESCRIÇÃO</th><th>MÊS</th><th>CATEGORIA</th><th>VALOR</th><th>AÇÃO</th></tr></thead><tbody>${data.rows.slice(0, 100).map((row, index) => `<tr data-sheet-row="${index}"><td>${esc(row.date || 'Revisar')}</td><td>${esc(row.merchant || row.normalized || 'Revisar')}</td><td><strong>${esc(row.original || 'Sem descrição')}</strong></td><td>${esc(row.referenceMonth || data.referenceMonth || 'Revisar')}</td><td>${esc(row.category || 'Pendente')}</td><td>${money(row.amount)}</td><td><button type="button" class="secondary sheet-edit" data-index="${index}">Editar</button></td></tr>`).join('')}</tbody></table></div>${data.rows.length > 100 ? '<p class="muted">Exibidas as primeiras 100 linhas. O arquivo completo permanece no rascunho.</p>' : ''}<div class="review-actions"><button type="button" id="remove-spreadsheet" class="secondary">Remover rascunho</button>${data.remoteBatchId ? '' : '<button type="button" id="confirm-spreadsheet" class="primary">Confirmar lote e enviar ao Supabase</button>'}</div><p class="muted" id="spreadsheet-message" role="status"></p>`;
      (content.querySelector('.duplicate-alert') || content.querySelector('.invoice-tabs'))?.before(card);
      card.querySelector('#remove-spreadsheet').onclick = () => { localStorage.removeItem(window.ClarezaSpreadsheet.KEY); mount(); };
      card.querySelector('#confirm-spreadsheet')?.addEventListener('click', () => confirmBatch(data, card));
      card.querySelectorAll('.sheet-edit').forEach((button) => button.addEventListener('click', () => {
        const index = Number(button.dataset.index), row = data.rows[index], tr = card.querySelector(`[data-sheet-row="${index}"]`);
        tr.innerHTML = `<td><input class="sheet-cell" data-field="date" value="${esc(row.date)}" type="text" placeholder="AAAA-MM-DD"></td><td><input class="sheet-cell" data-field="merchant" value="${esc(row.merchant)}"></td><td><input class="sheet-cell" data-field="original" value="${esc(row.original)}"></td><td><input class="sheet-cell" data-field="referenceMonth" value="${esc(row.referenceMonth || data.referenceMonth)}" placeholder="MM/AAAA"></td><td><input class="sheet-cell" data-field="category" value="${esc(row.category)}"></td><td><input class="sheet-cell" data-field="amount" value="${esc(row.amount)}" type="number" min="0" step="0.01"></td><td><button type="button" class="primary sheet-save">Salvar</button></td>`;
        tr.querySelector('.sheet-save').onclick = () => { tr.querySelectorAll('.sheet-cell').forEach((input) => { row[input.dataset.field] = input.dataset.field === 'amount' ? Number(input.value) : input.value.trim(); }); row.normalized = row.merchant; row.reviewStatus = 'Corrigido'; delete data.remoteBatchId; saveData(data); mount(); };
      }));
    };
    label.querySelector('input').onchange = async (event) => { const file = event.target.files?.[0]; if (!file) return; try { localStorage.setItem(window.ClarezaSpreadsheet.KEY, JSON.stringify(await window.ClarezaSpreadsheet.parse(file))); mount(); } catch (error) { alert(error.message || 'Não foi possível ler a planilha.'); } };
    mount();
  };
  const content = document.getElementById('content'); if (!content) return;
  new MutationObserver(render).observe(content, { childList: true, subtree: true }); render();
})();
