/**
 * GAMELAND ENGINE v5 — Supabase Realtime Database
 * اتاق‌های فعال در دیتابیس واقعی ذخیره می‌شوند
 * هر دستگاه و مرورگری می‌تواند وارد بازی شود
 */
(function () {
  const SUPA_URL = "https://bifqrvnzhmhovaabzuqe.supabase.co";
  const SUPA_KEY = "sb_publishable_KJl7QZMi_aNnYoyx97jDrQ_wkmIueFr";

  // شناسه بازیکن — در هر مرورگر ثابت
  let _myId = localStorage.getItem('gl5_pid');
  if (!_myId) {
    _myId = 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    localStorage.setItem('gl5_pid', _myId);
  }

  let _db = null;
  let _cache = {};
  const _cbs = {};

  function loadSDK() {
    return new Promise((res, rej) => {
      if (window.supabase) { res(); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = res;
      s.onerror = () => rej(new Error('SDK load failed'));
      document.head.appendChild(s);
    });
  }

  async function init() {
    await loadSDK();
    _db = window.supabase.createClient(SUPA_URL, SUPA_KEY);

    // بارگذاری اولیه همه اتاق‌ها
    const { data, error } = await _db.from('rooms').select('id,data');
    if (error) {
      console.error('Supabase load:', error.message);
    } else if (data) {
      data.forEach(row => { _cache[row.id] = row.data; });
      _fire(_cache);
    }

    // اشتراک realtime
    _db.channel('rooms-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, p => {
        if (p.eventType === 'DELETE') {
          delete _cache[p.old.id];
        } else {
          _cache[p.new.id] = p.new.data;
        }
        _fire(_cache);
      })
      .subscribe(s => { if (s === 'SUBSCRIBED') console.log('🟢 Realtime OK'); });
  }

  function _fire(data) {
    Object.values(_cbs).forEach(cb => { try { cb(data); } catch (e) { } });
  }

  async function _upsert(id, data) {
    if (!_db) return;
    _cache[id] = data;
    _fire(_cache);
    const { error } = await _db.from('rooms').upsert({ id, data, updated_at: new Date().toISOString() });
    if (error) console.error('upsert:', error.message);
  }

  async function _remove(id) {
    if (!_db) return;
    delete _cache[id];
    _fire(_cache);
    const { error } = await _db.from('rooms').delete().eq('id', id);
    if (error) console.error('delete:', error.message);
  }

  init().catch(e => console.error('Init failed:', e));

  window.GE = {
    get myId() { return _myId; },
    getNick() { return localStorage.getItem('gl5_nick') || ''; },
    setNick(n) { localStorage.setItem('gl5_nick', n.trim()); },
    all() { return { ..._cache }; },
    get(id) { return _cache[id] || null; },
    create(id, data) { _upsert(id, data); },
    set(id, data) { _upsert(id, data); },
    patch(id, fn) {
      const cur = _cache[id];
      if (!cur) return;
      const copy = JSON.parse(JSON.stringify(cur));
      fn(copy);
      _upsert(id, copy);
    },
    del(id) { _remove(id); },
    chat(id, msg) {
      const r = _cache[id];
      if (!r) return;
      const copy = JSON.parse(JSON.stringify(r));
      copy.chat = (copy.chat || []).slice(-100);
      copy.chat.push({ ...msg, ts: Date.now() });
      _upsert(id, copy);
    },
    on(key, cb) { _cbs[key] = cb; },
    off(key) { delete _cbs[key]; },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    gc() {
      const now = Date.now();
      Object.entries(_cache).forEach(([k, r]) => {
        if (now - (r.createdAt || 0) > 14400000) _remove(k);
      });
    },
    ready() {
      return new Promise(res => {
        if (_db) { res(); return; }
        const t = setInterval(() => { if (_db) { clearInterval(t); res(); } }, 100);
      });
    }
  };

  GE.gc();
  window.clone = o => JSON.parse(JSON.stringify(o));
})();
