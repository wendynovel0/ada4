'use strict';
const $=s=>document.querySelector(s);
const SYNC_URL=''; // Endpoint del backend (POST JSON). Vacío = sincronización simulada.
const ST={pendiente:'Pendiente',progreso:'En progreso',hecha:'Hecha'};
let tasks=[],filter='all',term='';

/* ---------- IndexedDB ---------- */
const open=()=>new Promise((res,rej)=>{const r=indexedDB.open('pendiente-db',1);
  r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('tasks',{keyPath:'id'});d.createObjectStore('outbox',{keyPath:'qid',autoIncrement:true})};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(store,mode,fn)=>{const db=await open();return new Promise((res,rej)=>{const t=db.transaction(store,mode),s=t.objectStore(store),q=fn(s);t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error)})};
const all=s=>tx(s,'readonly',o=>o.getAll());
async function save(t){t.updated=Date.now();await tx('tasks','readwrite',o=>o.put(t));await tx('outbox','readwrite',o=>o.add({op:'upsert',data:t,at:Date.now()}))}
async function remove(id){await tx('tasks','readwrite',o=>o.delete(id));await tx('outbox','readwrite',o=>o.add({op:'delete',id,at:Date.now()}))}

/* ---------- Sincronización ---------- */
async function flush(){
  if(!navigator.onLine)return;
  const q=await all('outbox');if(!q.length)return;
  try{
    if(SYNC_URL){const r=await fetch(SYNC_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(q)});if(!r.ok)throw 0}
    else await new Promise(r=>setTimeout(r,600));
    await tx('outbox','readwrite',o=>o.clear());toast(`${q.length} cambio(s) sincronizado(s)`);
  }catch{toast('No se pudo sincronizar; se reintentará')}
  badge();
}
async function badge(){$('#pend').textContent=(await all('outbox')).length}
async function requestSync(){const r=await navigator.serviceWorker?.ready;try{await r?.sync?.register('sync-tasks')}catch{}flush()}
function net(){const on=navigator.onLine,n=$('#net');n.textContent=on?'En línea':'Sin conexión';n.className='pill '+(on?'ok':'off');if(on)flush()}
addEventListener('online',net);addEventListener('offline',net);
navigator.serviceWorker?.addEventListener('message',e=>e.data==='sync'&&flush());

/* ---------- Render ---------- */
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=d=>d?new Date(d).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}):'Sin fecha';
const late=t=>t.due&&t.status!=='hecha'&&new Date(t.due)<new Date();
function render(){
  const list=tasks.filter(t=>(filter==='all'||t.status===filter)&&(t.title+t.desc).toLowerCase().includes(term));
  $('#board').innerHTML=Object.keys(ST).map(k=>{
    const items=list.filter(t=>t.status===k).sort((a,b)=>(a.due||'9').localeCompare(b.due||'9'));
    return `<section class="col"><h2>${ST[k]}<span class="muted">${items.length}</span></h2>${items.map(card).join('')||'<p class="empty">Sin actividades. Pulsa “Nueva actividad”.</p>'}</section>`}).join('');
  const n=k=>tasks.filter(t=>t.status===k).length,tot=tasks.length,done=n('hecha'),lt=tasks.filter(late).length;
  ['all','pendiente','progreso','hecha'].forEach(k=>$('#c-'+k).textContent=k==='all'?tot:n(k));
  const ring=(id,p,txt)=>{$(id).style.setProperty('--p',p);$(id).firstChild.textContent=txt};
  ring('#r-total',100,tot);ring('#r-done',tot?done/tot*100:0,(tot?Math.round(done/tot*100):0)+'%');
  ring('#r-prog',tot?n('progreso')/tot*100:0,n('progreso'));ring('#r-late',tot?lt/tot*100:0,lt);
  const up=tasks.filter(t=>t.due&&t.status!=='hecha').sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
  $('#upcoming').innerHTML=up.map(t=>`<li><span>${esc(t.title)}</span><b>${fmt(t.due)}</b></li>`).join('')||'<li class="muted">Nada programado</li>';
  $('#bars').innerHTML=['alta','media','baja'].map(p=>{const c=tasks.filter(t=>t.priority===p).length;return `<div class="bar"><span>${p}</span><div><i style="width:${tot?c/tot*100:0}%"></i></div><b>${c}</b></div>`}).join('');
}
const card=t=>`<article class="task ${t.priority} ${late(t)?'late':''}" data-id="${t.id}"><h3>${esc(t.title)}</h3>${t.desc?`<p>${esc(t.desc)}</p>`:''}<time>⏰ ${fmt(t.due)}${late(t)?' · vencida':''}</time>
<div class="tact"><button data-a="next">${t.status==='hecha'?'Reabrir':'Avanzar'}</button><button data-a="edit">Editar</button><button data-a="del">Eliminar</button></div></article>`;

