/**
 * GAMELAND ENGINE v4 - BroadcastChannel + localStorage
 */
(function(){
  const STORE='gl4_rooms';
  const ch=new BroadcastChannel('gl4');
  let _myId=localStorage.getItem('gl4_pid');
  if(!_myId){_myId='p'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);localStorage.setItem('gl4_pid',_myId);}
  const _cbs={};
  function _read(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch{return{}}}
  function _write(data){localStorage.setItem(STORE,JSON.stringify(data));ch.postMessage(1);_fire(data);}
  function _fire(data){Object.values(_cbs).forEach(cb=>{try{cb(data)}catch(e){}});}
  ch.onmessage=()=>_fire(_read());
  setInterval(()=>_fire(_read()),900);
  window.GE={
    get myId(){return _myId},
    getNick(){return localStorage.getItem('gl4_nick')||''},
    setNick(n){localStorage.setItem('gl4_nick',n.trim())},
    all(){return _read()},
    get(id){return _read()[id]||null},
    create(id,data){const r=_read();r[id]=data;_write(r)},
    set(id,data){const r=_read();r[id]=data;_write(r)},
    patch(id,fn){const r=_read();if(r[id]){fn(r[id]);_write(r)}},
    del(id){const r=_read();delete r[id];_write(r)},
    chat(id,msg){const r=_read();if(!r[id])return;r[id].chat=(r[id].chat||[]).slice(-100);r[id].chat.push({...msg,ts:Date.now()});_write(r)},
    on(key,cb){_cbs[key]=cb},
    off(key){delete _cbs[key]},
    shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;},
    gc(){const r=_read();const now=Date.now();let d=false;Object.keys(r).forEach(k=>{if(now-(r[k].createdAt||0)>14400000){delete r[k];d=true;}});if(d)_write(r);}
  };
  GE.gc();
  window.clone=o=>JSON.parse(JSON.stringify(o));
})();
