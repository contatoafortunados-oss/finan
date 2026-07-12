(() => {
  const config = window.CLAREZA_SUPABASE || {};
  const sessionKey = 'clareza_supabase_session';
  const session = () => { try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; } };
  const refreshSession = async () => {
    const current = session(), refreshToken = current?.refresh_token;
    if (!refreshToken) return false;
    const response = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: refreshToken }) });
    const next = await response.json().catch(() => ({}));
    if (!response.ok || !next.access_token) return false;
    sessionStorage.setItem(sessionKey, JSON.stringify(next)); return true;
  };
  const request = async (table, options = {}, retried = false) => {
    const token = session()?.access_token;
    if (!token) throw new Error('Sessão expirada. Entre novamente.');
    const headers = { apikey: config.publishableKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=representation' };
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(`${config.url}/rest/v1/${table}${options.query || ''}`, { method: options.method || 'GET', headers, body: options.body ? JSON.stringify(options.body) : undefined, signal: controller.signal });
    } catch (caught) {
      if (caught?.name === 'AbortError') throw new Error('O Supabase demorou para carregar os dados. Tente novamente.');
      throw caught;
    } finally { clearTimeout(timeout); }
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && !retried && await refreshSession()) return request(table, options, true);
    if (!response.ok) throw new Error(response.status === 401 ? 'Sessão expirada. Entre novamente.' : body.message || body.hint || 'Não foi possível acessar os dados.');
    return body;
  };
  window.clarezaDb = Object.freeze({ select: (table, query = '') => request(table, { query }), insert: (table, rows) => request(table, { method: 'POST', body: rows }), update: (table, query, values) => request(table, { method: 'PATCH', query, body: values }), remove: (table, query) => request(table, { method: 'DELETE', query, prefer: 'return=minimal' }) });
})();
