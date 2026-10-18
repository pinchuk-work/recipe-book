/* Buildless, relative URLs: works on /recipes/ in GitHub Pages and locally. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const icons = {
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    filter:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="2.5" fill="currentColor"/><circle cx="15" cy="17" r="2.5" fill="currentColor"/>',
    heart:'<path d="M20.5 5.8a5 5 0 0 0-7 0L12 7.3l-1.5-1.5a5 5 0 0 0-7 7L12 21l8.5-8.2a5 5 0 0 0 0-7Z"/>',
    bag:'<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
    settings:'<path d="M4 6h16M4 12h16M4 18h16"/><circle cx="8" cy="6" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="18" r="2" fill="currentColor"/>',
    arrow:'<path d="M7 17 17 7M7 7h10v10"/>',
    back:'<path d="m10 6-6 6 6 6M4 12h16"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    edit:'<path d="m14 4 6 6M3 21l5-1L21 7l-5-5L3 15v6Z"/>',
    leaf:'<path d="M4 20c8 0 17-5 16-17C8 2 2 9 4 20Zm0 0 10-10"/>',
    table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 9v11"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4"/>',
    print:'<path d="M6 8V3h12v5M6 17H3V9h18v8h-3M6 14h12v7H6z"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='k-stolu.preferences.v1';
  let prefs;
  try { prefs=JSON.parse(localStorage.getItem(KEY)) || {}; } catch { prefs={}; }
  for (const k of ['overrides','favorites','basket','checked','photos']) if (!prefs[k] || typeof prefs[k]!=='object' || Array.isArray(prefs[k])) prefs[k]={};
  let state={query:'',category:'Все рецепты',tags:[],onlyFavorites:false,showTags:false,view:prefs.view==='grid'?'grid':'table',sort:'default'};
  const base=window.RECIPES || [];
  const app=$('#app'), dialog=$('#dialog');
  const categories=['Все рецепты','Завтрак','Обед','Ужин','Выпечка','Десерт','Напитки'];
  function save(){ try { localStorage.setItem(KEY,JSON.stringify(prefs));return true; } catch {toast('Не удалось сохранить: память браузера заполнена.');return false;} }
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200);}
  function recipe(id){const r=base.find(r=>r.id===id);return r?{...r,...prefs.overrides[id],photo:prefs.photos[id] || r.photo}:null;}
  function all(){return base.map(r=>recipe(r.id));}
  function image(r, cls=''){return r.photo?`<img ${cls?`class="${cls}"`:''} src="${esc(r.photo)}" alt="${esc(r.title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'photo-empty',textContent:'Нет фото'}))">`:`<span class="photo-empty">${icon('leaf')}<span class="sr-only">Фото ещё не добавлено</span></span>`;}
  function categoryBadges(r){return r.categories.map(c=>`<span class="badge category-${esc(c.toLowerCase())}">${esc(c)}</span>`).join('');}
  function tagBadges(r){return r.tags.map(t=>`<span class="badge tag">${esc(t)}</span>`).join('');}
  function source(r){return `<a class="source-link" href="${esc(r.source)}" target="_blank" rel="noopener noreferrer">${r.source.includes('/wall')?'Запись VK':'VK Клипы'} ${icon('arrow')}</a>`;}
  function favorite(r){return `<button class="favorite icon-button ${prefs.favorites[r.id]?'active':''}" data-favorite="${r.id}" aria-label="${prefs.favorites[r.id]?'Убрать из избранного':'В избранное'}: ${esc(r.title)}" aria-pressed="${!!prefs.favorites[r.id]}">${icon('heart')}</button>`;}
  function header(){ $('#shopping-nav').innerHTML=icon('bag')+(Object.keys(prefs.basket).filter(k=>prefs.basket[k]).length?`<span class="nav-count">${Object.keys(prefs.basket).filter(k=>prefs.basket[k]).length}</span>`:'');$('#settings-nav').innerHTML=icon('settings'); }
  function filtered(){
    const q=state.query.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
    let rs=all().filter(r=>(state.category==='Все рецепты'||r.categories.includes(state.category))&&(!state.onlyFavorites||prefs.favorites[r.id])&&state.tags.every(t=>r.tags.includes(t))&&(!q||`${r.title} ${r.tags.join(' ')} ${r.categories.join(' ')} ${r.ingredients.join(' ')} ${r.original}`.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q)));
    if(state.sort==='name')rs.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    if(state.sort==='complete')rs.sort((a,b)=>Number(!!b.original)-Number(!!a.original));
    return rs;
  }
  function catalog(){
    document.title='К столу — моя книга рецептов';
    app.innerHTML=`<section class="intro"><div><div class="eyebrow">Собрано с любовью</div><h1>Что сегодня <em>приготовим?</em></h1><p>Любимые рецепты, которые всегда под рукой.</p></div><div class="collection-note"><b>${base.length}</b>рецепт в коллекции</div></section>
    <section class="filter-panel" aria-label="Поиск и фильтры"><div class="search-row"><label class="search-box">${icon('search')}<span class="sr-only">Поиск рецептов</span><input id="search" type="search" placeholder="Название, ингредиент или настроение…" value="${esc(state.query)}" autocomplete="off"></label><button class="control-button tag-filter-button ${state.showTags?'active':''}" id="tag-toggle" aria-expanded="${state.showTags}" aria-controls="tag-panel">${icon('filter')}<span class="button-label">Теги${state.tags.length?` · ${state.tags.length}`:''}</span></button><button class="control-button favorite-filter ${state.onlyFavorites?'active':''}" id="favorites-toggle" aria-pressed="${state.onlyFavorites}">${icon('heart')} Избранное</button></div><div class="tag-panel" id="tag-panel" ${!state.showTags?'hidden':''}></div><div class="tabs" role="group" aria-label="Приём пищи">${categories.map(c=>`<button class="tab ${state.category===c?'active':''}" data-category="${esc(c)}" aria-pressed="${state.category===c}">${esc(c)}<span>${c==='Все рецепты'?base.length:all().filter(r=>r.categories.includes(c)).length}</span></button>`).join('')}</div></section>
    <div class="active-filters" id="active-filters"></div><div class="table-toolbar"><span id="result-count" aria-live="polite"></span><div style="display:flex;align-items:center;gap:12px"><label><span class="sr-only">Сортировка</span><select class="sort-select" id="sort"><option value="default">Порядок коллекции</option><option value="name">По названию А–Я</option><option value="complete">С текстом рецепта</option></select></label><div class="view-switch" role="group" aria-label="Вид каталога"><button data-view="table" aria-label="Таблица" class="${state.view==='table'?'active':''}">${icon('table')}</button><button data-view="grid" aria-label="Карточки" class="${state.view==='grid'?'active':''}">${icon('grid')}</button></div></div></div><section id="results" aria-label="Рецепты"></section><div class="bottom-note"><span>${icon('leaf')} Всё вкусное — в одном месте.</span><span>Фото блюд из сохранённых видео</span></div>`;
    $('#sort').value=state.sort;
    $('#search').addEventListener('input',e=>{state.query=e.target.value;renderResults();});
    $('#sort').addEventListener('change',e=>{state.sort=e.target.value;renderResults();});
    $('#tag-toggle').onclick=()=>{state.showTags=!state.showTags;$('#tag-panel').hidden=!state.showTags;$('#tag-toggle').setAttribute('aria-expanded',state.showTags);$('#tag-toggle').classList.toggle('active',state.showTags);};
    $('#favorites-toggle').onclick=()=>{state.onlyFavorites=!state.onlyFavorites;catalog();};
    renderTags();renderResults();
  }
  function renderTags(){const tags=[...new Set(all().flatMap(r=>r.tags))].sort((a,b)=>a.localeCompare(b,'ru'));$('#tag-panel').innerHTML=tags.map(t=>`<button class="tag-toggle ${state.tags.includes(t)?'active':''}" data-tag="${esc(t)}" aria-pressed="${state.tags.includes(t)}">${esc(t)}</button>`).join('');}
  function renderResults(){
    const rs=filtered();$('#result-count').innerHTML=`<strong>${rs.length}</strong> из ${base.length} рецептов`;
    $('#active-filters').innerHTML=state.tags.map(t=>`<button data-tag="${esc(t)}">${esc(t)} ×</button>`).join('')+((state.tags.length||state.query||state.category!=='Все рецепты'||state.onlyFavorites)?'<button class="clear" id="clear-filters">Сбросить фильтры</button>':'');
    const clear=$('#clear-filters');if(clear)clear.onclick=()=>{state={...state,query:'',category:'Все рецепты',tags:[],onlyFavorites:false};catalog();};
    if(!rs.length){$('#results').innerHTML=`<div class="empty-state">${icon('search')}<h2>Пока ничего не нашлось</h2><p>Попробуй другой ингредиент или убери часть фильтров.</p></div>`;return;}
    if(state.view==='grid')$('#results').innerHTML=`<div class="collection-grid">${rs.map(r=>`<article class="grid-card"><a class="grid-image" href="#recipe/${r.id}">${image(r)}</a>${favorite(r)}<div class="grid-info"><div class="badges">${categoryBadges(r)}</div><h2><a href="#recipe/${r.id}">${esc(r.title)}</a></h2><div class="badges">${tagBadges(r)}</div>${source(r)}</div></article>`).join('')}</div>`;
    else $('#results').innerHTML=`<div class="table-wrap"><table><thead><tr><th scope="col">Блюдо</th><th scope="col">Когда готовим</th><th scope="col">Теги</th><th scope="col">Источник</th><th scope="col"><span class="sr-only">Избранное</span></th></tr></thead><tbody>${rs.map(r=>`<tr><td><a class="recipe-link" href="#recipe/${r.id}">${image(r)}<span>${esc(r.title)}<small>${r.original?(r.ingredients.length?`${r.ingredients.length} позиций · рецепт сохранён`:'Есть описание автора'):'Рецепт в видео'}</small></span></a></td><td><div class="badges">${categoryBadges(r)}</div></td><td><div class="badges">${tagBadges(r)}</div></td><td>${source(r)}</td><td>${favorite(r)}</td></tr>`).join('')}</tbody></table></div>`;
    $('[data-view="table"]').classList.toggle('active',state.view==='table');$('[data-view="grid"]').classList.toggle('active',state.view==='grid');
  }
  function ingredientRows(r){return r.ingredients.map((t,i)=>`<label class="ingredient"><input type="checkbox" data-check="${r.id}:${i}" ${prefs.checked[`${r.id}:${i}`]?'checked':''}><span>${esc(t)}</span></label>`).join('');}
  function detail(id){
    const r=recipe(id);if(!r){app.innerHTML='<div class="empty-state"><h1>Рецепт не найден</h1><a href="#">Вернуться в коллекцию</a></div>';return;}
    document.title=r.title+' — К столу';
    app.innerHTML=`<div class="detail-top"><a class="back-button" href="#">${icon('back')} Все рецепты</a><div class="detail-actions"><button class="subtle-button" id="edit-recipe">${icon('edit')} Теги и рецепт</button><button class="icon-button" id="print" aria-label="Распечатать рецепт">${icon('print')}</button>${favorite(r)}</div></div><article><section class="detail-hero">${r.photo?image(r,'hero-photo'):`<div class="hero-placeholder">${icon('leaf')}</div>`}<div class="hero-content"><div class="eyebrow">Из моей коллекции</div><div class="badges">${categoryBadges(r)}</div><h1>${esc(r.title)}</h1><div class="badges">${tagBadges(r)}</div>${source(r)}<span class="photo-credit">${prefs.photos[r.id]?'Моё фото':r.photo?'Кадр из оригинального видео':'Фото пока нет'}</span><label class="photo-upload">${r.photo?'Заменить фото':'Добавить фото'}<input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div></section><div class="recipe-body"><aside class="ingredients-card"><div class="section-label">Перед приготовлением</div><h2>Ингредиенты</h2>${r.ingredients.length?`<div>${ingredientRows(r)}</div><p class="ingredient-note">Отмечай то, что уже есть дома.</p><button class="primary-button" id="add-shopping">${icon(prefs.basket[id]?'check':'bag')} ${prefs.basket[id]?'В списке покупок':'В список покупок'}</button>`:'<p class="help">В описании нет списка ингредиентов. Посмотри видео в источнике или добавь список через «Теги и рецепт».</p>'}</aside><section class="recipe-instructions"><div class="section-label">Шаг за шагом</div><h2 class="step-heading">Готовим</h2>${r.steps.length?`<ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol>`:`<div class="notice">${r.original?'В сохранённом описании нет подробных шагов. Техника приготовления — в источнике.':'У этого рецепта сохранилось только видео. Открой источник, чтобы посмотреть приготовление.'}<br>${source(r)}</div>`}<p class="help">${r.original?'Карточка структурирована для удобства. Количества без единиц оставлены как у автора; полный исходный текст — ниже.':'Можно заполнить ингредиенты и шаги самостоятельно — они сохранятся на этом устройстве.'}</p>${r.original?`<details><summary>Оригинальное описание автора</summary><pre class="original">${esc(r.original)}</pre><button class="subtle-button" id="download-original">${icon('download')} Скачать исходный TXT</button></details>`:''}</section></div></article>`;
    $('#edit-recipe').onclick=()=>editRecipe(r);$('#print').onclick=()=>window.print();
    if($('#add-shopping'))$('#add-shopping').onclick=()=>{prefs.basket[id]=!prefs.basket[id];save();header();detail(id);toast(prefs.basket[id]?'Ингредиенты добавлены в список покупок':'Рецепт убран из списка покупок');};
    if($('#download-original'))$('#download-original').onclick=()=>download(r.title+'.txt',r.original,'text/plain;charset=utf-8');
    $('#photo-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Выбери JPG, PNG или WebP');return;}if(file.size>20*1024*1024){toast('Выбери фото размером до 20 МБ');return;}
      try {const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const previous=prefs.photos[id];prefs.photos[id]=canvas.toDataURL('image/jpeg',.78);bitmap.close();if(!save()){if(previous)prefs.photos[id]=previous;else delete prefs.photos[id];return;}detail(id);toast('Фото сохранено на этом устройстве');}catch{toast('Не удалось прочитать фото');}};
  }
  function shopping(){
    document.title='Список покупок — К столу';const rs=all().filter(r=>prefs.basket[r.id]);
    app.innerHTML=`<div class="detail-top"><a class="back-button" href="#">${icon('back')} Все рецепты</a></div><section class="shopping-layout"><div class="eyebrow">В магазин без суеты</div><h1>Список покупок</h1><p class="help">Ингредиенты сгруппированы по рецептам. Отмеченные позиции уже есть или куплены.</p>${rs.length?`<div class="shopping-header"><span class="help">${rs.length} рецептов · ${rs.reduce((s,r)=>s+r.ingredients.length,0)} позиций</span><div><button class="control-button" id="copy-shopping">${icon('download')} Скопировать</button> <button class="control-button" id="reset-checked">Снять отметки</button></div></div>${rs.map(r=>`<section class="shopping-recipe"><h2><a href="#recipe/${r.id}">${esc(r.title)}</a><button class="icon-button" data-remove="${r.id}" aria-label="Убрать ${esc(r.title)} из покупок">${icon('close')}</button></h2>${ingredientRows(r)}</section>`).join('')}`:`<div class="empty-state">${icon('bag')}<h2>Сначала выберем что-нибудь вкусное</h2><p>Открой рецепт и нажми «В список покупок».</p><a class="primary-button" href="#">Выбрать рецепт</a></div>`}</section>`;
    if($('#copy-shopping'))$('#copy-shopping').onclick=async()=>{const text=rs.map(r=>r.title+'\n'+r.ingredients.map((t,i)=>`${prefs.checked[r.id+':'+i]?'[x]':'[ ]'} ${t}`).join('\n')).join('\n\n');try{await navigator.clipboard.writeText(text);toast('Список скопирован');}catch{download('Список покупок.txt',text,'text/plain;charset=utf-8');toast('Список сохранён в TXT');}};
    if($('#reset-checked'))$('#reset-checked').onclick=()=>{rs.forEach(r=>r.ingredients.forEach((_,i)=>delete prefs.checked[r.id+':'+i]));save();shopping();};
  }
  function showDialog(content){dialog.innerHTML=content;dialog.showModal();$('.close-dialog',dialog).onclick=()=>dialog.close();}
  function editRecipe(r){
    showDialog(`<form id="edit-form"><div class="dialog-heading"><h2 id="dialog-title">Мой рецепт</h2><button type="button" class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div><p>Изменения сохраняются в этом браузере. Для переноса на другое устройство используй резервную копию.</p><label class="form-label" for="edit-title">Название</label><input class="form-input" id="edit-title" value="${esc(r.title)}" required maxlength="180"><span class="form-label">Когда готовим</span><div class="form-categories">${categories.slice(1).map(c=>`<label><input type="checkbox" name="category" value="${esc(c)}" ${r.categories.includes(c)?'checked':''}> ${esc(c)}</label>`).join('')}</div><label class="form-label" for="edit-tags">Свои теги — через запятую</label><input class="form-input" id="edit-tags" value="${esc(r.tags.join(', '))}" placeholder="На каждый день, Для гостей, Без сахара"><label class="form-label" for="edit-ingredients">Ингредиенты — каждый с новой строки</label><textarea class="form-input" id="edit-ingredients" rows="6">${esc(r.ingredients.join('\n'))}</textarea><label class="form-label" for="edit-steps">Шаги — каждый с новой строки</label><textarea class="form-input" id="edit-steps" rows="7">${esc(r.steps.join('\n'))}</textarea><div class="dialog-actions"><button class="primary-button" type="submit">Сохранить</button><button type="button" class="subtle-button" id="restore-recipe">Вернуть исходный</button></div></form>`);
    $('#edit-form').onsubmit=e=>{e.preventDefault();const title=$('#edit-title').value.trim();if(!title)return;const cs=[...dialog.querySelectorAll('[name="category"]:checked')].map(i=>i.value);if(!cs.length){toast('Выбери хотя бы одну категорию');return;}
      const previous=prefs.overrides[r.id];prefs.overrides[r.id]={title,categories:cs,tags:[...new Set($('#edit-tags').value.split(',').map(t=>t.trim()).filter(Boolean))],ingredients:$('#edit-ingredients').value.split('\n').map(t=>t.trim()).filter(Boolean),steps:$('#edit-steps').value.split('\n').map(t=>t.trim()).filter(Boolean)};if(save()){Object.keys(prefs.checked).filter(k=>k.startsWith(r.id+':')).forEach(k=>delete prefs.checked[k]);save();dialog.close();detail(r.id);toast('Рецепт сохранён');}else if(previous)prefs.overrides[r.id]=previous;else delete prefs.overrides[r.id];};
    $('#restore-recipe').onclick=()=>{delete prefs.overrides[r.id];if(save()){dialog.close();detail(r.id);toast('Исходная карточка восстановлена');}};
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function settings(){
    showDialog(`<div class="dialog-heading"><h2 id="dialog-title">Моя книга</h2><button class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div><p>В коллекции ${base.length} рецепт. Теги, правки, свои фото, избранное и покупки сохраняются <strong>только в браузере этого устройства</strong>.</p><p>Чтобы перенести их на телефон или другой компьютер, скачай резервную копию и загрузи её на другом устройстве. Файл содержит личные изменения, исходные рецепты уже есть в сайте.</p><div class="setting-actions"><button class="subtle-button" id="export">${icon('download')} Скачать резервную копию</button><button class="subtle-button" id="import">${icon('upload')} Загрузить резервную копию</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><p class="help">Импорт заменяет текущие личные данные после подтверждения. Сначала сохрани их резервную копию.</p>`);
    $('#export').onclick=()=>download('К столу — резервная копия.json',JSON.stringify({version:1,savedAt:new Date().toISOString(),preferences:prefs},null,2),'application/json');
    $('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw new Error();const data=JSON.parse(await f.text());if(data.version!==1||!data.preferences||typeof data.preferences!=='object')throw new Error();const next={};for(const key of ['overrides','favorites','basket','checked','photos']){const val=data.preferences[key];if(!val||typeof val!=='object'||Array.isArray(val))throw new Error();next[key]=val;}
      for(const [id,value] of Object.entries(next.overrides)){if(!base.some(r=>r.id===id)||!value||typeof value.title!=='string'||!['categories','tags','ingredients','steps'].every(k=>Array.isArray(value[k])&&value[k].every(x=>typeof x==='string'))||value.categories.some(c=>!categories.includes(c)))throw new Error();next.overrides[id]={title:value.title,categories:value.categories,tags:value.tags,ingredients:value.ingredients,steps:value.steps};}
      for(const value of Object.values(next.photos))if(typeof value!=='string'||!/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))throw new Error();
      if(!confirm('Заменить личные данные этого браузера данными из резервной копии?'))return;const old=prefs;prefs=next;if(save()){dialog.close();header();route();toast('Резервная копия загружена');}else prefs=old;
    }catch{toast('Это не резервная копия «К столу» или файл повреждён');}};
  }
  document.addEventListener('click',e=>{
    const fav=e.target.closest('[data-favorite]');if(fav){const id=fav.dataset.favorite;prefs.favorites[id]=!prefs.favorites[id];save();if(location.hash.startsWith('#recipe/'))detail(id);else renderResults();return;}
    const cat=e.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;catalog();return;}
    const tag=e.target.closest('[data-tag]');if(tag){const t=tag.dataset.tag;state.tags=state.tags.includes(t)?state.tags.filter(x=>x!==t):[...state.tags,t];renderTags();renderResults();return;}
    const view=e.target.closest('[data-view]');if(view){state.view=view.dataset.view;prefs.view=state.view;save();renderResults();return;}
    const remove=e.target.closest('[data-remove]');if(remove){delete prefs.basket[remove.dataset.remove];save();header();shopping();}
  });
  document.addEventListener('change',e=>{if(e.target.matches('[data-check]')){prefs.checked[e.target.dataset.check]=e.target.checked;save();}});
  $('#shopping-nav').onclick=()=>{location.hash='shopping';};$('#settings-nav').onclick=settings;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  function route(){header();if(location.hash.startsWith('#recipe/'))detail(location.hash.slice(8));else if(location.hash==='#shopping')shopping();else catalog();}
  window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0);});window.addEventListener('storage',e=>{if(e.key===KEY){try{prefs=JSON.parse(e.newValue)||prefs;header();route();}catch{}}});route();
})();
