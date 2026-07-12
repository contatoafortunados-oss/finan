(() => {
  const KEY = 'clareza_spreadsheet_import_v1';
  const text = (value) => String(value ?? '').trim();
  const normalize = (value) => text(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const money = (value) => {
    if (typeof value === 'number') return value;
    const raw = text(value).replace(/R\$\s?/gi, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(raw.replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const date = (value) => {
    if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
    const raw = text(value), br = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
    return br ? `${br[3].length === 2 ? `20${br[3]}` : br[3]}-${br[2].padStart(2, '0')}-${br[1].padStart(2, '0')}` : raw;
  };
  const completeDate = (value, referenceMonth, fileName) => {
    const parsed = date(value); if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) return parsed;
    const partial = text(value).match(/^(\d{1,2})[\/-](\d{1,2})$/); if (!partial) return '';
    const year = text(referenceMonth).match(/(20\d{2})/)?.[1] || text(fileName).match(/(20\d{2})/)?.[1];
    return year ? `${year}-${partial[2].padStart(2, '0')}-${partial[1].padStart(2, '0')}` : '';
  };
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } };
  const metadata = (fileName, rows) => {
    const source = `${fileName} ${rows.map((row) => Object.values(row).join(' ')).slice(0, 5).join(' ')}`;
    const bank = /ita[uú]/i.test(source) ? 'Itaú' : /nubank/i.test(source) ? 'Nubank' : /picpay/i.test(source) ? 'PicPay' : '';
    const cardMatch = source.match(/(?:final|cart[aã]o|card)[^\d]{0,12}(\d{4})/i) || source.match(/(?:\.|\s)(\d{4})(?:\D|$)/);
    const refMatch = source.match(/(?:refer[eê]ncia|fatura|m[eê]s)[^\d]{0,12}(0?[1-9]|1[0-2])\s*[\/-]\s*(20\d{2})/i) || fileName.match(/(20\d{2})[^\d]?(0[1-9]|1[0-2])/);
    return { bank, card: cardMatch?.[1] || '', referenceMonth: refMatch ? `${String(refMatch[1]).padStart(2, '0')}/${refMatch[2]}` : '' };
  };
  const suggestCategory = (description) => {
    const value = normalize(description);
    if (/mercado|supermercado|restaurante|pizza|lanch|padaria|ifood|rappi|acai|churrasc|comida/.test(value)) return 'Alimentação';
    if (/uber|99|combust|posto|metro|estacion|pedagio|passagem/.test(value)) return 'Transporte';
    if (/farmacia|drogaria|hospital|clinica|consulta|academia|saude/.test(value)) return 'Saúde';
    if (/netflix|spotify|prime|stream|software|app|google|apple|telefone|internet/.test(value)) return 'Assinaturas e serviços';
    if (/roupa|calcado|loja|magazine|eletron|shopping|presente/.test(value)) return 'Compras';
    if (/curso|escola|faculdade|livro/.test(value)) return 'Educação';
    if (/cinema|bar|evento|viagem|hotel|loteria/.test(value)) return 'Lazer';
    return '';
  };
  const parse = async (file) => {
    if (!window.XLSX) throw new Error('Leitor de planilhas indisponível. Atualize a página e tente novamente.');
    const book = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
    const sheets = book.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(book.Sheets[name], { defval: '', raw: true }) })).filter((sheet) => sheet.rows.length);
    const primary = sheets.find((sheet) => sheet.name.toLowerCase().includes('lanc')) || sheets.find((sheet) => sheet.rows.some((row) => Object.keys(row).some((key) => ['data', 'valor', 'descricao', 'descricaooriginal'].includes(normalize(key))))) || sheets[0];
    const rows = (primary?.rows || []).map((row, index) => {
      const entries = Object.entries(row), get = (...names) => { const found = entries.find(([key]) => names.includes(normalize(key))); return found ? found[1] : ''; };
      const typeRaw = normalize(get('tipo', 'natureza', 'movimento'));
      const type = typeRaw.includes('credito') || typeRaw.includes('receita') ? 'Crédito' : typeRaw.includes('estorno') ? 'Estorno' : typeRaw.includes('parcela') ? 'Parcela' : 'Compra';
      const original = text(get('descricaooriginal', 'descricao', 'historico', 'description'));
      const merchant = text(get('estabelecimento', 'merchant', 'descricaonormalizada', 'normalized')) || original;
      const suggested = suggestCategory(original);
      return { id: crypto.randomUUID(), sourceRow: index + 2, date: date(get('data', 'datadacompra', 'transactiondate')), original, normalized: merchant, merchant, amount: Math.abs(money(get('valor', 'amount', 'preco'))), type, category: text(get('categoria', 'category')) || suggested, subcategory: text(get('subcategoria', 'subcategory')), note: `Importado da planilha ${file.name}, aba ${primary?.name || 'desconhecida'}, linha ${index + 2}.`, confidence: suggested ? 'Média' : 'Não classificado', reviewStatus: 'Pendente' };
    }).filter((row) => row.original || row.amount);
    const meta = metadata(file.name, primary?.rows || []);
    return { fileName: file.name, size: file.size, importedAt: new Date().toISOString(), ...meta, sheets: sheets.map((sheet) => ({ name: sheet.name, count: sheet.rows.length })), sheetName: primary?.name || '', rows: rows.map((row) => ({ ...row, sourceDate: row.date, date: completeDate(row.date, meta.referenceMonth, file.name), bank: meta.bank, card: meta.card, referenceMonth: meta.referenceMonth, note: row.date && !completeDate(row.date, meta.referenceMonth, file.name) ? `${row.note} Data incompleta: ano pendente.` : row.note })) };
  };
  window.ClarezaSpreadsheet = { KEY, read, parse };
})();
