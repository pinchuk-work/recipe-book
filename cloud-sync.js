/* Supabase REST transport. Per-item optimistic revisions; durable offline queue. */
(() => {
  'use strict';
  const GROUPS=['overrides','favorites','basket','checked','photos'];
  const clone=v=>JSON.parse(JSON.stringify(v));
  const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  window.createRecipeCloud=({config,apply,status,storage=localStorage,fetcher=fetch})=>{
    const enabled=!!(config?.url&&config?.publishableKey);
    const root=(config?.url||'').replace(/\/$/,'');
    const prefix='k-stolu.cloud.v1.'+root;
    let session=null,book=null,rows={},pending={},conflicts={},baseline={},locks={},timer=null,working=false,refreshing=null,polling=false,stopped=false;
    const read=(key,fallback)=>{try{return JSON.parse(storage.getItem(prefix+key))||fallback;}catch{return fallback;}};
    const write=(key,value)=>storage.setItem(prefix+key,JSON.stringify(value));
    const id=(group,key)=>JSON.stringify([group,key]);
    const queueKey=()=>'.queue.'+session.user.id+'.'+book.id;
    const notify=(message='')=>status({enabled,authenticated:!!book,user:session?.user?.email||'',pending:Object.keys(pending).length,conflicts:Object.entries(conflicts).map(([id,c])=>({id,...c})),message});
    const persist=()=>{if(book)write(queueKey(),{pending,conflicts,rows});};
    async function request(path,{method='GET',body,token=true}={}){
      if(token&&session&&session.expires_at*1000<Date.now()+60000)await refresh();
      const response=await fetcher(root+path,{method,headers:{apikey:config.publishableKey,'Content-Type':'application/json',...(token&&session?{Authorization:'Bearer '+session.access_token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
      let data;try{data=await response.json();}catch{data=null;}
      if(!response.ok)throw Object.assign(new Error(data?.msg||data?.message||data?.error_description||'Ошибка соединения ('+response.status+')'),{status:response.status});
      return data;
    }
    function setSession(value){session={...value,expires_at:value.expires_at||Math.floor(Date.now()/1000)+(value.expires_in||3600)};write('.session',session);}
    async function refresh(){
      if(!refreshing)refreshing=request('/auth/v1/token?grant_type=refresh_token',{method:'POST',token:false,body:{refresh_token:session.refresh_token}}).then(setSession).finally(()=>{refreshing=null;});
      return refreshing;
    }
    function compose(){
      const result=Object.fromEntries(GROUPS.map(g=>[g,{}]));
      for(const row of Object.values(rows)){if(row.value!==null&&GROUPS.includes(row.kind))result[row.kind][row.item_key]=clone(row.value);}
      for(const p of Object.values(pending)){if(p.value===null)delete result[p.kind][p.item_key];else result[p.kind][p.item_key]=clone(p.value);}
      return result;
    }
    function publish(force=false){const value=compose();if(force||!equal(value,baseline)){baseline=clone(value);apply(value);}}
    async function pull(){
      if(!book||polling||working||stopped)return;polling=true;
      try{const remote=await request('/rest/v1/recipe_book_entries?book_id=eq.'+book.id+'&select=kind,item_key,value,revision');for(const row of remote)rows[id(row.kind,row.item_key)]=row;persist();publish();notify();}
      finally{polling=false;}
    }
    async function flush(){
      if(!book||working||polling||stopped)return;working=true;
      try{
        for(const key of Object.keys(pending)){
          if(conflicts[key])continue;
          const sent=clone(pending[key]);
          const answer=await request('/rest/v1/rpc/put_recipe_book_entry',{method:'POST',body:{p_book:book.id,p_kind:sent.kind,p_key:sent.item_key,p_value:sent.value,p_expected:sent.expected}});
          rows[key]=answer.entry;
          if(answer.conflict){conflicts[key]={kind:sent.kind,item_key:sent.item_key,local:pending[key].value,remote:answer.entry};persist();notify('Есть одновременные правки — выберите версию в настройках.');continue;}
          if(equal(pending[key]?.value,sent.value))delete pending[key];else if(pending[key])pending[key].expected=answer.entry.revision;
          persist();notify();
        }
        publish();
      }catch(error){notify(error.status===401?'Войдите снова, локальные изменения сохранены.':error.status&&error.status<500?'База отклонила правку: '+error.message:'Нет связи с базой. Правки в очереди, повторим автоматически.');}
      finally{working=false;}
    }
    function capture(value){
      if(!book)return;
      for(const group of GROUPS)for(const key of new Set([...Object.keys(baseline[group]||{}),...Object.keys(value[group]||{})])){
        const before=baseline[group]?.[key]??null,after=value[group]?.[key]??null;
        if(equal(before,after))continue;
        const record=id(group,key);
        pending[record]={kind:group,item_key:key,value:clone(after),expected:pending[record]?.expected??locks[record]??rows[record]?.revision??0};
        delete locks[record];
        if(conflicts[record])conflicts[record].local=clone(after);
      }
      baseline=clone(value);persist();notify();void flush();
    }
    async function connect(){
      const identity=session.user.id;
      book=await request('/rest/v1/rpc/my_recipe_book',{method:'POST',body:{}});
      if(!book?.id)throw new Error('Этот аккаунт пока не добавлен в общую книгу.');
      if(identity!==session.user.id)throw new Error('Сессия изменилась');
      write('.book.'+identity,book);
      const saved=read(queueKey(),{});pending=saved.pending||{};conflicts=saved.conflicts||{};rows=saved.rows||{};
      publish(true);await pull();
      if(timer)clearInterval(timer);
      timer=setInterval(()=>{void flush();void pull().catch(()=>notify('Нет связи с базой. Правки сохраняются на устройстве.'));},10000);
      void flush();notify();
    }
    async function login(email,password){
      stopped=false;const result=await request('/auth/v1/token?grant_type=password',{method:'POST',token:false,body:{email,password}});setSession(result);
      try{await connect();}catch(e){book=null;notify(e.message);throw e;}
    }
    async function logout(){
      if(Object.keys(pending).length)throw new Error('Сначала дождитесь отправки правок или сохраните резервную копию.');
      stopped=true;clearInterval(timer);timer=null;
      try{if(session)await request('/auth/v1/logout',{method:'POST'});}finally{storage.removeItem(prefix+'.session');session=null;book=null;rows={};pending={};conflicts={};notify();}
    }
    function resolve(key,useLocal){
      const conflict=conflicts[key];if(!conflict)return;
      rows[key]=conflict.remote;
      if(useLocal)pending[key].expected=conflict.remote.revision;else delete pending[key];
      delete conflicts[key];persist();publish();notify();void flush();
    }
    async function start(){
      if(!enabled){notify();return;}
      stopped=false;session=read('.session',null);
      if(session){book=read('.book.'+session.user.id,null);if(book){const cached=read(queueKey(),{});pending=cached.pending||{};conflicts=cached.conflicts||{};rows=cached.rows||{};publish(true);}
        try{await connect();}catch(e){if(e.status===401||e.status===403)book=null;notify(e.message);}
        if(!timer)timer=setInterval(()=>{if(!book){void connect().catch(()=>{});}else{void flush();void pull().catch(()=>notify('Нет связи с базой. Правки сохраняются на устройстве.'));}},10000);
      }else notify();
    }
    function importLocal(value){const combined=compose();for(const group of GROUPS)Object.assign(combined[group],value[group]||{});capture(combined);publish(true);}
    window.addEventListener('online',()=>{void flush();void pull().catch(()=>{});});
    window.addEventListener('focus',()=>{void flush();void pull().catch(()=>{});});
    return {enabled,start,login,logout,capture,resolve,importLocal,pull,flush,edit(kind,key){const record=id(kind,key);locks[record]=rows[record]?.revision??0;},endEdit(){locks={};},get connected(){return !!book;},get snapshot(){return compose();},stop(){stopped=true;clearInterval(timer);}};
  };
})();
