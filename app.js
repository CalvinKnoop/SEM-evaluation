'use strict';
// SEM Circle Study v0.1 - no dependencies, no network transmission.
const APP_VERSION = '0.1.0';
const STORAGE_KEY = 'sem-circle-study-v01-data';
const TASKS = [
  { id:'calibration_01', src:'images/calibration_01.png', title:'Testbild 1 · Einfach', desc:'Isolierte Kugeln. Passe für jede erkennbare Kugel einen Kreis an.', difficulty:'einfach' },
  { id:'calibration_02', src:'images/calibration_02.png', title:'Testbild 2 · Mittel', desc:'Auch teilweise überlappte Kugeln können als volle Kreise annotiert werden.', difficulty:'mittel' },
  { id:'calibration_03', src:'images/calibration_03.png', title:'Testbild 3 · Schwer', desc:'Viele Partikel, Überlappungen und stärkeres Rauschen.', difficulty:'schwer' }
];
// Replace these demonstration images with authorized real SEM images before publication.
const REAL_TASKS = [
  {id:'demo_sem_01',src:'images/demo_sem_01.png', title:'Demo-Bildausschnitt A'},
  {id:'demo_sem_02',src:'images/demo_sem_02.png', title:'Demo-Bildausschnitt B'},
  {id:'demo_sem_03',src:'images/demo_sem_03.png', title:'Demo-Bildausschnitt C'}
];
const $ = (id) => document.getElementById(id);
const canvas = $('annotator');
const ctx = canvas.getContext('2d');
function newId() { return (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2); }
function emptyStore(){ return {participantId: newId(), sessionId:newId(), records:[], draft:null}; }
let saved;
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) { saved = null; }
const store = saved && Array.isArray(saved.records) && saved.participantId ? saved : emptyStore();
const st = {
  mode:'intro', index:0, task:null, image:null, circles:[], selected:null,
  drag:null, history:[], zoom:1, panX:0, panY:0, startedAt:Date.now(), nextId:1,
};
function persist(){
  try {
    if (st.task && (st.mode==='calibration' || st.mode==='real')) {
      store.draft={mode:st.mode,index:st.index,taskId:st.task.id,circles:st.circles,startedAt:st.startedAt};
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch(e){$('storageState').textContent='Speicher nicht verfügbar – bitte exportieren'; console.warn('localStorage:',e);}
}
function setVisible(which){
  $('introPanel').classList.toggle('hidden', which!=='intro');
  $('workPanel').classList.toggle('hidden', which!=='work');
  $('summaryPanel').classList.toggle('hidden', which!=='summary');
}
function taskForReal(){
  const counts = Object.fromEntries(REAL_TASKS.map(t=>[t.id,0]));
  store.records.forEach(r=>{if(r.mode==='real' && counts[r.image_id]!==undefined) counts[r.image_id]++;});
  const min = Math.min(...Object.values(counts));
  const candidates=REAL_TASKS.filter(t=>counts[t.id]===min);
  return candidates[Math.floor(Math.random()*candidates.length)];
}
function begin(mode,index,restoreDraft=false){
  st.mode=mode; st.index=index; st.task=mode==='calibration'?TASKS[index]:taskForReal();
  st.circles=restoreDraft && store.draft ? structuredClone(store.draft.circles) : [];
  st.selected=null;st.drag=null;st.history=[];st.zoom=1;st.panX=0;st.panY=0;
  st.nextId=1+Math.max(0,...st.circles.map(c=>c.id));
  st.startedAt=restoreDraft && store.draft?store.draft.startedAt:Date.now();
  setVisible('work');
  const isCal=mode==='calibration';
  $('stepEyebrow').textContent=isCal?`KALIBRIERUNG ${index+1} / 3`:'FREIWILLIGE ANNOTATION · UNBEGRENZT';
  $('imageHeading').textContent=st.task.title;
  $('imageDescription').textContent=isCal?st.task.desc:'Demonstrationsbild (noch kein echtes SEM). Du kannst beliebig viele weitere Bilder auswerten.';
  $('progressFill').style.width=isCal?`${(index+1)*100/3}%`:'100%';
  $('progressText').textContent=isCal?`${index+1} / 3`:'freiwillig';
  $('nextBtn').textContent=isCal?(index===2?'Kalibrierung auswerten →':'Test abschließen →'):'Speichern und nächstes Bild →';
  $('imageLoading').classList.remove('hidden');
  const pic=new Image();
  pic.onload=()=>{
    if(st.task && pic.src.endsWith(st.task.src)){
      st.image=pic; canvas.width=pic.naturalWidth;canvas.height=pic.naturalHeight;
      $('imageMeta').textContent=`${pic.naturalWidth} × ${pic.naturalHeight} px · ${st.task.id}`;
      $('imageLoading').classList.add('hidden'); render();updateInfo();persist();
    }
  };
  pic.onerror=()=>{$('imageLoading').textContent='Bild nicht gefunden: '+st.task.src;};
  st.image=null;pic.src=st.task.src;
}
function snapshot(){ st.history.push(st.circles.map(c=>({...c}))); if(st.history.length>80) st.history.shift(); }
function undo(){if(!st.history.length)return;st.circles=st.history.pop();if(!st.circles.some(c=>c.id===st.selected))st.selected=null;render();updateInfo();persist();}
function selectedCircle(){return st.circles.find(c=>c.id===st.selected)||null;}
function baseToCanvas(x,y){const w=canvas.width,h=canvas.height;return {x:(x-w/2)*st.zoom+w/2+st.panX,y:(y-h/2)*st.zoom+h/2+st.panY};}
function canvasToBase(x,y){const w=canvas.width,h=canvas.height;return {x:(x-w/2-st.panX)/st.zoom+w/2,y:(y-h/2-st.panY)/st.zoom+h/2};}
function pointerPosition(e){const rect=canvas.getBoundingClientRect();return canvasToBase((e.clientX-rect.left)*canvas.width/rect.width,(e.clientY-rect.top)*canvas.height/rect.height);}
function render(){
  if(!st.image)return;
  const w=canvas.width,h=canvas.height;
  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#182024';ctx.fillRect(0,0,w,h);
  const x0=w/2*(1-st.zoom)+st.panX, y0=h/2*(1-st.zoom)+st.panY;
  ctx.setTransform(st.zoom,0,0,st.zoom,x0,y0);ctx.imageSmoothingEnabled=true;ctx.drawImage(st.image,0,0);
  for(const c of st.circles){
    const selected = c.id===st.selected;
    ctx.beginPath();ctx.arc(c.x,c.y,Math.max(0.1,c.r),0,2*Math.PI);
    ctx.strokeStyle=selected?'#ffe05d':'#36f0c8';ctx.lineWidth=(selected?2.5:1.7)/st.zoom;ctx.stroke();
    ctx.beginPath();ctx.arc(c.x,c.y,3/st.zoom,0,2*Math.PI);ctx.fillStyle=selected?'#ffe05d':'#36f0c8';ctx.fill();
    ctx.font=`${Math.max(10/st.zoom,9/st.zoom)}px ui-sans-serif, sans-serif`;
    ctx.fillStyle='#fff';ctx.shadowColor='#000';ctx.shadowBlur=4/st.zoom;
    ctx.fillText(String(c.id),c.x+7/st.zoom,c.y-7/st.zoom);ctx.shadowBlur=0;
  }
  ctx.setTransform(1,0,0,1,0,0);
  $('zoomDisplay').textContent=`${Math.round(st.zoom*100)} %`;
}
function updateInfo(){
  $('circleCount').textContent=st.circles.length;
  const s=selectedCircle();
  $('selectionEmpty').classList.toggle('hidden',!!s);$('selectionValues').classList.toggle('hidden',!s);
  if(s){$('measureID').textContent=s.id;$('measureCenter').textContent=`${s.x.toFixed(2)} / ${s.y.toFixed(2)} px`;$('measureRadius').textContent=`${s.r.toFixed(2)} px`;}
  $('deleteBtn').disabled=!s;$('undoBtn').disabled=!st.history.length;
}
function hit(p){
  const threshold=9/st.zoom;
  for(let i=st.circles.length-1;i>=0;i--){const c=st.circles[i];if(Math.hypot(p.x-c.x,p.y-c.y)<threshold)return {circle:c,mode:'move'};}
  for(let i=st.circles.length-1;i>=0;i--){const c=st.circles[i];if(Math.abs(Math.hypot(p.x-c.x,p.y-c.y)-c.r)<threshold)return {circle:c,mode:'resize'};}
  return null;
}
function inBounds(p){return {x:Math.max(0,Math.min(canvas.width-1,p.x)),y:Math.max(0,Math.min(canvas.height-1,p.y))};}
canvas.addEventListener('pointerdown',e=>{
  if(!st.image)return;
  const p=pointerPosition(e);
  if(e.button===2 || e.altKey){st.drag={mode:'pan',at:p,startPanX:st.panX,startPanY:st.panY};}
  else if(e.button===0){
    const h=hit(p);
    if(h){snapshot();st.selected=h.circle.id;st.drag={mode:h.mode,start:p,prev:{...h.circle}};}
    else {
      if(p.x<0||p.y<0||p.x>=canvas.width||p.y>=canvas.height)return;
      snapshot();const c={id:st.nextId++,x:p.x,y:p.y,r:0};st.circles.push(c);st.selected=c.id;st.drag={mode:'create',start:p};
    }
  }else return;
  canvas.setPointerCapture(e.pointerId);e.preventDefault();render();updateInfo();
});
canvas.addEventListener('pointermove',e=>{
  if(!st.drag || !st.image)return;
  const p=pointerPosition(e),d=st.drag,s=selectedCircle();
  if(d.mode==='pan') {const first=baseToCanvas(d.at.x,d.at.y),curr=baseToCanvas(p.x,p.y);st.panX+=curr.x-first.x;st.panY+=curr.y-first.y;d.at=pointerPosition(e);}
  else if(s){
    if(d.mode==='create'||d.mode==='resize')s.r=Math.max(.2,Math.hypot(p.x-s.x,p.y-s.y));
    if(d.mode==='move') {const q=inBounds({x:d.prev.x+(p.x-d.start.x),y:d.prev.y+(p.y-d.start.y)});s.x=q.x;s.y=q.y;}
  }
  render();updateInfo();
});
function finishDrag(){
  if(!st.drag)return;
  if(st.drag.mode==='create'){const c=selectedCircle();if(c&&c.r<2)c.r=5;}
  st.drag=null;render();updateInfo();persist();
}
canvas.addEventListener('pointerup',finishDrag);
canvas.addEventListener('pointercancel',finishDrag);
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('wheel',e=>{
  if(st.mode!=='calibration' && st.mode!=='real')return;
  e.preventDefault();const s=selectedCircle();
  if(s){snapshot();s.r=Math.max(.2,s.r+(e.deltaY<0?1:-1)*(e.shiftKey?.1:1));}
  else setZoom(st.zoom*(e.deltaY<0?1.12:1/1.12));
  render();updateInfo();persist();
},{passive:false});
function setZoom(z){st.zoom=Math.max(.4,Math.min(8,z));render();}
$('zoomIn').onclick=()=>setZoom(st.zoom*1.25);$('zoomOut').onclick=()=>setZoom(st.zoom/1.25);
$('zoomReset').onclick=()=>{st.zoom=1;st.panX=0;st.panY=0;render();};
$('undoBtn').onclick=undo;
$('deleteBtn').onclick=()=>{const i=st.circles.findIndex(c=>c.id===st.selected);if(i<0)return;snapshot();st.circles.splice(i,1);st.selected=null;render();updateInfo();persist();};
document.addEventListener('keydown',e=>{
  if(st.mode!=='calibration' && st.mode!=='real')return;
  if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();return;}
  if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(st.zoom*1.25);return;}
  if(e.key==='-'){e.preventDefault();setZoom(st.zoom/1.25);return;}
  const s=selectedCircle();if(!s)return;
  if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('deleteBtn').click();return;}
  const step=e.shiftKey?.1:1;
  const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(moves[e.key]){e.preventDefault();snapshot();const [dx,dy]=moves[e.key];const q=inBounds({x:s.x+dx,y:s.y+dy});s.x=q.x;s.y=q.y;render();updateInfo();persist();}
});
function saveCurrent(){
  const rec={
    schema_version:1,app_version:APP_VERSION,participant_id:store.participantId,session_id:store.sessionId,
    annotation_id:newId(),mode:st.mode,image_id:st.task.id,image_file:st.task.src,
    width:canvas.width,height:canvas.height,started_at:new Date(st.startedAt).toISOString(),
    submitted_at:new Date().toISOString(),duration_seconds:Math.round((Date.now()-st.startedAt)/1000),
    overlap_rule:'last_circle_wins',coordinate_system:'pixel center at integer x,y, origin top left',
    circles:st.circles.map((c,i)=>({particle_id:c.id,center_x_px:Number(c.x.toFixed(3)),center_y_px:Number(c.y.toFixed(3)),radius_px:Number(c.r.toFixed(3)),draw_order:i}))
  };
  store.records.push(rec);store.draft=null;persist();return rec;
}
function scoreRecord(rec){
  const truths=window.CALIBRATION_TRUTH?.[rec.image_id]||[];
  const pairs=[];
  for(let i=0;i<rec.circles.length;i++)for(let j=0;j<truths.length;j++){
    const a=rec.circles[i],t=truths[j];const d=Math.hypot(a.center_x_px-t.center_x_px,a.center_y_px-t.center_y_px);
    const dr=Math.abs(a.radius_px-t.radius_px);
    if(d<Math.max(12,t.radius_px*.7) && dr<Math.max(8,t.radius_px*.7)) pairs.push({i,j,d,dr,cost:d/t.radius_px+dr/t.radius_px});
  }
  pairs.sort((a,b)=>a.cost-b.cost);
  const usedA=new Set(),usedT=new Set(),matches=[];
  for(const p of pairs){if(usedA.has(p.i)||usedT.has(p.j))continue;usedA.add(p.i);usedT.add(p.j);matches.push(p);}
  const mean=(arr)=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
  return {truth:truths.length,annotated:rec.circles.length,matched:matches.length,
    center_error_px:mean(matches.map(m=>m.d)),radius_abs_error_px:mean(matches.map(m=>m.dr)),
    missing:truths.length-matches.length,extra:rec.circles.length-matches.length};
}
function showSummary(){
  st.mode='summary';st.task=null;setVisible('summary');store.draft=null;persist();
  const cal=store.records.filter(r=>r.mode==='calibration'&&TASKS.some(t=>t.id===r.image_id)).slice(-3);
  const host=$('scoreGrid');host.textContent='';
  for(let i=0;i<3;i++){
    const rec=cal.find(r=>r.image_id===TASKS[i].id), val=rec?scoreRecord(rec):null;
    const article=document.createElement('article');
    const title=document.createElement('h3');title.textContent=`Test ${i+1} · ${TASKS[i].difficulty}`;
    const metric=document.createElement('div');metric.className='score';metric.textContent=val?`${val.matched} / ${val.truth}`:'—';
    const info=document.createElement('p');info.className='small';
    info.textContent=val?`Zugeordnete Kreise · ${val.missing} fehlend · ${val.extra} zusätzlich`:'Keine Ergebnisse';
    const error=document.createElement('p');error.className='small';
    error.textContent=val&&val.center_error_px!==null?`Mittelpunktsfehler ${val.center_error_px.toFixed(1)} px · Absoluter Radiusfehler ${val.radius_abs_error_px.toFixed(1)} px`:'Keine verwertbaren Zuordnungen';
    article.append(title,metric,info,error);host.append(article);
  }
}
$('nextBtn').addEventListener('click',()=>{
  if(!st.image)return;
  if(st.circles.length===0 && !confirm('Du hast keinen Kreis eingezeichnet. Bild wirklich ohne Kreise abschließen?'))return;
  saveCurrent();
  if(st.mode==='calibration') {if(st.index<2)begin('calibration',st.index+1);else showSummary();}
  else begin('real',st.index+1);
});
$('continueBtn').onclick=()=>begin('real',0);
function exportJSON(){
  const data={schema_version:1,app_version:APP_VERSION,exported_at:new Date().toISOString(),
    participant_id:store.participantId,session_id:store.sessionId,records:store.records,
    draft:store.draft?{...store.draft,warning:'Nicht abgeschlossene Annotation'}:null};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
  a.download=`sem_circle_annotations_${store.participantId.slice(0,8)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportAll').onclick=exportJSON;$('summaryExport').onclick=exportJSON;
$('startBtn').onclick=()=>{
  const d=store.draft;
  if(d && d.mode==='calibration' && TASKS[d.index]?.id===d.taskId) begin('calibration',d.index,true);
  else if(d && d.mode==='real')begin('real',0,false);
  else begin('calibration',0);
};
$('participantLabel').textContent=`Anonyme ID: ${store.participantId.slice(0,8)}…`;
if(store.draft?.mode==='calibration')$('startBtn').textContent='Angefangenen Test fortsetzen →';
else if(store.records.some(r=>r.mode==='calibration'&&r.image_id==='calibration_03')){
  $('startBtn').textContent='Neue Testserie starten →';
  // For a new round, preserve old records but create a new session.
  const start=$('startBtn').onclick;
  $('startBtn').onclick=()=>{store.sessionId=newId();store.draft=null;start();};
}
window.addEventListener('beforeunload',persist);
