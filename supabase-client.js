(() => {
  const config = window.CLAREZA_SUPABASE || {};
  const sessionKey = 'clareza_supabase_session';
  const session = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } };
  const request = async (table, options = {}) => {
    const token = session()?.access_token; if (!token) throw new Error('Sessão expirada. Entre novamente.');
    const headers = { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' };
    const response = await fetch(`${config.url}/rest/v1/${table}${options.query || ''}`, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined });
    const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.message || body.hint || 'Não foi possível acessar os dados.'); return body;
  };
  window.clarezaDb = Object.freeze({ select: (table, query = '') => request(table, { query }), insert: (table, rows) => request(table, { method: 'POST', body: rows }), update: (table, query, values) => request(table, { method: 'PATCH', query, body: values }), remove: (table, query) => request(table, { method: 'DELETE', query, prefer: 'return=minimal' }) });
})();
