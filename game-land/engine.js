/**
 * GAMELAND ENGINE v5 — Supabase Realtime Database
 * Cross-device · All browsers · Free forever
 */
(function(){
  const SUPA_URL="https://bifqrvnzhmhovaabzuqe.supabase.co";
  const SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpZnFydm56aG1ob3ZhYWJ6dXFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNjI0NjEsImV4cCI6MjA4ODYzODQ2MX0.taBvDReaBRVDUwZ04Bw-xzNfGrNiQ6uLzemEAqywWdg";

  // ── Player ID (persists per browser) ──
  let _myId=localStorage.getItem('gl5_pid');
  if(!_myId){
    _myId='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
    localStorage.setItem('gl5_pid',_myId);
  }

  let _cache={};       // local cache of all rooms
  const _cbs={};       // render callbacks
  let _channel=null;   // realtime channel

  // ── Load Supabase SDK ──
  async function loadSDK(){
    if(window.supabase)return;
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload=res;s.onerror=rej;
      document.head.appendChild(s);
    });
  }

  let _db=null;

  async function init(){
    await loadSDK();
    _db=window.supabase.createClient(SUPA_URL,SUPA_KEY);

    // Load all rooms into cache
    const {data}=await _db.from('rooms').select('id,data');
    if(data)data.forEach(r=>{_cache[r.id]=r.data;});
    _fire(_cache);

    // Subscribe to realtime changes
    _channel=_db.channel('rooms-changes')
      .on('postgres_changes',{event:'*',schema:'public',table:'rooms'},payload=>{
        if(payload.eventType==='DELETE'){
          delete _cache[payload.old.id];
        }else{
          _cache[payload.new.id]=payload.new.data;
        }
        _fire(_cache);
      })
      .subscribe();

    console.log('🟢 Supabase connected!');
  }

  function _fire(data){
    Object.values(_cbs).forEach(cb=>{try{cb(data)}catch(e){}});
  }

  // Start
  init().catch(e=>console.error('Supabase init failed:',e));

  // ── Helpers ──
  async function _upsert(id,data){
    if(!_db)return;
    _cache[id]=data;
    _fire(_cache);
    await _db.from('rooms').upsert({id,data,updated_at:new Date().toISOString()});
  }

  async function _remove(id){
    if(!_db)return;
    delete _cache[id];
    _fire(_cache);
    await _db.from('rooms').delete().eq('id',id);
  }

  // ── Public API (same as before — drop-in replacement) ──
  window.GE={
    get myId(){return _myId},
    getNick(){return localStorage.getItem('gl5_nick')||''},
    setNick(n){localStorage.setItem('gl5_nick',n.trim())},

    all(){return {..._cache}},
    get(id){return _cache[id]||null},

    create(id,data){_upsert(id,data);},
    set(id,data){_upsert(id,data);},

    patch(id,fn){
      const cur=_cache[id];
      if(!cur)return;
      const copy=JSON.parse(JSON.stringify(cur));
      fn(copy);
      _upsert(id,copy);
    },

    del(id){_remove(id);},

    chat(id,msg){
      const r=_cache[id];
      if(!r)return;
      const copy=JSON.parse(JSON.stringify(r));
      copy.chat=(copy.chat||[]).slice(-100);
      copy.chat.push({...msg,ts:Date.now()});
      _upsert(id,copy);
    },

    on(key,cb){_cbs[key]=cb},
    off(key){delete _cbs[key]},

    shuffle(arr){
      const a=[...arr];
      for(let i=a.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [a[i],a[j]]=[a[j],a[i]];
      }
      return a;
    },

    gc(){
      const now=Date.now();
      Object.entries(_cache).forEach(([k,r])=>{
        if(now-(r.createdAt||0)>14400000) _remove(k);
      });
    },

    ready(){
      return new Promise(res=>{
        if(_db){res();return;}
        const t=setInterval(()=>{if(_db){clearInterval(t);res();}},100);
      });
    }
  };

  GE.gc();
  window.clone=o=>JSON.parse(JSON.stringify(o));
})();