/* ---------- Eventos ---------- */
$('#board').addEventListener('click',async e=>{
  const b=e.target.closest('button'),a=b?.closest('.task');if(!b)return;
  const t=tasks.find(x=>x.id===a.dataset.id),a_=b.dataset.a;
  if(a_==='del'){if(confirm('¿Eliminar esta actividad?')){await remove(t.id);toast('Actividad eliminada')}}
  else if(a_==='edit')return openForm(t);
  else{t.status=t.status==='pendiente'?'progreso':t.status==='progreso'?'hecha':'pendiente';t.notified=false;await save(t);toast('Estado: '+ST[t.status])}
  await load();requestSync();
});
function openForm(t){$('#dtitle').textContent=t?'Editar actividad':'Nueva actividad';
  $('#f-id').value=t?.id||'';$('#f-title').value=t?.title||'';$('#f-desc').value=t?.desc||'';$('#f-due').value=t?.due||'';
  $('#f-pri').value=t?.priority||'media';$('#f-st').value=t?.status||'pendiente';$('#dlg').showModal();$('#f-title').focus()}
$('#add').onclick=()=>openForm();$('#cancel').onclick=()=>$('#dlg').close();
$('#form').addEventListener('submit',async()=>{
  const id=$('#f-id').value,old=tasks.find(x=>x.id===id)||{};
  await save({...old,id:id||crypto.randomUUID(),title:$('#f-title').value.trim(),desc:$('#f-desc').value.trim(),due:$('#f-due').value,priority:$('#f-pri').value,status:$('#f-st').value,notified:false,created:old.created||Date.now()});
  toast(id?'Actividad actualizada':'Actividad guardada');await load();requestSync();ask();
});
$('#nav').onclick=e=>{const b=e.target.closest('button');if(!b)return;filter=b.dataset.f;[...$('#nav').children].forEach(x=>x.classList.toggle('on',x===b));render()};
$('#q').oninput=e=>{term=e.target.value.toLowerCase();render()};
$('#sync').onclick=flush;
$('#theme').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');
function setTheme(t){document.documentElement.dataset.theme=t;document.querySelector('meta[name=theme-color]').content=t==='dark'?'#161616':'#6c5ce7';try{localStorage.setItem('theme',t)}catch{}}
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2600)}

/* ---------- Notificaciones ---------- */
async function ask(){if('Notification'in window&&Notification.permission==='default'){await Notification.requestPermission();bell()}}
function bell(){if('Notification'in window)$('#bell').style.opacity=Notification.permission==='granted'?1:.5}
$('#bell').onclick=async()=>{await ask();toast(Notification?.permission==='granted'?'Notificaciones activadas':'Permiso de notificaciones no concedido')};
async function check(){
  if(!('Notification'in window)||Notification.permission!=='granted')return;
  const reg=await navigator.serviceWorker?.ready;
  for(const t of tasks){if(t.due&&!t.notified&&t.status!=='hecha'&&new Date(t.due)<=new Date()){
    t.notified=true;await tx('tasks','readwrite',o=>o.put(t));
    const o={body:t.desc||'Tienes una actividad por atender',icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:t.id};
    reg?reg.showNotification('⏰ '+t.title,o):new Notification('⏰ '+t.title,o)}}
  render();
}

/* ---------- Inicio ---------- */
async function load(){tasks=await all('tasks');render();badge()}
let deferred;addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#install').hidden=false});
$('#install').onclick=async()=>{deferred?.prompt();deferred=null;$('#install').hidden=true};
(async()=>{
  try{setTheme(localStorage.getItem('theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'))}catch{}
  const h=new Date().getHours();$('#hello').textContent=(h<12?'Buenos días':h<19?'Buenas tardes':'Buenas noches')+' 👋';
  if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  net();bell();await load();if(/[?net();bell();await load();check();]new/.test(location.search))openForm();check();setInterval(check,30000);flush();
})();
