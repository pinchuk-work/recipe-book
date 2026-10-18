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
  icons.sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>';
  icons.moon='<path d="M20 14a8 8 0 0 1-10-10A8.5 8.5 0 1 0 20 14Z"/>';
  icons.plus='<path d="M12 5v14M5 12h14"/>';
  const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.leaf}</svg>`;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const KEY='k-stolu.preferences.v1';
  let prefs;
  try { prefs=JSON.parse(localStorage.getItem(KEY)) || {}; } catch { prefs={}; }
  for (const k of ['overrides','favorites','basket','checked','photos']) if (!prefs[k] || typeof prefs[k]!=='object' || Array.isArray(prefs[k])) prefs[k]={};
  let state={query:'',category:'Все рецепты',tags:[],onlyFavorites:false,showTags:false,view:prefs.view==='grid'?'grid':'table',sort:'default'};
  const base=window.RECIPES || [];
  const app=$('#app'), dialog=$('#dialog');
  const categories=['Все рецепты','Завтрак','Обед','Ужин','Выпечка','Десерт','Напитки','Перекус','Салат','Соус'];
  let cloud=null,cloudState={enabled:false,authenticated:false,pending:0,conflicts:[],message:''};
  const LOCAL_BACKUP=KEY+'.before-cloud';
  let authPending=true;
  function save(){ try { localStorage.setItem(KEY,JSON.stringify(prefs));if(cloud?.connected)cloud.capture(prefs);else localStorage.setItem(LOCAL_BACKUP,JSON.stringify(prefs));return true; } catch {toast('Не удалось сохранить: память браузера заполнена.');return false;} }
  function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),3200);}
  const speeds=['Быстро','Средне','Долго'];
  const customId=id=>/^u[a-f0-9]{32}$/.test(id);
  function recipe(id){const r=base.find(r=>r.id===id),o=prefs.overrides[id];if(!r&&!(customId(id)&&o?.custom))return null;const result={title:'',categories:[],tags:[],ingredients:[],steps:[],source:'',sources:[],original:'',photo:'',...r,...o,id};result.photo=prefs.photos[id]||result.photo;if(result.custom)result.originalLabel='Описание и заметки';result.tags=[...new Set(result.tags.filter(t=>t.toLowerCase()!=='рецепт в видео'))];if(r&&!result.tags.some(t=>speeds.includes(t))){const speed=r.tags.find(t=>speeds.includes(t));if(speed)result.tags.push(speed);}if(result.categories.includes('Салат')||/салат|цезарь/i.test(result.title))result.tags=[...new Set([...result.tags,'Салат'])];return result;}
  function all(){return [...base.map(r=>r.id),...Object.keys(prefs.overrides).filter(id=>customId(id)&&prefs.overrides[id]?.custom)].map(recipe).filter(Boolean);}
  function availableCategories(){return [...categories,...new Set(all().flatMap(r=>r.categories).filter(c=>!categories.includes(c)))];}

  function image(r, cls=''){return r.photo?`<img ${cls?`class="${cls}"`:''} src="${esc(r.photo)}" alt="${esc(r.title)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'photo-empty',textContent:'Нет фото'}))">`:`<span class="photo-empty">${icon('leaf')}<span class="sr-only">Фото ещё не добавлено</span></span>`;}
  function categoryBadges(r){return r.categories.map(c=>`<span class="badge category-${esc(c.toLowerCase())}">${esc(c)}</span>`).join('');}
  function tagBadges(r){return r.tags.map(t=>`<span class="badge tag" ${speeds.includes(t)?`data-speed="${esc(t)}" title="${r.speedEstimated?'Примерная скорость, с учётом ожидания':'Скорость приготовления'}"`:''}>${esc(t)}</span>`).join('');}
  function source(r){
    const urls=(r.sources?.length?r.sources:[r.source]).filter(url=>/^https?:\/\//i.test(url));
    if(!urls.length)return '<span class="source-link source-empty">Личная запись</span>';
    return `<span class="source-list">${urls.map(url=>{
      let label;try{const host=new URL(url).hostname.replace(/^www\./,'');label=host==='vk.ru'||host==='vk.com'?(url.includes('/wall')?'Запись VK':'VK Клипы'):({'edimdoma.ru':'Едим Дома','russianfood.com':'RussianFood','eda.ru':'Еда','food.ru':'Food.ru','pikabu.ru':'Пикабу','lavka.yandex.ru':'Яндекс Лавка','vkusvill.ru':'ВкусВилл','youtu.be':'YouTube','youtube.com':'YouTube','1000.menu':'1000.menu'}[host]||host);}catch{return '';}
      return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon('arrow')}</a>`;
    }).join('')}</span>`;
  }
  function contentLabel(r){return r.ingredients.length?`Ингредиентов: ${r.ingredients.length}`:r.original?'Есть описание':r.contentStatus==='draft'?'Черновик':r.contentStatus==='bookmark'?'Ссылка без рецепта':r.custom?'Ингредиенты пока не добавлены':'Смотреть источник';}
  function stepsHTML(r){
    const initial=base.find(x=>x.id===r.id);
    const groups=r.stepGroups?.length && JSON.stringify(initial?.steps)===JSON.stringify(r.steps)?r.stepGroups:[{title:'',steps:r.steps}];
    return groups.map(g=>`${g.title?`<h3 class="step-group-title">${esc(g.title)}</h3>`:''}<ol class="steps">${g.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol>`).join('');
  }
  function favorite(r){return `<button class="favorite icon-button ${prefs.favorites[r.id]?'active':''}" data-favorite="${r.id}" aria-label="${prefs.favorites[r.id]?'Убрать из избранного':'В избранное'}: ${esc(r.title)}" aria-pressed="${!!prefs.favorites[r.id]}">${icon('heart')}</button>`;}
  function header(){ $('#shopping-nav').hidden=!cloudState.authenticated;$('#settings-nav').hidden=!cloudState.authenticated;$('#shopping-nav').innerHTML=icon('bag')+(Object.keys(prefs.basket).filter(k=>prefs.basket[k]).length?`<span class="nav-count">${Object.keys(prefs.basket).filter(k=>prefs.basket[k]).length}</span>`:'');$('#settings-nav').innerHTML=icon('settings'); }
  function filtered(){
    const q=state.query.trim().toLocaleLowerCase('ru').replace(/ё/g,'е');
    let rs=all().filter(r=>(state.category==='Все рецепты'||r.categories.includes(state.category))&&(!state.onlyFavorites||prefs.favorites[r.id])&&state.tags.every(t=>r.tags.includes(t))&&(!q||`${r.title} ${(r.aliases||[]).join(' ')} ${r.tags.join(' ')} ${r.categories.join(' ')} ${r.ingredients.join(' ')} ${r.original}`.toLocaleLowerCase('ru').replace(/ё/g,'е').includes(q)));
    if(state.sort==='name')rs.sort((a,b)=>a.title.localeCompare(b.title,'ru'));
    if(state.sort==='complete')rs.sort((a,b)=>Number(!!b.original)-Number(!!a.original));
    return rs;
  }
  function catalog(){
    document.title='К столу — моя книга рецептов';
    app.innerHTML=`<div class="catalog-actions"><button class="primary-button" id="add-recipe">${icon('plus')} Добавить рецепт</button></div>
    <section class="filter-panel" aria-label="Поиск и фильтры"><div class="search-row"><label class="search-box">${icon('search')}<span class="sr-only">Поиск рецептов</span><input id="search" type="search" placeholder="Название, ингредиент или настроение…" value="${esc(state.query)}" autocomplete="off"></label><button class="control-button tag-filter-button ${state.showTags?'active':''}" id="tag-toggle" aria-label="Фильтр по тегам" aria-expanded="${state.showTags}" aria-controls="tag-panel">${icon('filter')}<span class="button-label">Теги${state.tags.length?` · ${state.tags.length}`:''}</span></button><button class="control-button favorite-filter ${state.onlyFavorites?'active':''}" id="favorites-toggle" aria-pressed="${state.onlyFavorites}">${icon('heart')} Избранное</button></div><div class="tag-panel" id="tag-panel" ${!state.showTags?'hidden':''}></div><div class="tabs" role="group" aria-label="Приём пищи">${availableCategories().map(c=>`<button class="tab ${state.category===c?'active':''}" data-category="${esc(c)}" aria-pressed="${state.category===c}">${esc(c)}<span>${c==='Все рецепты'?all().length:all().filter(r=>r.categories.includes(c)).length}</span></button>`).join('')}</div></section>
    <div class="active-filters" id="active-filters"></div><div class="table-toolbar"><span id="result-count" aria-live="polite"></span><div style="display:flex;align-items:center;gap:12px"><label><span class="sr-only">Сортировка</span><select class="sort-select" id="sort"><option value="default">Порядок коллекции</option><option value="name">По названию А–Я</option><option value="complete">С текстом рецепта</option></select></label><div class="view-switch" role="group" aria-label="Вид каталога"><button data-view="table" aria-label="Таблица" class="${state.view==='table'?'active':''}">${icon('table')}</button><button data-view="grid" aria-label="Карточки" class="${state.view==='grid'?'active':''}">${icon('grid')}</button></div></div></div><section id="results" aria-label="Рецепты"></section>`;
    $('#add-recipe').onclick=()=>editRecipe();
    $('#sort').value=state.sort;
    $('#search').addEventListener('input',e=>{state.query=e.target.value;renderResults();});
    $('#sort').addEventListener('change',e=>{state.sort=e.target.value;renderResults();});
    $('#tag-toggle').onclick=()=>{state.showTags=!state.showTags;$('#tag-panel').hidden=!state.showTags;$('#tag-toggle').setAttribute('aria-expanded',state.showTags);$('#tag-toggle').classList.toggle('active',state.showTags);};
    $('#favorites-toggle').onclick=()=>{state.onlyFavorites=!state.onlyFavorites;catalog();};
    renderTags();renderResults();
  }
  function renderTags(){const tags=[...new Set(all().flatMap(r=>r.tags))].sort((a,b)=>a.localeCompare(b,'ru'));$('#tag-panel').innerHTML=tags.map(t=>`<button class="tag-toggle ${state.tags.includes(t)?'active':''}" data-tag="${esc(t)}" aria-pressed="${state.tags.includes(t)}">${esc(t)}</button>`).join('');}
  function renderResults(){
    const rs=filtered();$('#result-count').innerHTML=`<strong>${rs.length}</strong> из ${all().length} рецептов`;
    $('#active-filters').innerHTML=state.tags.map(t=>`<button data-tag="${esc(t)}">${esc(t)} ×</button>`).join('')+((state.tags.length||state.query||state.category!=='Все рецепты'||state.onlyFavorites)?'<button class="clear" id="clear-filters">Сбросить фильтры</button>':'');
    const clear=$('#clear-filters');if(clear)clear.onclick=()=>{state={...state,query:'',category:'Все рецепты',tags:[],onlyFavorites:false};catalog();};
    if(!rs.length){$('#results').innerHTML=`<div class="empty-state">${icon('search')}<h2>Пока ничего не нашлось</h2><p>Попробуй другой ингредиент или убери часть фильтров.</p></div>`;return;}
    if(state.view==='grid')$('#results').innerHTML=`<div class="collection-grid">${rs.map(r=>`<article class="grid-card"><a class="grid-image" href="#recipe/${r.id}">${image(r)}</a>${favorite(r)}<div class="grid-info"><div class="badges">${categoryBadges(r)}</div><h2><a href="#recipe/${r.id}">${esc(r.title)}</a></h2><div class="badges">${tagBadges(r)}</div>${source(r)}</div></article>`).join('')}</div>`;
    else $('#results').innerHTML=`<div class="table-wrap"><table><thead><tr><th scope="col">Блюдо</th><th scope="col">Когда готовим</th><th scope="col">Теги</th><th scope="col">Источник</th><th scope="col"><span class="sr-only">Избранное</span></th></tr></thead><tbody>${rs.map(r=>`<tr><td><a class="recipe-link" href="#recipe/${r.id}">${image(r)}<span>${esc(r.title)}<small>${contentLabel(r)}</small></span></a></td><td><div class="badges">${categoryBadges(r)}</div></td><td><div class="badges">${tagBadges(r)}</div></td><td>${source(r)}</td><td>${favorite(r)}</td></tr>`).join('')}</tbody></table></div>`;
    $('[data-view="table"]').classList.toggle('active',state.view==='table');$('[data-view="grid"]').classList.toggle('active',state.view==='grid');
  }
  function ingredientRows(r){return r.ingredients.map((t,i)=>`<label class="ingredient"><input type="checkbox" data-check="${r.id}:${i}" ${prefs.checked[`${r.id}:${i}`]?'checked':''}><span>${esc(t)}</span></label>`).join('');}
  function detail(id){
    const r=recipe(id);if(!r){app.innerHTML='<div class="empty-state"><h1>Рецепт не найден</h1><a href="#">Вернуться в коллекцию</a></div>';return;}
    document.title=r.title+' — К столу';
    app.innerHTML=`<div class="detail-top"><a class="back-button" href="#">${icon('back')} Все рецепты</a><div class="detail-actions"><button class="subtle-button" id="edit-recipe">${icon('edit')} Редактировать</button>${favorite(r)}</div></div><article><section class="detail-hero">${r.photo?image(r,'hero-photo'):`<div class="hero-placeholder">${icon('leaf')}</div>`}<div class="hero-content"><div class="badges">${categoryBadges(r)}</div><h1>${esc(r.title)}</h1>${r.minutes||r.servings?`<p class="recipe-meta">${[r.minutes?r.minutes+' мин':'',r.servings?r.servings+' порц.':''].filter(Boolean).join(' · ')}</p>`:''}<div class="badges">${tagBadges(r)}</div>${source(r)}<span class="photo-credit">${prefs.photos[r.id]?'Моё фото':r.photo?'Кадр из оригинального видео':'Фото пока нет'}</span><label class="photo-upload">${r.photo?'Заменить фото':'Добавить фото'}<input id="photo-upload" type="file" accept="image/jpeg,image/png,image/webp" hidden></label></div></section><div class="recipe-body"><aside class="ingredients-card"><div class="section-label">Перед приготовлением</div><h2>Ингредиенты</h2>${r.ingredients.length?`<div>${ingredientRows(r)}</div><p class="ingredient-note">Отмечай то, что уже есть дома.</p><button class="primary-button" id="add-shopping">${icon(prefs.basket[id]?'check':'bag')} ${prefs.basket[id]?'В списке покупок':'В список покупок'}</button>`:'<p class="help">В описании нет списка ингредиентов. Открой источник или добавь список через «Редактировать».</p>'}</aside><section class="recipe-instructions"><div class="section-label">Шаг за шагом</div><h2 class="step-heading">Готовим</h2>${r.steps.length?stepsHTML(r):`<div class="notice">${r.custom?'Добавь шаги приготовления через «Редактировать».':r.original?'В сохранённом описании нет подробных шагов. Техника приготовления — в источнике.':(r.contentStatus==='draft'?'Это заготовка из твоей книги. Ингредиенты и шаги пока не заполнены.':r.contentStatus==='bookmark'?'В экспорте сохранена только ссылка. Сам текст рецепта пока не заполнен.':'У этого рецепта сохранилось только видео. Открой источник, чтобы посмотреть приготовление.')}<br>${source(r)}</div>`}${r.original?`<details><summary>${esc(r.originalLabel||'Оригинальное описание автора')}</summary><pre class="original">${esc(r.original)}</pre><button class="subtle-button" id="download-original">${icon('download')} Скачать исходный TXT</button></details>`:''}</section></div></article>`;
    $('#edit-recipe').onclick=()=>editRecipe(r);
    if($('#add-shopping'))$('#add-shopping').onclick=()=>{prefs.basket[id]=!prefs.basket[id];save();header();detail(id);toast(prefs.basket[id]?'Ингредиенты добавлены в список покупок':'Рецепт убран из списка покупок');};
    if($('#download-original'))$('#download-original').onclick=()=>download(r.title+'.txt',r.original,'text/plain;charset=utf-8');
    $('#photo-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Выбери JPG, PNG или WebP');return;}if(file.size>20*1024*1024){toast('Выбери фото размером до 20 МБ');return;}
      try {const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');const scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);const previous=prefs.photos[id];prefs.photos[id]=canvas.toDataURL('image/jpeg',.78);bitmap.close();if(!save()){if(previous)prefs.photos[id]=previous;else delete prefs.photos[id];return;}detail(id);toast(cloud?.connected?'Фото добавлено в очередь синхронизации':'Фото сохранено на этом устройстве');}catch{toast('Не удалось прочитать фото');}};
  }
  function shopping(){
    document.title='Список покупок — К столу';const rs=all().filter(r=>prefs.basket[r.id]);
    app.innerHTML=`<div class="detail-top"><a class="back-button" href="#">${icon('back')} Все рецепты</a></div><section class="shopping-layout"><div class="eyebrow">В магазин без суеты</div><h1>Список покупок</h1><p class="help">Ингредиенты сгруппированы по рецептам. Отмеченные позиции уже есть или куплены.</p>${rs.length?`<div class="shopping-header"><span class="help">${rs.length} рецептов · ${rs.reduce((s,r)=>s+r.ingredients.length,0)} позиций</span><div><button class="control-button" id="copy-shopping">${icon('download')} Скопировать</button> <button class="control-button" id="reset-checked">Снять отметки</button></div></div>${rs.map(r=>`<section class="shopping-recipe"><h2><a href="#recipe/${r.id}">${esc(r.title)}</a><button class="icon-button" data-remove="${r.id}" aria-label="Убрать ${esc(r.title)} из покупок">${icon('close')}</button></h2>${ingredientRows(r)}</section>`).join('')}`:`<div class="empty-state">${icon('bag')}<h2>Сначала выберем что-нибудь вкусное</h2><p>Открой рецепт и нажми «В список покупок».</p><a class="primary-button" href="#">Выбрать рецепт</a></div>`}</section>`;
    if($('#copy-shopping'))$('#copy-shopping').onclick=async()=>{const text=rs.map(r=>r.title+'\n'+r.ingredients.map((t,i)=>`${prefs.checked[r.id+':'+i]?'[x]':'[ ]'} ${t}`).join('\n')).join('\n\n');try{await navigator.clipboard.writeText(text);toast('Список скопирован');}catch{download('Список покупок.txt',text,'text/plain;charset=utf-8');toast('Список сохранён в TXT');}};
    if($('#reset-checked'))$('#reset-checked').onclick=()=>{rs.forEach(r=>r.ingredients.forEach((_,i)=>delete prefs.checked[r.id+':'+i]));save();shopping();};
  }
  function showDialog(content){dialog.classList.remove('recipe-editor');dialog.innerHTML=content;dialog.showModal();$('.close-dialog',dialog).onclick=()=>dialog.close();}
  async function photoData(file){
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Выбери JPG, PNG или WebP до 20 МБ.');
    const bitmap=await createImageBitmap(file),canvas=document.createElement('canvas'),scale=Math.min(1,960/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();return canvas.toDataURL('image/jpeg',.76);
  }
  function editRecipe(existing){
    const creating=!existing,id=existing?.id||'u'+crypto.randomUUID().replaceAll('-','');
    const r=existing||{id,title:'',categories:[],tags:[],ingredients:[],steps:[],sources:[],source:'',original:'',photo:''};
    cloud?.edit('overrides',id);
    const selected={category:new Set(r.categories),tag:new Set(r.tags.filter(t=>!speeds.includes(t)))};
    const options={category:new Set(availableCategories().slice(1)),tag:new Set(all().flatMap(r=>r.tags).filter(t=>!speeds.includes(t)))};
    showDialog(`<form id="edit-form"><div class="dialog-heading"><h2 id="dialog-title">${creating?'Новый рецепт':'Редактировать рецепт'}</h2><button type="button" class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div><label class="form-label" for="edit-title">Название</label><input class="form-input" id="edit-title" value="${esc(r.title)}" required maxlength="180">
    <span class="form-label" id="category-label">Когда готовим</span><div class="choice-list" id="category-choices" role="group" aria-labelledby="category-label"></div><div class="choice-add"><input class="form-input" id="new-category" aria-label="Новая категория" placeholder="Своя категория" maxlength="60"><button class="subtle-button" type="button" id="add-category">Добавить</button></div>
    <span class="form-label" id="tag-label">Теги</span><div class="choice-list" id="tag-choices" role="group" aria-labelledby="tag-label"></div><div class="choice-add"><input class="form-input" id="new-tag" aria-label="Новый тег" placeholder="Свой тег" maxlength="60"><button class="subtle-button" type="button" id="add-tag">Добавить</button></div>
    <div class="form-columns"><label><span class="form-label">Скорость</span><select class="form-input" id="edit-speed"><option value="">Не указана</option>${speeds.map(t=>`<option ${r.tags.includes(t)?'selected':''}>${t}</option>`).join('')}</select></label><label><span class="form-label">Время, мин</span><input class="form-input" id="edit-minutes" type="number" min="0" max="100000" value="${r.minutes||''}"></label><label><span class="form-label">Порций</span><input class="form-input" id="edit-servings" type="number" min="0" max="1000" value="${r.servings||''}"></label></div>
    <label class="form-label" for="edit-sources">Источники — каждая ссылка с новой строки</label><textarea class="form-input" id="edit-sources" rows="2" placeholder="https://…">${esc((r.sources?.length?r.sources:[r.source]).filter(Boolean).join('\n'))}</textarea>
    <label class="form-label" for="edit-photo">Фото готового блюда</label>${r.photo?`<img class="form-photo" src="${esc(r.photo)}" alt="Текущее фото блюда">`:''}<input class="form-input" id="edit-photo" type="file" accept="image/jpeg,image/png,image/webp">
    <label class="form-label" for="edit-ingredients">Ингредиенты — каждый с новой строки</label><textarea class="form-input" id="edit-ingredients" rows="6">${esc(r.ingredients.join('\n'))}</textarea><label class="form-label" for="edit-steps">Шаги — каждый с новой строки</label><textarea class="form-input" id="edit-steps" rows="7">${esc(r.steps.join('\n'))}</textarea>
    <label class="form-label" for="edit-original">Исходное описание или заметки</label><textarea class="form-input" id="edit-original" rows="4" maxlength="100000">${esc(r.original||'')}</textarea><p id="edit-error" role="alert"></p><div class="dialog-actions"><button class="primary-button" type="submit">${creating?'Добавить рецепт':'Сохранить'}</button>${!creating&&!r.custom?'<button type="button" class="subtle-button" id="restore-recipe">Вернуть исходный</button>':''}</div></form>`);
    dialog.classList.add('recipe-editor');
    for(const kind of ['category','tag']){
      const render=()=>{$('#'+kind+'-choices').innerHTML=[...new Set([...options[kind],...selected[kind]])].sort((a,b)=>a.localeCompare(b,'ru')).map(t=>`<button type="button" class="choice ${selected[kind].has(t)?'selected':''}" aria-pressed="${selected[kind].has(t)}" data-choice="${esc(t)}">${esc(t)}</button>`).join('');$('#'+kind+'-choices').querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{const t=button.dataset.choice;selected[kind].has(t)?selected[kind].delete(t):selected[kind].add(t);render();});};
      const add=()=>{const input=$('#new-'+kind),text=input.value.trim();if(!text)return;const existing=[...options[kind]].find(t=>t.toLocaleLowerCase('ru')===text.toLocaleLowerCase('ru'));const name=existing||text;if(kind==='tag'&&name.toLowerCase()==='рецепт в видео'){input.value='';return;}options[kind].add(name);selected[kind].add(name);input.value='';render();};
      $('#add-'+kind).onclick=add;$('#new-'+kind).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();add();}};render();
    }
    $('#edit-form').onsubmit=async e=>{
      e.preventDefault();const output=$('#edit-error'),button=e.currentTarget.querySelector('[type=submit]');output.textContent='';if(!$('#edit-title').value.trim()){output.textContent='Добавь название рецепта.';return;}if(!selected.category.size){output.textContent='Выбери или добавь категорию.';return;}
      const sources=$('#edit-sources').value.split('\n').map(t=>t.trim()).filter(Boolean);if(sources.some(url=>{try{return !['http:','https:'].includes(new URL(url).protocol);}catch{return true;}})){output.textContent='Для источника нужна полная ссылка http:// или https://.';return;}
      button.disabled=true;
      try{
        const file=$('#edit-photo').files[0],photo=file?await photoData(file):null;
        const minutes=Number($('#edit-minutes').value)||0,speed=$('#edit-speed').value||(minutes?(minutes<=30?'Быстро':minutes<=60?'Средне':'Долго'):'');
        const next={title:$('#edit-title').value.trim(),categories:[...selected.category],tags:[...new Set([...selected.tag,...(speed?[speed]:[])])],ingredients:$('#edit-ingredients').value.split('\n').map(t=>t.trim()).filter(Boolean),steps:$('#edit-steps').value.split('\n').map(t=>t.trim()).filter(Boolean),sources,source:sources[0]||'',original:$('#edit-original').value,minutes,servings:Number($('#edit-servings').value)||0,...(creating||r.custom?{custom:true}:{})};
        const previous=prefs.overrides[id],previousPhoto=prefs.photos[id];prefs.overrides[id]=next;if(photo)prefs.photos[id]=photo;
        if(!save()){if(previous)prefs.overrides[id]=previous;else delete prefs.overrides[id];if(previousPhoto)prefs.photos[id]=previousPhoto;else delete prefs.photos[id];button.disabled=false;return;}
        if(JSON.stringify(next.ingredients)!==JSON.stringify(r.ingredients)){Object.keys(prefs.checked).filter(k=>k.startsWith(id+':')).forEach(k=>delete prefs.checked[k]);save();}
        dialog.close();location.hash='recipe/'+id;route();toast(creating?'Рецепт добавлен':'Рецепт сохранён');
      }catch(error){output.textContent=error.message||'Не удалось сохранить рецепт.';button.disabled=false;}
    };
    if($('#restore-recipe'))$('#restore-recipe').onclick=()=>{delete prefs.overrides[id];if(save()){dialog.close();detail(id);toast('Исходная карточка восстановлена');}};
  }
  function download(name,content,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function settings(){
    showDialog(`<div class="dialog-heading"><h2 id="dialog-title">Моя книга</h2><button class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div><p>Рецептов в коллекции: ${base.length}. Без входа теги, правки, свои фото, избранное и покупки сохраняются <strong>только на этом устройстве</strong>.</p><p>Войди в общую книгу на телефоне и компьютере, чтобы синхронизировать изменения. Прежние правки с этого устройства добавятся автоматически при первом подключении, если для них ещё нет общей версии. Резервная копия позволяет сохранить их в файл.</p><div class="setting-actions"><button class="subtle-button" id="export">${icon('download')} Скачать резервную копию</button><button class="subtle-button" id="import">${icon('upload')} Загрузить резервную копию</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><p class="help">Импорт заменяет текущие личные данные после подтверждения. Сначала сохрани их резервную копию.</p>`);
    if(cloudState.conflicts.length){const conflictButton=document.createElement('button');conflictButton.className='subtle-button';conflictButton.textContent='Разобрать одновременные правки';conflictButton.onclick=()=>{dialog.close();cloudDialog();};$('.setting-actions',dialog).prepend(conflictButton);}
    $('#export').onclick=()=>download('К столу — резервная копия.json',JSON.stringify({version:1,savedAt:new Date().toISOString(),preferences:prefs},null,2),'application/json');
    if(cloudState.authenticated){dialog.querySelectorAll('p')[0].textContent='Правки, фото, теги, избранное и покупки — общие для вас двоих. Вид каталога остаётся личным. Синхронизация происходит при открытии страницы и примерно каждые 10 секунд.';dialog.querySelectorAll('p')[1].textContent='Если связь пропадёт, правки останутся на устройстве и отправятся после восстановления соединения. Резервную копию можно скачать дополнительно.';dialog.querySelector('p.help').textContent='Импорт заменяет общие правки, фото и отметки для вас обоих после подтверждения. Сначала скачай резервную копию.';}
    $('#import').onclick=()=>$('#import-file').click();$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>20*1024*1024)throw new Error();const data=JSON.parse(await f.text());if(data.version!==1||!data.preferences||typeof data.preferences!=='object')throw new Error();const next={};for(const key of ['overrides','favorites','basket','checked','photos']){const val=data.preferences[key];if(!val||typeof val!=='object'||Array.isArray(val))throw new Error();next[key]=val;}
      const cleaned=cleanShared(next);if(Object.keys(cleaned.overrides).length!==Object.keys(next.overrides).length||Object.keys(cleaned.photos).length!==Object.keys(next.photos).length)throw new Error();Object.assign(next,cleaned);
      if(!confirm(cloud?.connected?'Заменить общие правки, фото и отметки для обоих данными резервной копии?':'Заменить личные данные этого браузера данными из резервной копии?'))return;const old=prefs;prefs=next;if(save()){dialog.close();header();route();toast('Резервная копия загружена');}else prefs=old;
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
  const themeButton=document.createElement('button');themeButton.id='theme-toggle';themeButton.className='icon-button';$('.header-inner nav').prepend(themeButton);
  function updateTheme(){const dark=document.documentElement.dataset.theme==='dark';themeButton.innerHTML=icon(dark?'sun':'moon');themeButton.setAttribute('aria-label',dark?'Светлая тема':'Тёмная тема');themeButton.setAttribute('aria-pressed',String(dark));}
  themeButton.onclick=()=>{const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;try{localStorage.setItem('k-stolu.theme',next);}catch{}updateTheme();};updateTheme();
  $('#shopping-nav').onclick=()=>{location.hash='shopping';};$('#settings-nav').onclick=settings;
  dialog.addEventListener('click',e=>{if(e.target===dialog){const b=dialog.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();}});
  function route(){header();if(!cloudState.authenticated){if(dialog.open)dialog.close();loginScreen();return;}if(location.hash.startsWith('#recipe/'))detail(location.hash.slice(8));else if(location.hash==='#shopping')shopping();else catalog();}
  function loginScreen(){
    if(authPending){app.innerHTML='<section class="login-screen"><div class="login-card"><div class="eyebrow">Наша книга рецептов</div><h1>К столу</h1><p role="status">Проверяем вход…</p></div></section>';return;}
    if($('#site-login'))return;
    app.innerHTML=`<section class="login-screen"><div class="login-card"><div class="eyebrow">Наша книга рецептов</div><h1>Рады видеть<br>за столом.</h1><p>Войди, чтобы открыть рецепты и общий список покупок.</p><form id="site-login"><label class="form-label" for="site-email">Email</label><input class="form-input" type="email" id="site-email" autocomplete="username" required><label class="form-label" for="site-password">Пароль</label><input class="form-input" type="password" id="site-password" autocomplete="current-password" required><p id="site-login-error" role="alert">${esc(cloudState.message||'')}</p><button class="primary-button" type="submit" ${cloud?.enabled?'':'disabled'}>Войти в книгу</button></form></div></section>`;
    $('#site-login').onsubmit=async e=>{e.preventDefault();const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;$('#site-login-error').textContent='';try{await cloud.login($('#site-email').value.trim(),$('#site-password').value);route();}catch(error){const output=$('#site-login-error');if(output)output.textContent=error.message.includes('Invalid login')?'Проверь email и пароль.':'Не удалось войти. '+error.message;button.disabled=false;}};
  }
  function cleanShared(value){
    const ids=new Set(base.map(r=>r.id)),result={overrides:{},favorites:{},basket:{},checked:{},photos:{}};
    const list=v=>Array.isArray(v)&&v.length<=500&&v.every(s=>typeof s==='string'&&s.length<=10000);
    for(const [id,v] of Object.entries(value.overrides||{})){
      if(!(ids.has(id)||(customId(id)&&v?.custom===true))||!v||typeof v.title!=='string'||!v.title.trim()||v.title.length>180||!['categories','tags','ingredients','steps'].every(k=>list(v[k])))continue;
      if(v.categories.some(c=>!c.trim()||c.length>60)||v.tags.some(t=>!t.trim()||t.length>60))continue;
      const o={title:v.title,categories:v.categories,tags:v.tags.filter(t=>t.toLowerCase()!=='рецепт в видео'),ingredients:v.ingredients,steps:v.steps};
      if(customId(id))o.custom=true;
      if('sources' in v){if(!list(v.sources)||v.sources.some(url=>!/^https?:\/\//i.test(url)))continue;o.sources=v.sources;o.source=v.sources[0]||'';}
      if('original' in v){if(typeof v.original!=='string'||v.original.length>100000)continue;o.original=v.original;}
      if('minutes' in v)o.minutes=Math.max(0,Math.min(100000,Number(v.minutes)||0));
      if('servings' in v)o.servings=Math.max(0,Math.min(1000,Number(v.servings)||0));
      result.overrides[id]=o;ids.add(id);
    }
    for(const group of ['favorites','basket'])for(const [id,v] of Object.entries(value[group]||{}))if(ids.has(id)&&typeof v==='boolean')result[group][id]=v;
    for(const [key,v] of Object.entries(value.checked||{}))if(ids.has(key.split(':')[0])&&/^\w+:\d+$/.test(key)&&typeof v==='boolean')result.checked[key]=v;
    for(const [id,v] of Object.entries(value.photos||{}))if(ids.has(id)&&typeof v==='string'&&/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v))result.photos[id]=v;
    return result;
  }
  async function signOut(){try{await cloud.logout();prefs={...cleanShared(JSON.parse(localStorage.getItem(LOCAL_BACKUP)||'{}')),view:state.view};localStorage.setItem(KEY,JSON.stringify(prefs));if(dialog.open)dialog.close();route();toast('Вы вышли из книги');}catch(error){toast(error.message);}}
  function cloudStatus(){
    let button=$('#cloud-nav');if(!button){button=document.createElement('button');button.id='cloud-nav';button.className='cloud-nav';button.onclick=signOut;$('.header-inner nav').prepend(button);}
    button.hidden=!cloudState.authenticated;
    button.textContent='Выйти';button.title=cloudState.message||(cloudState.pending?'Изменения отправляются…':'Выйти из книги');button.classList.toggle('cloud-warning',!!cloudState.message||!!cloudState.conflicts.length);
    if($('#cloud-state'))$('#cloud-state').textContent=cloudState.message||(cloudState.pending?'Ожидают синхронизации: '+cloudState.pending:'Общие изменения сохранены.');
  }
  function cloudDialog(){
    if(!cloudState.authenticated){route();$('#site-email')?.focus();return;}
    if(!cloud?.enabled){showDialog(`<div class="dialog-heading"><h2 id="dialog-title">Общая книга</h2><button class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div><p>Подключение общей базы ещё настраивается. Текущие правки сохранены на устройстве.</p>`);return;}
    showDialog(`<div class="dialog-heading"><h2 id="dialog-title">Наша книга</h2><button class="icon-button close-dialog" aria-label="Закрыть">${icon('close')}</button></div>${cloudState.authenticated?`<p>Вы вошли как <strong>${esc(cloudState.user)}</strong>. Все изменения в этой книге общие для вас двоих. Синхронизация работает автоматически — ничего нажимать не нужно.</p><p id="cloud-state" role="status">${esc(cloudState.message||(cloudState.pending?'Ожидают синхронизации: '+cloudState.pending:'Общие изменения сохранены.'))}</p><div class="setting-actions"><button class="subtle-button" id="cloud-logout">Выйти</button></div>${cloudState.conflicts.length?`<h3>Одновременные правки</h3>${cloudState.conflicts.map((c,i)=>`<div class="cloud-conflict"><p>${esc(base.find(r=>r.id===c.item_key.split(':')[0])?.title||c.item_key)} · ${esc(c.kind)}</p><details><summary>Сравнить версии</summary><pre>${esc(JSON.stringify({моя:c.local,общая:c.remote.value},null,2))}</pre></details><button class="subtle-button" data-resolve-local="${i}">Оставить мою</button> <button class="subtle-button" data-resolve-remote="${i}">Принять общую</button></div>`).join('')}`:''}`:`<p>Войдите своим email и паролем, чтобы пользоваться общей книгой на телефоне и компьютере. Доступ есть только у вас двоих.</p><form id="cloud-login"><label class="form-label" for="cloud-email">Email</label><input class="form-input" type="email" id="cloud-email" autocomplete="username" required><label class="form-label" for="cloud-password">Пароль</label><input class="form-input" type="password" id="cloud-password" autocomplete="current-password" required><p id="cloud-login-error" role="alert"></p><div class="dialog-actions"><button class="primary-button" type="submit">Войти в общую книгу</button></div></form>`}`);
    if($('#cloud-login'))$('#cloud-login').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('[type=submit]');button.disabled=true;try{if(!localStorage.getItem(LOCAL_BACKUP))localStorage.setItem(LOCAL_BACKUP,JSON.stringify(prefs));await cloud.login($('#cloud-email').value.trim(),$('#cloud-password').value);dialog.close();cloudDialog();toast('Общая книга подключена');}catch(error){$('#cloud-login-error').textContent=error.message.includes('Invalid login')?'Проверьте email и пароль.':error.message;button.disabled=false;}};
    if($('#cloud-logout'))$('#cloud-logout').onclick=async()=>{try{await cloud.logout();prefs={...cleanShared(JSON.parse(localStorage.getItem(LOCAL_BACKUP)||'{}')),view:state.view};localStorage.setItem(KEY,JSON.stringify(prefs));dialog.close();route();toast('Вы вышли из общей книги');}catch(e){toast(e.message);}};
    dialog.querySelectorAll('[data-resolve-local],[data-resolve-remote]').forEach(button=>button.onclick=()=>{const local=button.hasAttribute('data-resolve-local');const index=Number(button.dataset.resolveLocal??button.dataset.resolveRemote);cloud.resolve(cloudState.conflicts[index].id,local);dialog.close();cloudDialog();});
  }
  dialog.addEventListener('close',()=>cloud?.endEdit());
  window.addEventListener('hashchange',()=>{route();window.scrollTo(0,0);});window.addEventListener('storage',e=>{if(e.key===KEY){try{prefs=JSON.parse(e.newValue)||prefs;header();route();}catch{}}});route();
  if(window.createRecipeCloud){
    try{if(!localStorage.getItem(LOCAL_BACKUP))localStorage.setItem(LOCAL_BACKUP,JSON.stringify(prefs));}catch{}
    cloud=window.createRecipeCloud({config:window.RECIPE_CLOUD_CONFIG,legacy(){try{return cleanShared(JSON.parse(localStorage.getItem(LOCAL_BACKUP)||'{}'));}catch{return {}; }},apply(value){prefs={...cleanShared(value),view:state.view};try{localStorage.setItem(KEY,JSON.stringify(prefs));}catch{}const searchFocused=document.activeElement?.id==='search';const pos=searchFocused?$('#search').selectionStart:null;if(!dialog.open){route();if(searchFocused){$('#search')?.focus();$('#search')?.setSelectionRange(pos,pos);}}},status(value){const changed=cloudState.authenticated!==value.authenticated;cloudState=value;cloudStatus();if(changed)route();}});void cloud.start().finally(()=>{authPending=false;route();});
  }else{authPending=false;route();}
})();
