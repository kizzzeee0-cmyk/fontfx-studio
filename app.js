(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const canvas = $('designCanvas');
  const shell = $('canvasShell');
  const viewport = $('canvasViewport');
  const ctx = canvas.getContext('2d', { alpha: true });
  const DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));

  const BLENDS = [
    ['normal','일반'],['multiply','곱하기'],['screen','스크린'],['overlay','오버레이'],
    ['soft-light','소프트 라이트'],['hard-light','하드 라이트'],['color-dodge','색상 닷지'],
    ['color-burn','색상 번'],['difference','차이'],['lighter','더 밝게']
  ];
  const CONTOURS = [
    ['linear','선형'],['soft','부드럽게'],['hard','단단하게'],['round','둥글게'],['steep','가파르게']
  ];
  const STROKE_POSITIONS = [['outside','외부'],['center','중앙'],['inside','내부']];

  const PALETTES = [
    ['Lavender Dawn',['#E9E5FF','#CFC7FA','#AFA4ED','#9389DE','#6F66C5']],
    ['Soft Pink',['#FFF0F5','#FFD9E8','#F9B6CE','#E98FB0','#C96A91']],
    ['Blue Milk',['#F0F7FF','#D7E9FF','#B7D6FA','#8FB8EC','#6B91CC']],
    ['Mint Cream',['#F0FFF9','#D3F6E8','#ACE8D1','#7DD0B3','#52A88F']],
    ['Peach Soda',['#FFF4EC','#FFDCC7','#F7B995','#EA916B','#C96A4D']],
    ['Butter Pastel',['#FFFBEA','#FFF1B8','#F8DC85','#EAC55C','#CDA33D']],
    ['Berry Yogurt',['#FFF0F7','#F5C8DE','#E79DBF','#D476A4','#A9507D']],
    ['Cool Gray',['#F7F7FA','#E4E5EC','#C5C7D2','#999CAC','#676B7C']],
    ['Sky + Lemon',['#EAF7FF','#BFE8FF','#8DD4F5','#FFF2A8','#F5D76B']],
    ['Lilac + Mint',['#EFEAFF','#CFC4F6','#A99DE5','#D8F6E9','#9DDEC4']],
    ['Coral + Cream',['#FFF5ED','#FFDCCB','#F3A88B','#E27A67','#F6E7C8']],
    ['Night Pastel',['#26273A','#4C4E6C','#777CA0','#AAB0D4','#E6E8F6']],
    ['Cherry Milk',['#FFF1F2','#FFD5D9','#F5A5AE','#E57380','#B94D5C']],
    ['Aqua Candy',['#E9FFFF','#C6F6F3','#8FE3DF','#58C7C2','#3A9E9B']],
    ['Mocha Rose',['#F9F0EB','#E7CFC3','#CCA897','#B38278','#805C58']],
    ['Black + Pastel',['#1E1E24','#3A3944','#9389DE','#F6B7CC','#F7F2EA']]
  ];

  const state = {
    project: { width: 1200, height: 1200, name: 'fontfx-design' },
    chars: [],
    groups: [],
    selectedIds: new Set(),
    activeId: null,
    zoom: 1,
    zoomMode: 'fit',
    previewDpr: 1,
    customFonts: [],
    fontRegistry: {},
    interaction: null,
    groupMove: true,
    groupEffectEdit: true,
    styleClipboard: null,
    effectPresets: { strokes: [], shadows: [] },
    drawings: [],
    drawTool: { enabled: false, color: '#FF5AA5', size: 18, aboveText: true, stabilize: 0.88, brushType: 'pen', assistMode: 'freehand' },
    history: [],
    historyIndex: -1,
    suppressHistory: false
  };

  const surfaceCache = new Map();
  const groupEffectCache = new Map();
  const EFFECT_PRESET_STORAGE_KEY = 'fontfx.effectPresets.v1';
  const FONT_DB_NAME = 'fontfx.savedFonts.v1';
  const FONT_DB_STORE = 'fonts';
  let toastTimer = null;
  let historyTimer = null;

  function uid(prefix='id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  }
  function clamp(v,min,max){ return Math.min(max,Math.max(min,v)); }
  function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }
  function activeChar(){ return state.chars.find(c => c.id === state.activeId) || null; }
  function charById(id){ return state.chars.find(c => c.id === id) || null; }
  function groupById(id){ return state.groups.find(g => g.id === id) || null; }
  function groupMembers(groupId){ return groupId ? state.chars.filter(c => c.groupId === groupId) : []; }
  function currentGroup(){ const c=activeChar(); return c&&c.groupId ? groupById(c.groupId) : null; }
  function charStyleSnapshot(ch){ return {fontFamily:ch.fontFamily,fontSize:ch.fontSize,fontWeight:ch.fontWeight,fill:ch.fill,fillMode:ch.fillMode||'solid',gradient:deepClone(ch.gradient||defaultGradient(ch.fill)),scale:ch.scale||1,scaleX:ch.scaleX||1,scaleY:ch.scaleY||1,skewX:ch.skewX||0,skewY:ch.skewY||0,strokes:deepClone(ch.strokes||[]),innerShadows:deepClone(ch.innerShadows||[])}; }
  function applyStyleSnapshot(ch,snap){ if(!ch||!snap)return; ch.fontFamily=snap.fontFamily; ch.fontSize=snap.fontSize; ch.fontWeight=snap.fontWeight; ch.fill=snap.fill; ch.fillMode=snap.fillMode||'solid'; ch.gradient=deepClone(snap.gradient||defaultGradient(snap.fill)); ch.scale=snap.scale||1; ch.scaleX=snap.scaleX||1; ch.scaleY=snap.scaleY||1; ch.skewX=snap.skewX||0; ch.skewY=snap.skewY||0; ch.strokes=deepClone(snap.strokes||[]); ch.innerShadows=deepClone(snap.innerShadows||[]); markDirty(ch); }
  function markDirty(ch){ if(ch) ch.cacheVersion = (ch.cacheVersion || 0) + 1; }
  function markManyDirty(chars){ chars.forEach(markDirty); }
  function clearRuntimeCaches(){ surfaceCache.clear(); groupEffectCache.clear(); }
  function cacheMapSet(map,key,value,max=120){ map.set(key,value); if(map.size>max){ const first=map.keys().next().value; map.delete(first); } return value; }
  function normalizeHexInput(v,fallback='#000000'){ const hex=String(v||'').trim(); return /^#?[0-9a-fA-F]{6}$/.test(hex) ? ('#'+hex.replace('#','')).toUpperCase() : fallback; }
  function renderScheduled(){ if(renderScheduled._raf) return; renderScheduled._raf=requestAnimationFrame(()=>{ renderScheduled._raf=0; render(); }); }

  function openFontDb(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB unavailable'));return;}
      const req=indexedDB.open(FONT_DB_NAME,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(FONT_DB_STORE))db.createObjectStore(FONT_DB_STORE,{keyPath:'name'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB open failed'));
    });
  }
  async function saveFontRecord(record){
    try{const db=await openFontDb();await new Promise((resolve,reject)=>{const tx=db.transaction(FONT_DB_STORE,'readwrite');tx.objectStore(FONT_DB_STORE).put(record);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});db.close();return true;}catch(e){console.warn('[FontFX font save]',e);return false;}
  }
  async function deleteFontRecord(name){
    try{const db=await openFontDb();await new Promise((resolve,reject)=>{const tx=db.transaction(FONT_DB_STORE,'readwrite');tx.objectStore(FONT_DB_STORE).delete(name);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});db.close();}catch(e){console.warn('[FontFX font delete]',e);}
  }
  async function getSavedFontRecords(){
    try{const db=await openFontDb();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction(FONT_DB_STORE,'readonly');const req=tx.objectStore(FONT_DB_STORE).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});db.close();return rows;}catch(e){console.warn('[FontFX font restore]',e);return[];}
  }
  async function restoreSavedFonts(){
    const rows=await getSavedFontRecords(); let restored=0,failed=0;
    for(const rec of rows){
      try{
        const name=cleanFamilyName(rec.name); if(!name)continue; disposeFontResource(name);
        if(rec.type==='local'&&rec.data){const data=rec.data instanceof ArrayBuffer?rec.data:await rec.data.arrayBuffer?.();const ff=new FontFace(name,data);await ff.load();document.fonts.add(ff);state.fontRegistry[name]={type:'local',fontFace:ff};registerFont(name,'local',{saved:true,fileName:rec.fileName||''});restored++;}
        else if(rec.type==='url'&&rec.url){const ff=new FontFace(name,`url("${String(rec.url).replace(/"/g,'%22')}")`);await ff.load();document.fonts.add(ff);state.fontRegistry[name]={type:'url',fontFace:ff};registerFont(name,'url',{url:rec.url,saved:true});restored++;}
        else if(rec.type==='css'){
          if(rec.cssText){const style=injectCssText(rec.cssText,name);state.fontRegistry[name]={type:'css',style};registerFont(name,'css',{url:rec.url||'',cssText:rec.cssText,sourceMethod:rec.sourceMethod||'saved-css',saved:true});restored++;}
          else if(rec.url){const loaded=await loadCssLink(rec.url,7000);state.fontRegistry[name]={type:'css',link:loaded.link};registerFont(name,'css',{url:rec.url,cssText:'',sourceMethod:'saved-link',saved:true});restored++;}
        }
      }catch(e){failed++;console.warn('[FontFX restore font]',rec&&rec.name,e);}
    }
    refreshFontSelects();
    if(restored) setFontLoadStatus(`✓ 저장된 폰트 ${restored}개를 자동 복원했습니다.${failed?` (${failed}개 복원 실패)`:''}`,'ok');
  }

  function normalizeEffectPresetLibrary(value){
    const v=value&&typeof value==='object'?value:{};
    return {strokes:Array.isArray(v.strokes)?v.strokes:[],shadows:Array.isArray(v.shadows)?v.shadows:[]};
  }
  function loadEffectPresets(){
    try{state.effectPresets=normalizeEffectPresetLibrary(JSON.parse(localStorage.getItem(EFFECT_PRESET_STORAGE_KEY)||'{}'));}
    catch(_){state.effectPresets={strokes:[],shadows:[]};}
  }
  function persistEffectPresets(){
    try{localStorage.setItem(EFFECT_PRESET_STORAGE_KEY,JSON.stringify(state.effectPresets));}
    catch(_){toast('브라우저 저장공간에 프리셋을 저장하지 못했습니다.');}
  }
  function effectPresetBucket(type){return type==='stroke'?state.effectPresets.strokes:state.effectPresets.shadows;}
  function effectArrayOf(target,type){return type==='stroke'?(target.strokes||[]):(target.innerShadows||[]);}
  function effectPresetSource(type){
    const scope=currentEffectScope(); if(!scope)return null;
    if(scope.type==='group')return scope.group;
    return activeChar();
  }
  function stripEffectIds(items){return deepClone(items||[]).map(item=>{delete item.id;return item;});}
  function instantiateEffectPreset(type,items){return (items||[]).map(item=>({...deepClone(item),id:uid(type==='stroke'?'stroke':'shadow')}));}
  function mergeEffectPresets(incoming){
    const inc=normalizeEffectPresetLibrary(incoming);
    for(const key of ['strokes','shadows']){
      for(const preset of inc[key]){
        if(!preset||!preset.name||!Array.isArray(preset.items))continue;
        const bucket=state.effectPresets[key], existing=bucket.find(x=>x.id===preset.id||String(x.name).toLowerCase()===String(preset.name).toLowerCase());
        if(existing)Object.assign(existing,deepClone(preset)); else bucket.push(deepClone(preset));
      }
    }
    persistEffectPresets();renderAllEffectPresetControls();
  }
  function renderEffectPresetControls(type){
    const isStroke=type==='stroke', select=$(isStroke?'strokePresetSelect':'shadowPresetSelect'); if(!select)return;
    const previous=select.value, bucket=effectPresetBucket(type); select.innerHTML='';
    const empty=document.createElement('option');empty.value='';empty.textContent=bucket.length?(isStroke?'획 프리셋 선택':'그림자 프리셋 선택'):(isStroke?'저장된 획 프리셋 없음':'저장된 그림자 프리셋 없음');select.appendChild(empty);
    bucket.slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'ko')).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=`${p.name} · ${p.items.length}개`;select.appendChild(o);});
    if([...select.options].some(o=>o.value===previous))select.value=previous;
  }
  function renderAllEffectPresetControls(){renderEffectPresetControls('stroke');renderEffectPresetControls('shadow');}
  function saveEffectPreset(type){
    const isStroke=type==='stroke', source=effectPresetSource(type); if(!source){toast('먼저 글자 또는 그룹을 선택하세요.');return;}
    const items=effectArrayOf(source,type); if(!items.length){toast(isStroke?'저장할 획이 없습니다.':'저장할 내부 그림자가 없습니다.');return;}
    const input=$(isStroke?'strokePresetName':'shadowPresetName'), name=String(input.value||'').trim(); if(!name){toast('프리셋 이름을 입력하세요.');input.focus();return;}
    const bucket=effectPresetBucket(type), existing=bucket.find(p=>String(p.name).toLowerCase()===name.toLowerCase());
    const data={id:existing?.id||uid(isStroke?'strokePreset':'shadowPreset'),name,items:stripEffectIds(items),updatedAt:new Date().toISOString()};
    if(existing)Object.assign(existing,data);else bucket.push(data);
    persistEffectPresets();renderEffectPresetControls(type);$(isStroke?'strokePresetSelect':'shadowPresetSelect').value=data.id;toast(`“${name}” ${isStroke?'획':'내부 그림자'} 프리셋을 ${existing?'덮어썼습니다':'저장했습니다'}.`);
  }
  function applyEffectPreset(type){
    const isStroke=type==='stroke', select=$(isStroke?'strokePresetSelect':'shadowPresetSelect'), preset=effectPresetBucket(type).find(p=>p.id===select.value); if(!preset){toast('적용할 프리셋을 선택하세요.');return;}
    const scope=currentEffectScope();if(!scope){toast('먼저 글자 또는 그룹을 선택하세요.');return;}
    const base=instantiateEffectPreset(type,preset.items), prop=isStroke?'strokes':'innerShadows';
    if(scope.type==='group'){scope.group[prop]=deepClone(base);}else{scope.chars.forEach(ch=>{ch[prop]=deepClone(base);markDirty(ch);});}
    clearRuntimeCaches();updateInspector();render();pushHistory();toast(`“${preset.name}” 프리셋을 적용했습니다.`);
  }
  function deleteEffectPreset(type){
    const isStroke=type==='stroke', select=$(isStroke?'strokePresetSelect':'shadowPresetSelect'), bucket=effectPresetBucket(type), ix=bucket.findIndex(p=>p.id===select.value); if(ix<0){toast('삭제할 프리셋을 선택하세요.');return;}
    const name=bucket[ix].name;bucket.splice(ix,1);persistEffectPresets();renderEffectPresetControls(type);toast(`“${name}” 프리셋을 삭제했습니다.`);
  }
  function toast(msg){
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>el.classList.remove('show'),2200);
  }
  function sanitizeFilename(name){
    return String(name || 'fontfx').replace(/[\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ').trim() || 'fontfx';
  }
  function normalizeHex(value, fallback='#000000'){
    let v = String(value || '').trim(); if(!v.startsWith('#')) v = '#'+v;
    if(/^#[0-9a-fA-F]{6}$/.test(v)) return v.toUpperCase();
    if(/^#[0-9a-fA-F]{3}$/.test(v)) return '#'+v.slice(1).split('').map(x=>x+x).join('').toUpperCase();
    return fallback.toUpperCase();
  }
  function hexToRgb(hex){ const h=normalizeHex(hex).slice(1); return {r:parseInt(h.slice(0,2),16),g:parseInt(h.slice(2,4),16),b:parseInt(h.slice(4,6),16)}; }
  function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>clamp(Math.round(v),0,255).toString(16).padStart(2,'0')).join('').toUpperCase(); }
  function rgbToHsl(r,g,b){
    r/=255;g/=255;b/=255; const max=Math.max(r,g,b),min=Math.min(r,g,b); let h=0,s=0,l=(max+min)/2;
    if(max!==min){ const d=max-min; s=l>.5?d/(2-max-min):d/(max+min); switch(max){case r:h=(g-b)/d+(g<b?6:0);break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4;} h*=60; }
    return {h,s:s*100,l:l*100};
  }
  function hslToRgb(h,s,l){
    h=((h%360)+360)%360; s/=100;l/=100; const c=(1-Math.abs(2*l-1))*s; const x=c*(1-Math.abs((h/60)%2-1)); const m=l-c/2; let rp=0,gp=0,bp=0;
    if(h<60){rp=c;gp=x}else if(h<120){rp=x;gp=c}else if(h<180){gp=c;bp=x}else if(h<240){gp=x;bp=c}else if(h<300){rp=x;bp=c}else{rp=c;bp=x}
    return {r:(rp+m)*255,g:(gp+m)*255,b:(bp+m)*255};
  }
  function hslHex(h,s,l){ const c=hslToRgb(h,s,l); return rgbToHex(c.r,c.g,c.b); }

  function makeHarmony(hex){
    const {r,g,b}=hexToRgb(hex); const h=rgbToHsl(r,g,b);
    const sat=clamp(h.s,28,72); const pastelL=clamp(Math.max(h.l,74),74,88);
    return [
      normalizeHex(hex),
      hslHex(h.h, sat, pastelL),
      hslHex(h.h+30, clamp(sat-3,25,75), clamp(pastelL+2,70,92)),
      hslHex(h.h-30, clamp(sat-5,22,72), clamp(pastelL+4,72,94)),
      hslHex(h.h+180, clamp(sat-10,20,65), clamp(pastelL+1,70,91)),
      hslHex(h.h+150, clamp(sat-8,20,68), clamp(pastelL+3,72,92)),
      hslHex(h.h, clamp(sat+8,25,85), clamp(h.l-22,24,58)),
      hslHex(h.h, clamp(sat-18,10,52), 96)
    ];
  }
  function makeBevelRecommendations(hex){
    const {r,g,b}=hexToRgb(hex); const h=rgbToHsl(r,g,b);
    const highlight=[
      hslHex(h.h, clamp(h.s-12,8,70), clamp(h.l+18,62,96)),
      hslHex(h.h-6, clamp(h.s-18,8,70), clamp(h.l+26,70,98)),
      hslHex(h.h+10, clamp(h.s-8,10,75), clamp(h.l+12,58,90)),
      hslHex(h.h, clamp(h.s-26,8,42), 97),
      hslHex(h.h+18, clamp(h.s-15,10,68), clamp(h.l+22,68,96))
    ];
    const shadow=[
      hslHex(h.h-2, clamp(h.s+8,20,85), clamp(h.l-18,10,62)),
      hslHex(h.h+6, clamp(h.s+2,18,82), clamp(h.l-26,8,56)),
      hslHex(h.h-12, clamp(h.s+10,22,88), clamp(h.l-34,6,46)),
      hslHex(h.h+180, clamp(h.s-8,10,40), clamp(h.l-8,14,55)),
      hslHex(h.h, clamp(h.s+14,18,90), clamp(h.l-42,6,36))
    ];
    return {highlight,shadow};
  }

  function defaultGradient(base='#9389DE'){
    const b=normalizeHex(base,'#9389DE'); const rec=makeBevelRecommendations(b);
    return {angle:90,range:100,centerX:50,centerY:50,stops:[
      {id:uid('gstop'),position:0,color:rec.highlight[1]},
      {id:uid('gstop'),position:48,color:b},
      {id:uid('gstop'),position:100,color:rec.shadow[0]}
    ]};
  }
  function ensureGradient(ch){
    if(!ch.fillMode) ch.fillMode='solid';
    if(!ch.gradient||!Array.isArray(ch.gradient.stops)||ch.gradient.stops.length<2) ch.gradient=defaultGradient(ch.fill||'#9389DE');
    ch.gradient.angle=Number.isFinite(Number(ch.gradient.angle))?Number(ch.gradient.angle):90;
    ch.gradient.range=clamp(Number(ch.gradient.range)||100,1,600);
    ch.gradient.centerX=Number.isFinite(Number(ch.gradient.centerX))?clamp(Number(ch.gradient.centerX),-300,300):50;
    ch.gradient.centerY=Number.isFinite(Number(ch.gradient.centerY))?clamp(Number(ch.gradient.centerY),-300,300):50;
    ch.gradient.stops=ch.gradient.stops.map((st,i)=>({id:st.id||uid('gstop'),position:clamp(Number(st.position),0,100),color:normalizeHex(st.color||ch.fill||'#9389DE')}));
    return ch.gradient;
  }
  function gradientStyle(g,ch,w,h){
    if((ch.fillMode||'solid')==='solid') return ch.fill;
    const gr=ensureGradient(ch), cx=w*(gr.centerX/100), cy=h*(gr.centerY/100), maxDim=Math.max(w,h), range=Math.max(1,maxDim*(gr.range/100));
    let paint;
    if(ch.fillMode==='radial'){
      paint=g.createRadialGradient(cx,cy,0,cx,cy,Math.max(1,range/2));
    }else{
      const a=(gr.angle||0)*Math.PI/180, dx=Math.cos(a)*range/2, dy=Math.sin(a)*range/2;
      paint=g.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
    }
    [...gr.stops].sort((a,b)=>a.position-b.position).forEach(st=>paint.addColorStop(clamp(st.position/100,0,1),normalizeHex(st.color,ch.fill||'#9389DE')));
    return paint;
  }

  function blendToCanvas(mode){ return mode === 'normal' ? 'source-over' : mode; }
  function splitGraphemes(text){
    if(window.Intl && Intl.Segmenter){ return [...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)].map(s=>s.segment); }
    return Array.from(text);
  }
  function fontCss(ch){ return `${ch.fontWeight || 700} ${ch.fontSize}px "${String(ch.fontFamily).replace(/"/g,'')}"`; }

  function measureChar(ch){
    const mctx = measureChar.ctx || (measureChar.ctx = document.createElement('canvas').getContext('2d'));
    mctx.font = fontCss(ch); const m = mctx.measureText(ch.text || ' ');
    const asc = m.actualBoundingBoxAscent || ch.fontSize*.78;
    const desc = m.actualBoundingBoxDescent || ch.fontSize*.22;
    const width = Math.max(2, m.width);
    const maxStroke = Math.max(0,...(ch.strokes||[]).map(s => s.position === 'center' ? s.width*.5 : s.width));
    return { width, height: asc+desc, ascent:asc, descent:desc, pad:maxStroke+Math.max(10,ch.fontSize*.08) };
  }

  function contourTransform(a, contour, choke){
    let v = clamp(a,0,1);
    if(choke>0){ const t=clamp(choke/100,0,.95); v = clamp((v-t)/(1-t),0,1); }
    switch(contour){
      case 'soft': return v*v;
      case 'hard': return Math.pow(v,.55);
      case 'round': return .5-.5*Math.cos(v*Math.PI);
      case 'steep': return v<.5 ? 2*v*v : 1-Math.pow(-2*v+2,2)/2;
      default:return v;
    }
  }

  function buildGlyphMask(ch, logicalW, logicalH, pad, q){
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(logicalW*q)); c.height=Math.max(1,Math.ceil(logicalH*q));
    const g=c.getContext('2d'); g.scale(q,q); g.font=fontCss(ch); g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff';
    g.fillText(ch.text,logicalW/2,logicalH/2);
    return c;
  }

  function renderCharSurface(ch, quality=2){
    const q = clamp(quality,1,6);
    const key = `${ch.id}|${ch.cacheVersion||0}|${q.toFixed(2)}`;
    if(surfaceCache.has(key)) return surfaceCache.get(key);
    const m=measureChar(ch); const pad=m.pad + Math.max(2,...(ch.innerShadows||[]).map(s=>Math.max(0,s.size*.12)));
    const logicalW=Math.ceil(m.width+pad*2+4), logicalH=Math.ceil(m.height+pad*2+4);
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(logicalW*q)); c.height=Math.max(1,Math.ceil(logicalH*q));
    const g=c.getContext('2d'); g.scale(q,q); g.font=fontCss(ch); g.textAlign='center'; g.textBaseline='middle'; g.lineJoin='round'; g.lineCap='round';
    const x=logicalW/2, y=logicalH/2;
    const strokes=(ch.strokes||[]).filter(s=>s.enabled!==false);
    const outside=strokes.filter(s=>s.position==='outside');
    const center=strokes.filter(s=>s.position==='center');
    const inside=strokes.filter(s=>s.position==='inside');

    for(let i=outside.length-1;i>=0;i--){ const s=outside[i]; g.save(); g.globalAlpha=clamp(s.opacity/100,0,1); g.globalCompositeOperation=blendToCanvas(s.blend); g.strokeStyle=s.color; g.lineWidth=Math.max(.1,s.width*2); g.strokeText(ch.text,x,y); g.restore(); }
    g.save(); g.globalCompositeOperation='source-over'; g.globalAlpha=1; g.fillStyle=gradientStyle(g,ch,logicalW,logicalH); g.fillText(ch.text,x,y); g.restore();
    for(let i=center.length-1;i>=0;i--){ const s=center[i]; g.save(); g.globalAlpha=clamp(s.opacity/100,0,1); g.globalCompositeOperation=blendToCanvas(s.blend); g.strokeStyle=s.color; g.lineWidth=Math.max(.1,s.width); g.strokeText(ch.text,x,y); g.restore(); }

    if(inside.length){
      const mask=buildGlyphMask(ch,logicalW,logicalH,pad,q);
      for(let i=inside.length-1;i>=0;i--){
        const s=inside[i]; const layer=document.createElement('canvas'); layer.width=c.width; layer.height=c.height; const lg=layer.getContext('2d');
        lg.scale(q,q); lg.font=fontCss(ch); lg.textAlign='center'; lg.textBaseline='middle'; lg.lineJoin='round'; lg.strokeStyle=s.color; lg.globalAlpha=clamp(s.opacity/100,0,1); lg.lineWidth=Math.max(.1,s.width*2); lg.strokeText(ch.text,x,y);
        lg.setTransform(1,0,0,1,0,0); lg.globalCompositeOperation='destination-in'; lg.globalAlpha=1; lg.drawImage(mask,0,0);
        g.save(); g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation=blendToCanvas(s.blend); g.drawImage(layer,0,0); g.restore(); g.setTransform(q,0,0,q,0,0);
      }
    }

    const shadows=(ch.innerShadows||[]).filter(s=>s.enabled!==false && s.opacity>0);
    if(shadows.length){
      const mask=buildGlyphMask(ch,logicalW,logicalH,pad,q);
      const mg=mask.getContext('2d'); const maskData=mg.getImageData(0,0,mask.width,mask.height); const ma=maskData.data;
      for(const s of shadows){
        const shifted=document.createElement('canvas'); shifted.width=mask.width; shifted.height=mask.height; const sg=shifted.getContext('2d');
        const rad=(s.angle||0)*Math.PI/180; const dx=Math.cos(rad)*(s.distance||0)*q; const dy=Math.sin(rad)*(s.distance||0)*q;
        sg.save(); sg.filter=`blur(${Math.max(0,(s.size||0)*q)}px)`; sg.drawImage(mask,dx,dy); sg.restore();
        const bd=sg.getImageData(0,0,shifted.width,shifted.height).data;
        const layer=document.createElement('canvas'); layer.width=mask.width; layer.height=mask.height; const lg=layer.getContext('2d'); const out=lg.createImageData(layer.width,layer.height); const od=out.data; const rgb=hexToRgb(s.color);
        const qualityBoost=clamp((s.quality||3)/3,.5,1.7);
        for(let p=0;p<od.length;p+=4){
          const mAlpha=ma[p+3]/255; if(mAlpha===0) continue;
          const shiftedAlpha=bd[p+3]/255;
          let edge = mAlpha * (1-shiftedAlpha);
          edge = contourTransform(edge,s.contour||'linear',s.choke||0);
          edge = clamp(edge*qualityBoost,0,1);
          od[p]=rgb.r;od[p+1]=rgb.g;od[p+2]=rgb.b;od[p+3]=Math.round(255*edge*clamp(s.opacity/100,0,1));
        }
        lg.putImageData(out,0,0);
        g.save(); g.setTransform(1,0,0,1,0,0); g.globalCompositeOperation=blendToCanvas(s.blend); g.drawImage(layer,0,0); g.restore(); g.setTransform(q,0,0,q,0,0);
      }
    }

    const result={canvas:c,logicalW,logicalH,pad};
    surfaceCache.set(key,result);
    if(surfaceCache.size>180){ const first=surfaceCache.keys().next().value; surfaceCache.delete(first); }
    return result;
  }

  function applyCharTransform(targetCtx,ch){
    const sx=(ch.scale||1)*(ch.scaleX||1), sy=(ch.scale||1)*(ch.scaleY||1), kx=Math.tan((ch.skewX||0)*Math.PI/180), ky=Math.tan((ch.skewY||0)*Math.PI/180);
    targetCtx.translate(ch.x,ch.y); targetCtx.rotate((ch.angle||0)*Math.PI/180); targetCtx.transform(1,ky,kx,1,0,0); targetCtx.scale(sx,sy);
  }
  function charAffine(ch){
    const a=(ch.angle||0)*Math.PI/180, ca=Math.cos(a), sa=Math.sin(a), sx=(ch.scale||1)*(ch.scaleX||1), sy=(ch.scale||1)*(ch.scaleY||1), kx=Math.tan((ch.skewX||0)*Math.PI/180), ky=Math.tan((ch.skewY||0)*Math.PI/180);
    return {a:sx*(ca-sa*ky), b:sx*(sa+ca*ky), c:sy*(ca*kx-sa), d:sy*(sa*kx+ca)};
  }
  function drawChar(targetCtx,ch,quality=2){
    if(ch.visible===false) return;
    const surf=renderCharSurface(ch,quality);
    targetCtx.save(); applyCharTransform(targetCtx,ch); targetCtx.drawImage(surf.canvas,-surf.logicalW/2,-surf.logicalH/2,surf.logicalW,surf.logicalH); targetCtx.restore();
  }

  function objectBox(ch){ const surf=renderCharSurface(ch,1.2); return {w:surf.logicalW,h:surf.logicalH}; }
  function localPoint(ch,p){
    const m=charAffine(ch), dx=p.x-ch.x, dy=p.y-ch.y, det=(m.a*m.d-m.b*m.c)||1e-9;
    return {x:(m.d*dx-m.c*dy)/det,y:(-m.b*dx+m.a*dy)/det};
  }
  function worldPoint(ch,lx,ly){
    const m=charAffine(ch);
    return {x:ch.x+m.a*lx+m.c*ly,y:ch.y+m.b*lx+m.d*ly};
  }
  function controlPoints(ch){
    const {w,h}=objectBox(ch); const hh=h/2, hw=w/2;
    return { tl:worldPoint(ch,-hw,-hh), tr:worldPoint(ch,hw,-hh), bl:worldPoint(ch,-hw,hh), br:worldPoint(ch,hw,hh), rot:worldPoint(ch,0,-hh-36/(state.zoom||1)) };
  }
  function hitChar(ch,p){ if(ch.visible===false||ch.locked) return false; const l=localPoint(ch,p),b=objectBox(ch); return Math.abs(l.x)<=b.w/2 && Math.abs(l.y)<=b.h/2; }
  function hitHandle(ch,p){
    if(!ch||ch.locked) return null; const cp=controlPoints(ch); const r=11/(state.zoom||1);
    for(const k of ['rot','tl','tr','bl','br']){ const q=cp[k]; if(Math.hypot(p.x-q.x,p.y-q.y)<=r) return k; }
    return null;
  }

  function updateZoomUI(){
    const pct=Math.round(state.zoom*100); const slider=$('zoomSlider'), label=$('zoomValueBtn');
    if(slider) slider.value=String(clamp(pct,5,400)); if(label) label.textContent=`${pct}%`;
  }
  function applyPreviewZoom(nextZoom, mode='manual', anchorClient=null){
    const oldZoom=state.zoom||1; const beforeRect=canvas.getBoundingClientRect();
    const vr=viewport.getBoundingClientRect();
    const anchorX=anchorClient?.x ?? (vr.left+viewport.clientWidth/2); const anchorY=anchorClient?.y ?? (vr.top+viewport.clientHeight/2);
    const worldX=(anchorX-beforeRect.left)/oldZoom, worldY=(anchorY-beforeRect.top)/oldZoom;
    state.zoom=clamp(Number(nextZoom)||1,.05,4); state.zoomMode=mode;
    const cssW=Math.max(1,state.project.width*state.zoom), cssH=Math.max(1,state.project.height*state.zoom);
    canvas.style.width=cssW+'px';canvas.style.height=cssH+'px';shell.style.width=cssW+'px';shell.style.height=cssH+'px';
    const cap=4096; state.previewDpr=Math.max(.125,Math.min(DPR,cap/cssW,cap/cssH));
    canvas.width=Math.max(1,Math.round(cssW*state.previewDpr));canvas.height=Math.max(1,Math.round(cssH*state.previewDpr));
    updateZoomUI(); render();
    requestAnimationFrame(()=>{
      const afterRect=canvas.getBoundingClientRect();
      const desiredX=afterRect.left+worldX*state.zoom, desiredY=afterRect.top+worldY*state.zoom;
      viewport.scrollLeft += desiredX-anchorX; viewport.scrollTop += desiredY-anchorY;
    });
  }
  function fitPreview(){
    const maxW=Math.max(260,viewport.clientWidth-60),maxH=Math.max(240,viewport.clientHeight-60); const z=Math.min(maxW/state.project.width,maxH/state.project.height,1.5);
    applyPreviewZoom(clamp(z,.05,4),'fit');
  }
  function resizeDisplay(){ if(state.zoomMode==='fit') fitPreview(); else applyPreviewZoom(state.zoom,'manual'); }
  function zoomBy(factor, anchorClient=null){ applyPreviewZoom(state.zoom*factor,'manual',anchorClient); }
  function zoomTo100(){ applyPreviewZoom(1,'manual'); }
  function renderGlyphSurface(ch,q=1.2){
    const key=`glyph|${ch.id}|${ch.text}|${ch.fontFamily}|${ch.fontSize}|${ch.fontWeight||700}|${q.toFixed(2)}`;
    if(surfaceCache.has(key)) return surfaceCache.get(key);
    const m=measureChar(ch), pad=Math.max(8,m.pad*.45), logicalW=Math.ceil(m.width+pad*2+4), logicalH=Math.ceil(m.height+pad*2+4);
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.ceil(logicalW*q)); c.height=Math.max(1,Math.ceil(logicalH*q));
    const g=c.getContext('2d'); g.scale(q,q); g.font=fontCss(ch); g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff'; g.fillText(ch.text,logicalW/2,logicalH/2);
    return cacheMapSet(surfaceCache,key,{canvas:c,logicalW,logicalH},180);
  }
  function groupEffectSpread(group){
    const strokes=(group.strokes||[]).filter(s=>s.enabled!==false); const shadows=(group.innerShadows||[]).filter(s=>s.enabled!==false&&s.opacity>0);
    const strokeSpread=Math.max(0,...strokes.map(s=>Number(s.width)||0));
    const shadowSpread=Math.max(0,...shadows.map(s=>Math.abs(Number(s.distance)||0)+(Number(s.size)||0)*2+8));
    return Math.ceil(Math.max(8,strokeSpread+4,shadowSpread));
  }
  function groupVisualRect(ch, surf){
    const hw=surf.logicalW/2, hh=surf.logicalH/2;
    const pts=[worldPoint(ch,-hw,-hh),worldPoint(ch,hw,-hh),worldPoint(ch,hw,hh),worldPoint(ch,-hw,hh)];
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    return {minX:Math.min(...xs), maxX:Math.max(...xs), minY:Math.min(...ys), maxY:Math.max(...ys)};
  }
  function computeGroupLayout(group, q=1.1){
    const members=groupMembers(group.id).filter(ch=>ch&&ch.visible!==false);
    if(!members.length) return null;
    const entries=[]; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(const ch of members){
      const surf=renderGlyphSurface(ch,Math.min(1.8,q*1.25)); const rect=groupVisualRect(ch,surf); minX=Math.min(minX,rect.minX); minY=Math.min(minY,rect.minY); maxX=Math.max(maxX,rect.maxX); maxY=Math.max(maxY,rect.maxY); entries.push({ch,surf});
    }
    const spread=groupEffectSpread(group); const x=Math.floor(minX-spread), y=Math.floor(minY-spread), w=Math.max(1,Math.ceil(maxX-minX+spread*2)), h=Math.max(1,Math.ceil(maxY-minY+spread*2));
    const layoutEntries=entries.map(({ch,surf})=>({ch,surf,localX:ch.x-x,localY:ch.y-y}));
    const memberSig=layoutEntries.map(({ch,localX,localY})=>`${ch.id}:${ch.cacheVersion||0}:${localX.toFixed(2)}:${localY.toFixed(2)}:${(ch.angle||0).toFixed(2)}:${(ch.scale||1).toFixed(3)}:${(ch.scaleX||1).toFixed(3)}:${(ch.scaleY||1).toFixed(3)}:${(ch.skewX||0).toFixed(2)}:${(ch.skewY||0).toFixed(2)}:${ch.visible===false?0:1}`).join('|');
    return {x,y,w,h,q,spread,entries:layoutEntries,memberSig};
  }
  function buildGroupMaskFromLayout(layout){
    const mask=document.createElement('canvas'); mask.width=Math.max(1,Math.ceil(layout.w*layout.q)); mask.height=Math.max(1,Math.ceil(layout.h*layout.q));
    const g=mask.getContext('2d'); g.scale(layout.q,layout.q);
    for(const {ch,surf,localX,localY} of layout.entries){ g.save(); g.translate(localX,localY); g.rotate((ch.angle||0)*Math.PI/180); const kx=Math.tan((ch.skewX||0)*Math.PI/180), ky=Math.tan((ch.skewY||0)*Math.PI/180); g.transform(1,ky,kx,1,0,0); g.scale((ch.scale||1)*(ch.scaleX||1),(ch.scale||1)*(ch.scaleY||1)); g.drawImage(surf.canvas,-surf.logicalW/2,-surf.logicalH/2,surf.logicalW,surf.logicalH); g.restore(); }
    return mask;
  }
  function dilatedMask(maskCanvas,width,color,opacity,position='outside'){
    const layer=document.createElement('canvas'); layer.width=maskCanvas.width; layer.height=maskCanvas.height; const g=layer.getContext('2d');
    const scaledWidth=Math.max(.1,width); const steps=Math.max(8,Math.round(Math.min(32,scaledWidth*2.1))); const rings=Math.max(1,Math.ceil(Math.min(56,scaledWidth*0.9)));
    for(let r=1;r<=rings;r++){ const rad=r; for(let i=0;i<steps;i++){ const t=i/steps*Math.PI*2, dx=Math.cos(t)*rad, dy=Math.sin(t)*rad; g.drawImage(maskCanvas,dx,dy); } }
    g.globalCompositeOperation='source-in'; g.fillStyle=color; g.globalAlpha=clamp(opacity/100,0,1); g.fillRect(0,0,layer.width,layer.height); g.globalAlpha=1;
    if(position==='outside'){ g.globalCompositeOperation='destination-out'; g.drawImage(maskCanvas,0,0); }
    else if(position==='inside' || position==='center'){ g.globalCompositeOperation='destination-in'; g.drawImage(maskCanvas,0,0); }
    return layer;
  }
  function groupInnerShadowLayer(maskCanvas,s){
    const layer=document.createElement('canvas'); layer.width=maskCanvas.width; layer.height=maskCanvas.height; const g=layer.getContext('2d');
    const a=(Number(s.angle)||0)*Math.PI/180, dx=Math.cos(a)*(Number(s.distance)||0), dy=Math.sin(a)*(Number(s.distance)||0);
    g.filter=`blur(${Math.max(.1,Number(s.size)||0)}px)`; g.globalAlpha=clamp((Number(s.opacity)||0)/100,0,1); g.drawImage(maskCanvas,dx,dy); g.filter='none';
    g.globalCompositeOperation='source-in'; g.fillStyle=s.color; g.fillRect(0,0,layer.width,layer.height);
    g.globalCompositeOperation='destination-in'; g.drawImage(maskCanvas,0,0);
    return layer;
  }
  function getGroupEffectComposite(group,stage){
    const strokes=(group.strokes||[]).filter(s=>s.enabled!==false); const shadows=(group.innerShadows||[]).filter(s=>s.enabled!==false&&s.opacity>0); if(!strokes.length&&!shadows.length) return null;
    const relevantStrokes=stage==='before' ? strokes.filter(s=>s.position==='outside') : strokes.filter(s=>s.position!=='outside');
    if(stage==='before' && !relevantStrokes.length) return null;
    if(stage==='after' && !relevantStrokes.length && !shadows.length) return null;
    const layout=computeGroupLayout(group,0.82); if(!layout) return null;
    const effectSig=JSON.stringify({stage,strokes:relevantStrokes,shadows:stage==='after'?shadows:[]});
    const key=`${group.id}|${layout.memberSig}|${layout.w}x${layout.h}|${effectSig}`;
    if(groupEffectCache.has(key)) return groupEffectCache.get(key);
    const mask=buildGroupMaskFromLayout(layout); const layers=[];
    relevantStrokes.forEach(s=>{ const layer=dilatedMask(mask,Math.max(.1,(Number(s.width)||0)*layout.q),s.color,s.opacity,s.position); layers.push({canvas:layer,blend:blendToCanvas(s.blend)}); });
    if(stage==='after'){ shadows.forEach(s=>{ const scaled={...s,distance:(Number(s.distance)||0)*layout.q,size:(Number(s.size)||0)*layout.q}; const layer=groupInnerShadowLayer(mask,scaled); layers.push({canvas:layer,blend:blendToCanvas(s.blend)}); }); }
    return cacheMapSet(groupEffectCache,key,{layers,x:layout.x,y:layout.y,w:layout.w,h:layout.h},80);
  }
  function drawGroupEffects(targetCtx,stage){
    const seen=new Set();
    for(const ch of state.chars){
      if(!ch.groupId||seen.has(ch.groupId)) continue;
      seen.add(ch.groupId); const group=groupById(ch.groupId); if(!group) continue;
      const comp=getGroupEffectComposite(group,stage); if(!comp) continue;
      for(const layer of comp.layers){ targetCtx.save(); targetCtx.globalCompositeOperation=layer.blend; targetCtx.drawImage(layer.canvas,comp.x,comp.y,comp.w,comp.h); targetCtx.restore(); }
    }
  }
  function drawStrokePath(g, points, closed=false){
    if(!points||!points.length) return;
    if(points.length===1){ g.beginPath(); g.arc(points[0].x,points[0].y,0.5,0,Math.PI*2); g.fill(); return; }
    g.beginPath();
    g.moveTo(points[0].x, points[0].y);
    if(closed){
      for(let i=1;i<points.length;i++) g.lineTo(points[i].x, points[i].y);
      g.closePath();
      g.stroke();
      return;
    }
    for(let i=1;i<points.length-1;i++){
      const midX=(points[i].x+points[i+1].x)/2, midY=(points[i].y+points[i+1].y)/2;
      g.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
    }
    const last=points[points.length-1]; g.lineTo(last.x,last.y); g.stroke();
  }
  function strokeAnchorRef(stroke){
    if(!stroke||!stroke.anchor) return null;
    if(stroke.anchor.type==='char') return charById(stroke.anchor.id);
    if(stroke.anchor.type==='group'){
      const group=groupById(stroke.anchor.id); if(!group) return null;
      const members=groupMembers(group.id).filter(Boolean); if(!members.length) return null;
      const ids=new Set(members.map(m=>m.id));
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const ch of members){ const b=objectBox(ch), pts=[worldPoint(ch,-b.w/2,-b.h/2),worldPoint(ch,b.w/2,-b.h/2),worldPoint(ch,b.w/2,b.h/2),worldPoint(ch,-b.w/2,b.h/2)]; for(const p of pts){ minX=Math.min(minX,p.x); minY=Math.min(minY,p.y); maxX=Math.max(maxX,p.x); maxY=Math.max(maxY,p.y);} }
      return {type:'group',x:(minX+maxX)/2,y:(minY+maxY)/2,memberIds:ids};
    }
    return null;
  }
  function strokePointsWorld(stroke){
    if(!stroke) return [];
    if(stroke.anchor?.type==='char'){
      const ch=charById(stroke.anchor.id); if(!ch) return [];
      return (stroke.points||[]).map(p=>worldPoint(ch,p.x,p.y));
    }
    if(stroke.anchor?.type==='group'){
      const ref=strokeAnchorRef(stroke); if(!ref) return [];
      return (stroke.points||[]).map(p=>({x:ref.x+p.x, y:ref.y+p.y}));
    }
    return (stroke.points||[]).map(p=>({x:p.x,y:p.y}));
  }
  function strokeMatchesFilter(stroke, filter={}){
    if(filter.onlyChar){
      return stroke.anchor?.type==='char' && stroke.anchor.id===filter.onlyChar.id;
    }
    if(filter.onlyGroupId){
      return stroke.anchor?.type==='group' && stroke.anchor.id===filter.onlyGroupId;
    }
    if(filter.onlyAnchorCharId){
      return stroke.anchor?.type==='char' && stroke.anchor.id===filter.onlyAnchorCharId;
    }
    if(filter.onlyGlobal){
      return !stroke.anchor;
    }
    return true;
  }
  function getStrokeBounds(points){
    if(!points||!points.length) return null;
    const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
    return {minX:Math.min(...xs),maxX:Math.max(...xs),minY:Math.min(...ys),maxY:Math.max(...ys)};
  }
  function applyBrushStyle(targetCtx, stroke){
    const type=stroke.brushType||'pen';
    targetCtx.lineCap='round'; targetCtx.lineJoin='round';
    if(type==='highlighter'){
      targetCtx.globalAlpha=0.33; targetCtx.strokeStyle=stroke.color; targetCtx.fillStyle=stroke.color; targetCtx.lineWidth=stroke.size*1.08;
    } else if(type==='airbrush'){
      targetCtx.globalAlpha=0.18; targetCtx.strokeStyle=stroke.color; targetCtx.fillStyle=stroke.color; targetCtx.lineWidth=stroke.size*0.72; targetCtx.shadowColor=stroke.color; targetCtx.shadowBlur=Math.max(6,stroke.size*1.35);
    } else {
      targetCtx.globalAlpha=1; targetCtx.strokeStyle=stroke.color; targetCtx.fillStyle=stroke.color; targetCtx.lineWidth=stroke.size;
    }
  }
  function drawOneStroke(targetCtx, stroke){
    const points=strokePointsWorld(stroke); if(!points.length) return;
    targetCtx.save(); applyBrushStyle(targetCtx, stroke);
    const closed=stroke.assistMode==='circle';
    drawStrokePath(targetCtx, points, closed);
    if((stroke.brushType||'pen')==='airbrush'){
      targetCtx.globalAlpha=0.08; targetCtx.shadowBlur=0; targetCtx.lineWidth=Math.max(1, stroke.size*1.15); drawStrokePath(targetCtx, points, closed);
    }
    targetCtx.restore();
  }
  function drawFreehand(targetCtx, placement='all', filter={}){
    for(const stroke of state.drawings){
      const isAbove = stroke.aboveText!==false;
      if(placement!=='all' && ((placement==='below'&&isAbove) || (placement==='above'&&!isAbove))) continue;
      if(!strokeMatchesFilter(stroke, filter)) continue;
      drawOneStroke(targetCtx, stroke);
    }
  }
  function smoothStrokePoints(points, passes=1){
    let pts=(points||[]).map(p=>({x:p.x,y:p.y}));
    for(let pass=0; pass<passes; pass++){
      if(pts.length<3) break;
      const next=[pts[0]];
      for(let i=1;i<pts.length-1;i++){
        const a=pts[i-1], b=pts[i], c=pts[i+1];
        next.push({x:(a.x+b.x*2+c.x)/4, y:(a.y+b.y*2+c.y)/4});
      }
      next.push(pts[pts.length-1]);
      pts=next;
    }
    return pts;
  }
  function pruneStrokePoints(points, minDist=0.5){
    if(!points||!points.length) return [];
    const out=[points[0]];
    for(let i=1;i<points.length;i++){
      const p=points[i], last=out[out.length-1];
      if(Math.hypot(p.x-last.x,p.y-last.y)>=minDist || i===points.length-1) out.push(p);
    }
    return out;
  }
  function convertStrokeToAssistShape(stroke){
    if(!stroke||!stroke.points||stroke.points.length<2) return false;
    const pts=stroke.points;
    const mode=stroke.assistMode||'freehand';
    if(mode==='line'){
      stroke.points=[pts[0], pts[pts.length-1]];
      return true;
    }
    if(mode==='curve'){
      const first=pts[0], last=pts[pts.length-1], mid=pts[Math.floor(pts.length/2)]||pts[0];
      const out=[]; const steps=Math.max(16, Math.min(64, pts.length*2));
      for(let i=0;i<=steps;i++){
        const t=i/steps, mt=1-t;
        out.push({x:mt*mt*first.x + 2*mt*t*mid.x + t*t*last.x, y:mt*mt*first.y + 2*mt*t*mid.y + t*t*last.y});
      }
      stroke.points=out;
      return true;
    }
    if(mode==='circle'){
      const b=getStrokeBounds(pts); if(!b) return false;
      const cx=(b.minX+b.maxX)/2, cy=(b.minY+b.maxY)/2, rx=Math.max(2,(b.maxX-b.minX)/2), ry=Math.max(2,(b.maxY-b.minY)/2);
      const out=[]; const steps=48;
      for(let i=0;i<steps;i++){
        const t=i/steps*Math.PI*2;
        out.push({x:cx+Math.cos(t)*rx, y:cy+Math.sin(t)*ry});
      }
      out.push({...out[0]});
      stroke.points=out;
      return true;
    }
    return false;
  }
  function polishStroke(stroke, strong=false){
    if(!stroke||!stroke.points||stroke.points.length<2) return false;
    if(stroke.assistMode && stroke.assistMode!=='freehand') return convertStrokeToAssistShape(stroke);
    if(stroke.points.length<3) return false;
    const passes=strong?3:1;
    const minDist=Math.max(0.35,(Number(stroke.size)||1)*(strong?0.022:0.014));
    let pts=smoothStrokePoints(stroke.points, passes);
    pts=pruneStrokePoints(pts,minDist);
    if(pts.length>=2){
      pts[0]=stroke.points[0];
      pts[pts.length-1]=stroke.points[stroke.points.length-1];
    }
    stroke.points=pts;
    return true;
  }
  function scheduleDrawPausePolish(it){
    if(!it||it.type!=='draw') return;
    if(it.pauseTimer) clearTimeout(it.pauseTimer);
    it.pauseTimer=setTimeout(()=>{
      if(state.interaction!==it || it.type!=='draw') return;
      const stroke=state.drawings.find(d=>d.id===it.strokeId);
      if(!stroke) return;
      if(polishStroke(stroke,true)){
        it.lastSmooth=stroke.points[stroke.points.length-1]||it.lastSmooth;
        it.pausePolished=true;
        render();
      }
    },2000);
  }
  function setDrawMode(enabled){ state.drawTool.enabled=!!enabled; shell.classList.toggle('draw-active',state.drawTool.enabled); ['drawModeBtn','drawModeBtn2'].forEach(id=>{ const b=$(id); if(b) b.classList.toggle('draw-mode-active',state.drawTool.enabled); if(b) b.textContent=state.drawTool.enabled?'그리기 모드 끄기':'그리기 모드'; }); }
  function updateDrawToolUI(){ const color=normalizeHexInput(state.drawTool.color,'#FF5AA5'); state.drawTool.color=color; if($('drawColor'))$('drawColor').value=color; if($('drawColorHex'))$('drawColorHex').value=color; if($('drawBrushSize'))$('drawBrushSize').value=state.drawTool.size; if($('drawBrushSizeValue'))$('drawBrushSizeValue').textContent=`${state.drawTool.size} px`; if($('drawBrushType')) $('drawBrushType').value=state.drawTool.brushType||'pen'; if($('drawAssistMode')) $('drawAssistMode').value=state.drawTool.assistMode||'freehand'; const btn=$('drawBelowTextBtn'); if(btn) btn.textContent = state.drawTool.aboveText===false ? '선은 글자 아래에 표시' : '선은 글자 위에 표시'; setDrawMode(state.drawTool.enabled); }
  function removeLastDrawing(){ if(!state.drawings.length){toast('삭제할 선이 없습니다.');return;} state.drawings.pop(); render(); pushHistory(); }
  function clearAllDrawings(){ if(!state.drawings.length){toast('지울 선이 없습니다.');return;} state.drawings=[]; render(); pushHistory(); }

  function render(){
    const z=state.zoom; ctx.setTransform(state.previewDpr*z,0,0,state.previewDpr*z,0,0); ctx.clearRect(0,0,state.project.width,state.project.height);
    drawFreehand(ctx,'below');
    drawGroupEffects(ctx,'before');
    for(const ch of state.chars) drawChar(ctx,ch,Math.min(2.2,Math.max(1.15,DPR/state.zoom)));
    drawGroupEffects(ctx,'after');
    drawFreehand(ctx,'above');
    drawSelection(ctx);
  }
  function drawSelection(g){
    g.save(); g.lineWidth=1.5/state.zoom; g.setLineDash([6/state.zoom,4/state.zoom]);
    for(const id of state.selectedIds){ const ch=charById(id); if(!ch||ch.visible===false)continue; const b=objectBox(ch),pts=[worldPoint(ch,-b.w/2,-b.h/2),worldPoint(ch,b.w/2,-b.h/2),worldPoint(ch,b.w/2,b.h/2),worldPoint(ch,-b.w/2,b.h/2)];
      g.beginPath();g.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>g.lineTo(p.x,p.y));g.closePath();g.strokeStyle=id===state.activeId?'#675acd':'#9b95d8';g.stroke();
      if(id===state.activeId&&!ch.locked){ const cp=controlPoints(ch); const topMid=worldPoint(ch,0,-b.h/2); g.beginPath();g.moveTo(topMid.x,topMid.y);g.lineTo(cp.rot.x,cp.rot.y);g.stroke(); g.setLineDash([]);
        for(const k of ['tl','tr','bl','br']){const p=cp[k];g.fillStyle='#fff';g.strokeStyle='#675acd';g.beginPath();g.rect(p.x-6/state.zoom,p.y-6/state.zoom,12/state.zoom,12/state.zoom);g.fill();g.stroke();}
        g.beginPath();g.arc(cp.rot.x,cp.rot.y,6/state.zoom,0,Math.PI*2);g.fill();g.stroke(); g.setLineDash([6/state.zoom,4/state.zoom]); }
    } g.restore();
  }
  function eventPoint(e){ const r=canvas.getBoundingClientRect(); return {x:(e.clientX-r.left)/state.zoom,y:(e.clientY-r.top)/state.zoom}; }

  function setSelection(ids,activeId=null){
    state.selectedIds=new Set(ids.filter(id=>charById(id))); state.activeId=activeId&&state.selectedIds.has(activeId)?activeId:(ids[0]||null); updateInspector(); updateLayers(); render();
  }
  function selectByClick(ch,e){
    let ids=[];
    if(e.shiftKey){ ids=[...state.selectedIds]; const ix=ids.indexOf(ch.id); if(ix>=0)ids.splice(ix,1);else ids.push(ch.id); setSelection(ids,ch.id); return; }
    if(ch.groupId){ ids=groupMembers(ch.groupId).map(c=>c.id); } else ids=[ch.id];
    setSelection(ids,ch.id);
  }

  canvas.addEventListener('pointerdown',(e)=>{
    canvas.setPointerCapture(e.pointerId); const p=eventPoint(e);
    if(state.drawTool.enabled){
      let anchor=null;
      if(state.selectedIds.size===1){ const ch=activeChar(); if(ch) anchor={type:'char',id:ch.id}; }
      else if(state.selectedIds.size>1){ const chars=[...state.selectedIds].map(charById).filter(Boolean); const gid=chars.length && chars.every(c=>c.groupId&&c.groupId===chars[0].groupId) ? chars[0].groupId : null; if(gid) anchor={type:'group',id:gid}; }
      const initialPoint = anchor?.type==='char' ? localPoint(charById(anchor.id), p) : anchor?.type==='group' ? (()=>{const ref=strokeAnchorRef({anchor}); return ref? {x:p.x-ref.x,y:p.y-ref.y}:p;})() : p;
      const stroke={id:uid('draw'),color:state.drawTool.color,size:Number(state.drawTool.size)||18,aboveText:state.drawTool.aboveText!==false,brushType:state.drawTool.brushType||'pen',assistMode:state.drawTool.assistMode||'freehand',anchor,points:[initialPoint]};
      state.drawings.push(stroke); state.interaction={type:'draw',strokeId:stroke.id,lastRaw:p,lastSmooth:p,pauseTimer:null,pausePolished:false,anchor}; scheduleDrawPausePolish(state.interaction); renderScheduled(); return;
    }
    const active=activeChar(); const handle=hitHandle(active,p);
    if(handle){
      const b=objectBox(active); const startDist=Math.max(1,Math.hypot(p.x-active.x,p.y-active.y)); const startAngle=Math.atan2(p.y-active.y,p.x-active.x);
      state.interaction={type:handle==='rot'?'rotate':'scale',id:active.id,start:p,startScale:active.scale,startObjAngle:active.angle,startPointerAngle:startAngle,startDist,startBox:b}; return;
    }
    let hit=null; for(let i=state.chars.length-1;i>=0;i--){ if(hitChar(state.chars[i],p)){ hit=state.chars[i];break; } }
    if(!hit){ if(!e.shiftKey)setSelection([]); return; }
    selectByClick(hit,e);
    const ids=[...state.selectedIds]; const origins=ids.map(id=>{const c=charById(id);return{id,x:c.x,y:c.y}});
    state.interaction={type:'move',start:p,origins};
  });
  canvas.addEventListener('pointermove',(e)=>{
    const it=state.interaction;if(!it)return; const p=eventPoint(e);
    if(it.type==='draw'){
      const stroke=state.drawings.find(d=>d.id===it.strokeId); if(!stroke) return;
      const stabilize=clamp(Number(state.drawTool.stabilize)||0.88,0,0.98), alpha=1-stabilize;
      const prev=it.lastSmooth||p; const nx=prev.x+(p.x-prev.x)*alpha, ny=prev.y+(p.y-prev.y)*alpha;
      const smoothWorld={x:nx,y:ny};
      let smooth=smoothWorld;
      if(stroke.anchor?.type==='char'){ const ch=charById(stroke.anchor.id); if(!ch) return; smooth=localPoint(ch,smoothWorld); }
      else if(stroke.anchor?.type==='group'){ const ref=strokeAnchorRef(stroke); if(!ref) return; smooth={x:smoothWorld.x-ref.x, y:smoothWorld.y-ref.y}; }
      const last=stroke.points[stroke.points.length-1];
      if(!last || Math.hypot(smooth.x-last.x,smooth.y-last.y) >= Math.max(0.8, stroke.size*0.08)) stroke.points.push(smooth);
      it.lastRaw=p; it.lastSmooth=smoothWorld; it.pausePolished=false; scheduleDrawPausePolish(it); renderScheduled(); return;
    }
    if(it.type==='move'){ const dx=p.x-it.start.x,dy=p.y-it.start.y; for(const o of it.origins){const c=charById(o.id);if(c&&!c.locked){c.x=o.x+dx;c.y=o.y+dy;}} }
    else if(it.type==='rotate'){ const c=charById(it.id);if(c){ const a=Math.atan2(p.y-c.y,p.x-c.x); let deg=it.startObjAngle+(a-it.startPointerAngle)*180/Math.PI; if(e.shiftKey)deg=Math.round(deg/15)*15;c.angle=deg; } }
    else if(it.type==='scale'){ const c=charById(it.id);if(c){const d=Math.max(1,Math.hypot(p.x-c.x,p.y-c.y));c.scale=clamp(it.startScale*(d/it.startDist),.05,20);} }
    updateInspectorTransformOnly(); renderScheduled();
  });
  function finishInteraction(){ if(state.interaction){ const current=state.interaction; const wasDraw=current.type==='draw'; if(current.pauseTimer) clearTimeout(current.pauseTimer); state.interaction=null; if(wasDraw){ const last=state.drawings[state.drawings.length-1]; if(last && (!last.points || last.points.length<2)) last.points=[...(last.points||[]), ...(last.points||[])]; else if(last) polishStroke(last,false); } pushHistory();updateLayers();updateInspector(); render(); } }
  canvas.addEventListener('pointerup',finishInteraction); canvas.addEventListener('pointercancel',finishInteraction);
  window.addEventListener('keydown',(e)=>{
    const tag=(document.activeElement&&document.activeElement.tagName||'').toLowerCase(); const editing=['input','textarea','select'].includes(tag);
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault(); if(e.shiftKey)redo();else undo();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
    if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='c'){e.preventDefault();copyStyle();return;}
    if((e.ctrlKey||e.metaKey)&&e.altKey&&e.key.toLowerCase()==='v'){e.preventDefault();pasteStyle();return;}
    if(!editing&&(e.key==='+'||e.key==='=')){e.preventDefault();zoomBy(1.2);return;}
    if(!editing&&(e.key==='-'||e.key==='_')){e.preventDefault();zoomBy(1/1.2);return;}
    if(!editing&&e.key==='0'){e.preventDefault();zoomTo100();return;}
    if(!editing&&(e.key==='Delete'||e.key==='Backspace')){ deleteSelected(); }
  });

  function defaultStroke(index=0){return {id:uid('stroke'),enabled:true,width:index?8:14,position:'outside',blend:'normal',opacity:100,color:index?'#FFFFFF':'#5C55A8'};}
  function defaultInnerShadow(){return {id:uid('shadow'),enabled:true,blend:'multiply',color:'#493F74',opacity:28,angle:90,distance:5,choke:6,size:7,contour:'soft',quality:3};}
  function newChar(text,fontFamily,fontSize,fill,x,y){ return {id:uid('char'),text,fontFamily,fontSize,fontWeight:700,fill,fillMode:'solid',gradient:defaultGradient(fill),x,y,scale:1,scaleX:1,scaleY:1,skewX:0,skewY:0,angle:0,visible:true,locked:false,groupId:null,strokes:[defaultStroke()],innerShadows:[],cacheVersion:1}; }

  function setFontLoadStatus(message,type='info'){
    const el=$('fontLoadStatus'); if(!el)return;
    el.textContent=message; el.classList.remove('hidden','ok','warn','error','info'); el.classList.add(type);
  }
  function clearFontLoadStatus(){ const el=$('fontLoadStatus'); if(el){el.textContent='';el.className='font-status hidden';} }
  function cleanFamilyName(name){ return String(name||'').trim().replace(/^['"]|['"]$/g,'').trim(); }
  function decodeHtmlUrl(value){ return String(value||'').replace(/&amp;/gi,'&').trim(); }
  function extractWebCssInput(raw){
    const value=String(raw||'').trim();
    if(!value) return {kind:'empty'};
    if(/@font-face\s*\{/i.test(value)) return {kind:'css',cssText:value};

    // Google Fonts 복사 코드는 preconnect 링크가 먼저 옵니다. 실제 stylesheet 링크만 골라냅니다.
    const linkTags=value.match(/<link\b[^>]*>/gi)||[];
    if(linkTags.length){
      const candidates=[];
      for(const tag of linkTags){
        const hm=tag.match(/href\s*=\s*['"]([^'"]+)['"]/i); if(!hm)continue;
        const href=decodeHtmlUrl(hm[1]);
        const stylesheet=/rel\s*=\s*['"][^'"]*stylesheet[^'"]*['"]/i.test(tag);
        const looksCss=/fonts\.googleapis\.com\/css/i.test(href)||/\.css(?:[?#]|$)/i.test(href);
        candidates.push({href,score:(stylesheet?10:0)+(looksCss?5:0)});
      }
      candidates.sort((a,b)=>b.score-a.score);
      if(candidates[0]) return {kind:'url',url:candidates[0].href};
    }

    const importMatch=value.match(/@import\s+(?:url\(\s*)?['"]?([^'"\)\s;]+)['"]?\s*\)?\s*;?/i);
    if(importMatch) return {kind:'url',url:decodeHtmlUrl(importMatch[1])};
    if(/^https?:\/\//i.test(value)) return {kind:'url',url:decodeHtmlUrl(value)};
    if(/[{}]/.test(value)) return {kind:'css',cssText:value};
    return {kind:'unknown',value};
  }
  function inferFamilyFromGoogleUrl(url){
    try{
      const u=new URL(url), family=u.searchParams.get('family'); if(!family)return '';
      return decodeURIComponent(family.split(':')[0].replace(/\+/g,' ')).trim();
    }catch(_){return '';}
  }
  function extractFamiliesFromCss(cssText){
    const out=[], seen=new Set(), re=/font-family\s*:\s*(?:['"]([^'"]+)['"]|([^;\}\n]+))/gi; let m;
    while((m=re.exec(String(cssText||'')))){
      const name=cleanFamilyName(m[1]||m[2]);
      if(name&&!seen.has(name)&&!['sans-serif','serif','monospace','system-ui'].includes(name.toLowerCase())){seen.add(name);out.push(name);}
    }
    return out;
  }
  function absolutizeCssUrls(cssText,baseUrl){
    if(!baseUrl)return cssText;
    return String(cssText||'').replace(/url\(\s*(['"]?)([^'"\)]+)\1\s*\)/gi,(all,q,path)=>{
      const v=String(path).trim(); if(/^(?:data:|blob:|https?:|\/\/|#)/i.test(v))return all;
      try{return `url("${new URL(v,baseUrl).href}")`;}catch(_){return all;}
    });
  }
  async function fetchCssText(url,timeoutMs=9000){
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),timeoutMs);
    try{
      const res=await fetch(url,{mode:'cors',credentials:'omit',signal:controller.signal,cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text=await res.text(); if(!text.trim()) throw new Error('빈 CSS 응답'); return text;
    } finally { clearTimeout(timer); }
  }
  function injectCssText(cssText,label='webfont-css'){
    const style=document.createElement('style'); style.type='text/css'; style.dataset.fontStyleId=uid('fontstyle'); style.dataset.fontLabel=label; style.textContent=cssText; document.head.appendChild(style); return style;
  }
  function loadCssLink(url,timeoutMs=10000){
    return new Promise((resolve,reject)=>{
      const link=document.createElement('link'); link.rel='stylesheet'; link.href=url; link.dataset.fontLinkId=uid('fontlink');
      let done=false; const finish=(ok,reason)=>{if(done)return;done=true;clearTimeout(timer);ok?resolve({link,reason}):reject(Object.assign(new Error(reason||'stylesheet load failed'),{link}));};
      link.onload=()=>finish(true,'load'); link.onerror=()=>finish(false,'CSS 링크 로드 실패'); document.head.appendChild(link);
      const timer=setTimeout(()=>finish(true,'timeout'),timeoutMs);
    });
  }
  async function ensureFontReady(name,timeoutMs=10000){
    const family=cleanFamilyName(name); if(!family)return false;
    const sample='가나다라마바사아자차카타파하 ABCabc123';
    const safe=family.replace(/"/g,''), specs=[`64px "${safe}"`,`400 64px "${safe}"`,`700 64px "${safe}"`];
    const timeout=new Promise(resolve=>setTimeout(()=>resolve(false),timeoutMs));
    const loader=(async()=>{
      let loaded=false;
      for(const spec of specs){try{const faces=await document.fonts.load(spec,sample);if(faces&&faces.length)loaded=true;}catch(_){}}
      try{await document.fonts.ready;}catch(_){}
      if(loaded)return true;
      return specs.some(spec=>{try{return document.fonts.check(spec,sample);}catch(_){return false;}});
    })();
    return Promise.race([loader,timeout]);
  }
  async function createText(){
    const text=$('textInput').value; if(!text){toast('텍스트를 입력하세요.');return;}
    const font=$('fontSelect').value, size=clamp(Number($('baseFontSize').value)||220,8,1200), spacing=Number($('letterSpacing').value)||0;
    await ensureFontReady(font);
    const lines=text.split(/\r?\n/); const chars=[]; const lineHeight=size*1.35; const startY=state.project.height/2-(lines.length-1)*lineHeight/2;
    lines.forEach((line,li)=>{
      const graphemes=splitGraphemes(line); const temp=[]; let total=0;
      for(const gr of graphemes){ if(gr===' '){total+=size*.35+spacing;continue;} const ch=newChar(gr,font,size,'#9389DE',0,0); const w=measureChar(ch).width;temp.push({ch,w,advance:w+spacing});total+=w+spacing; }
      if(temp.length)total-=spacing; let cursor=state.project.width/2-total/2;
      for(const item of temp){ item.ch.x=cursor+item.w/2;item.ch.y=startY+li*lineHeight;cursor+=item.advance;chars.push(item.ch); }
    });
    state.chars=chars;state.groups=[];clearRuntimeCaches();setSelection(chars.length?[chars[0].id]:[],chars[0]?.id||null);pushHistory();updateAll();toast(`${chars.length}개 글자 레이어를 만들었습니다.`);
  }

  function effectTargets(){
    const a=activeChar(); if(!a)return[];
    if(state.selectedIds.size>1) return [...state.selectedIds].map(charById).filter(Boolean);
    return [a];
  }
  function currentEffectScope(){ const a=activeChar(); if(!a) return null; if(state.groupEffectEdit && a.groupId){ return {type:'group', group:groupById(a.groupId)}; } return {type:'chars', chars:effectTargets()}; }
  function applyEffectMutation(fn){ const scope=currentEffectScope(); if(!scope)return; if(scope.type==='group'){ fn(scope.group); } else { scope.chars.forEach(fn); markManyDirty(scope.chars); } groupEffectCache.clear(); renderScheduled(); scheduleHistory(); }
  function applyCharMutation(fn,dirty=true){ const c=activeChar();if(!c)return;fn(c);if(dirty){markDirty(c);clearRuntimeCaches();}renderScheduled();updateLayers();scheduleHistory(); }

  function updateInspectorTransformOnly(){ const c=activeChar();if(!c)return; $('charX').value=Math.round(c.x);$('charY').value=Math.round(c.y);$('charAngle').value=(c.angle||0).toFixed(1);$('charScale').value=(c.scale||1).toFixed(3); $('charScaleX').value=(c.scaleX||1).toFixed(3); $('charScaleY').value=(c.scaleY||1).toFixed(3); $('charSkewX').value=(c.skewX||0).toFixed(1); $('charSkewY').value=(c.skewY||0).toFixed(1); }
  function updateInspector(){
    const c=activeChar(); $('noSelection').classList.toggle('hidden',!!c);$('charInspector').classList.toggle('hidden',!c);$('activeCharBadge').textContent=c?c.text:'없음';
    $('selectionText').textContent=state.selectedIds.size?`${state.selectedIds.size}개 선택 · ${c?`활성: ${c.text}`:''}`:'선택 없음';
    if(!c)return;
    ensureGradient(c); $('charText').value=c.text;$('charFontSize').value=c.fontSize;$('charFontFamily').value=c.fontFamily;$('charFill').value=normalizeHex(c.fill);$('charFillHex').value=normalizeHex(c.fill);$('charFillMode').value=c.fillMode||'solid';$('gradientEditor').classList.toggle('hidden',(c.fillMode||'solid')==='solid');$('gradientAngle').value=c.gradient.angle;$('gradientRange').value=c.gradient.range;$('gradientCenterX').value=c.gradient.centerX;$('gradientCenterY').value=c.gradient.centerY;updateInspectorTransformOnly();
    $('groupEffectToggle').checked=state.groupEffectEdit;$('groupStatus').textContent=c.groupId?`그룹 ${c.groupId.slice(-6)} · ${groupMembers(c.groupId).length}개 글자 · 이동/선택 함께`:'그룹 없음';
    renderGradientStops(c); renderGradientPreview(c); renderStrokeList(c);renderInnerShadowList(c); renderBevelRecommendations(c.fill);
  }

  function optionHtml(items,current){return items.map(([v,t])=>`<option value="${v}"${v===current?' selected':''}>${t}</option>`).join('');}
  function effectColorControl(prefix,effect){ return `<div class="color-line wide"><input data-k="color" type="color" value="${normalizeHex(effect.color)}"><input data-k="colorHex" type="text" value="${normalizeHex(effect.color)}" maxlength="7"></div>`; }
  function renderGradientPreview(c){
    const pc=$('gradientPreview'); if(!pc||!c)return; const pg=pc.getContext('2d'); pg.clearRect(0,0,pc.width,pc.height); const fake={...c,fillMode:c.fillMode==='solid'?'linear':c.fillMode}; pg.fillStyle=gradientStyle(pg,fake,pc.width,pc.height); pg.fillRect(0,0,pc.width,pc.height);
  }
  function renderGradientStops(c){
    const box=$('gradientStopList'); if(!box||!c)return; const gr=ensureGradient(c); box.innerHTML='';
    [...gr.stops].sort((a,b)=>a.position-b.position).forEach((st,index)=>{ const row=document.createElement('div'); row.className='gradient-stop'; row.dataset.id=st.id; row.innerHTML=`<input data-gk="color" type="color" value="${normalizeHex(st.color)}" title="색상"><label>HEX<input data-gk="hex" type="text" value="${normalizeHex(st.color)}" maxlength="7"></label><label class="stop-pos">위치(%)<input data-gk="position" type="number" min="0" max="100" step="1" value="${st.position}"></label><button class="mini-icon danger" data-gact="delete" ${gr.stops.length<=2?'disabled':''}>삭제</button>`;
      row.addEventListener('input',ev=>{ const a=activeChar(); if(!a)return; const g=ensureGradient(a), item=g.stops.find(x=>x.id===st.id); if(!item)return; const k=ev.target.dataset.gk; if(k==='hex')return; if(k==='color'){item.color=normalizeHex(ev.target.value); const h=row.querySelector('[data-gk="hex"]');if(h)h.value=item.color;} else if(k==='position'){item.position=clamp(Number(ev.target.value)||0,0,100);} markDirty(a);clearRuntimeCaches();renderGradientPreview(a);render();scheduleHistory(); });
      row.addEventListener('change',ev=>{if(ev.target.dataset.gk!=='hex')return;const a=activeChar();if(!a)return;const g=ensureGradient(a),item=g.stops.find(x=>x.id===st.id);if(!item)return;item.color=normalizeHex(ev.target.value,item.color);ev.target.value=item.color;const cp=row.querySelector('[data-gk="color"]');if(cp)cp.value=item.color;markDirty(a);clearRuntimeCaches();renderGradientPreview(a);render();pushHistory();});
      row.querySelector('[data-gact="delete"]').addEventListener('click',()=>{const a=activeChar();if(!a)return;const g=ensureGradient(a);if(g.stops.length<=2)return;g.stops=g.stops.filter(x=>x.id!==st.id);markDirty(a);clearRuntimeCaches();renderGradientStops(a);renderGradientPreview(a);render();pushHistory();}); box.appendChild(row); });
  }
  function addGradientStop(){ const c=activeChar();if(!c)return;const gr=ensureGradient(c), sorted=[...gr.stops].sort((a,b)=>a.position-b.position); let pos=50; if(sorted.length>=2){let best=-1;for(let i=0;i<sorted.length-1;i++){const gap=sorted[i+1].position-sorted[i].position;if(gap>best){best=gap;pos=(sorted[i].position+sorted[i+1].position)/2;}}} gr.stops.push({id:uid('gstop'),position:Math.round(pos),color:normalizeHex(c.fill)});markDirty(c);clearRuntimeCaches();renderGradientStops(c);renderGradientPreview(c);render();pushHistory(); }
  function applyGradientPreset(name){ const c=activeChar();if(!c)return;const base=normalizeHex(c.fill), rec=makeBevelRecommendations(base), g=ensureGradient(c); if(name==='toplight'){c.fillMode='linear';g.angle=90;g.range=110;g.centerX=50;g.centerY=48;g.stops=[{id:uid('gstop'),position:0,color:rec.highlight[1]},{id:uid('gstop'),position:35,color:rec.highlight[0]},{id:uid('gstop'),position:68,color:base},{id:uid('gstop'),position:100,color:rec.shadow[0]}];} else if(name==='soft3'){c.fillMode='linear';g.angle=90;g.range=145;g.stops=[{id:uid('gstop'),position:0,color:rec.highlight[0]},{id:uid('gstop'),position:50,color:base},{id:uid('gstop'),position:100,color:rec.shadow[0]}];} else if(name==='candy'){c.fillMode='linear';g.angle=90;g.range=92;g.stops=[{id:uid('gstop'),position:0,color:rec.highlight[1]},{id:uid('gstop'),position:22,color:rec.highlight[0]},{id:uid('gstop'),position:38,color:base},{id:uid('gstop'),position:66,color:base},{id:uid('gstop'),position:100,color:rec.shadow[1]}];} else {c.fillMode='linear';g.angle=90;g.range=100;g.stops=[{id:uid('gstop'),position:0,color:rec.highlight[0]},{id:uid('gstop'),position:42,color:base},{id:uid('gstop'),position:100,color:rec.shadow[2]}];} markDirty(c);clearRuntimeCaches();updateInspector();render();pushHistory(); }
  function renderStrokeList(c){
    const box=$('strokeList');box.innerHTML=''; const scope=(state.groupEffectEdit&&c.groupId)?groupById(c.groupId):c; const list=scope&&scope.strokes||[];
    if(!list.length){box.innerHTML='<div class="hint">획이 없습니다. + 획 추가를 눌러 원하는 만큼 추가하세요.</div>';return;}
    list.forEach((s,i)=>{const el=document.createElement('div');el.className='effect-item';el.dataset.id=s.id;el.innerHTML=`
      <div class="effect-head"><strong>획 ${i+1}</strong><div class="effect-buttons"><button class="mini-icon" data-act="up">↑</button><button class="mini-icon" data-act="down">↓</button><button class="mini-icon danger" data-act="del">삭제</button></div></div>
      <div class="effect-grid">
        <label>굵기(px)<input data-k="width" type="number" min="0" max="500" step="1" value="${s.width}"></label>
        <label>위치<select data-k="position">${optionHtml(STROKE_POSITIONS,s.position)}</select></label>
        <label>혼합모드<select data-k="blend">${optionHtml(BLENDS,s.blend)}</select></label>
        <label>불투명도(%)<input data-k="opacity" type="number" min="0" max="100" step="1" value="${s.opacity}"></label>
        <label class="wide">색상${effectColorControl('stroke',s)}</label>
      </div>`;
      wireEffectItem(el,'stroke',s.id);box.appendChild(el);});
  }
  function renderInnerShadowList(c){
    const box=$('innerShadowList');box.innerHTML=''; const scope=(state.groupEffectEdit&&c.groupId)?groupById(c.groupId):c; const list=scope&&scope.innerShadows||[];
    if(!list.length){box.innerHTML='<div class="hint">내부 그림자가 없습니다. 여러 개를 겹쳐 입체감을 만들 수 있습니다.</div>';return;}
    list.forEach((s,i)=>{const el=document.createElement('div');el.className='effect-item';el.dataset.id=s.id;el.innerHTML=`
      <div class="effect-head"><strong>내부 그림자 ${i+1}</strong><div class="effect-buttons"><button class="mini-icon" data-act="up">↑</button><button class="mini-icon" data-act="down">↓</button><button class="mini-icon danger" data-act="del">삭제</button></div></div>
      <div class="effect-grid">
        <label>혼합모드<select data-k="blend">${optionHtml(BLENDS,s.blend)}</select></label>
        <label>불투명도(%)<input data-k="opacity" type="number" min="0" max="100" value="${s.opacity}"></label>
        <label>각도(숫자°)<input data-k="angle" type="number" step="1" value="${s.angle}"></label>
        <label>거리(px)<input data-k="distance" type="number" min="0" max="500" step="1" value="${s.distance}"></label>
        <label>경계 감소(%)<input data-k="choke" type="number" min="0" max="100" step="1" value="${s.choke}"></label>
        <label>크기/블러(px)<input data-k="size" type="number" min="0" max="200" step="1" value="${s.size}"></label>
        <label>윤곽선<select data-k="contour">${optionHtml(CONTOURS,s.contour)}</select></label>
        <label>품질(1~5)<input data-k="quality" type="number" min="1" max="5" step="1" value="${s.quality}"></label>
        <label class="wide">색상${effectColorControl('shadow',s)}</label>
      </div>`;
      wireEffectItem(el,'shadow',s.id);box.appendChild(el);});
  }
  function wireEffectItem(el,type,id){
    el.addEventListener('input',(ev)=>{
      const k=ev.target.dataset.k;if(!k||k==='colorHex')return; let v=ev.target.value;
      if(['width','opacity','angle','distance','choke','size','quality'].includes(k))v=Number(v)||0;
      applyEffectMutation(ch=>{ const arr=type==='stroke'?ch.strokes:ch.innerShadows; const item=arr.find(x=>x.id===id) || arr[el.dataset.index]; if(item)item[k]=v; });
      if(k==='color'){ const t=ev.target.parentElement.querySelector('[data-k="colorHex"]');if(t)t.value=normalizeHex(v); }
    });
    el.addEventListener('change',(ev)=>{
      if(ev.target.dataset.k==='colorHex'){const hex=normalizeHex(ev.target.value);ev.target.value=hex;const cp=ev.target.parentElement.querySelector('[data-k="color"]');if(cp)cp.value=hex;applyEffectMutation(ch=>{const arr=type==='stroke'?ch.strokes:ch.innerShadows;const item=arr.find(x=>x.id===id);if(item)item.color=hex;});}
    });
    el.addEventListener('click',(ev)=>{
      const act=ev.target.dataset.act;if(!act)return;ev.preventDefault();
      const scope=currentEffectScope();if(!scope)return;const targets=scope.type==='group'?[scope.group]:scope.chars;
      targets.forEach(target=>{const arr=type==='stroke'?target.strokes:target.innerShadows;const ix=arr.findIndex(x=>x.id===id); if(ix<0)return; if(act==='del')arr.splice(ix,1); else if(act==='up'&&ix>0)[arr[ix-1],arr[ix]]=[arr[ix],arr[ix-1]]; else if(act==='down'&&ix<arr.length-1)[arr[ix+1],arr[ix]]=[arr[ix],arr[ix+1]]; if(scope.type!=='group')markDirty(target);});
      clearRuntimeCaches();updateInspector();render();pushHistory();
    });
  }

  function addStroke(){ const scope=currentEffectScope(); if(!scope)return; if(scope.type==='group'){ const g=scope.group; g.strokes=g.strokes||[]; g.strokes.push(defaultStroke(g.strokes.length)); } else { const targets=scope.chars;if(!targets.length)return;const template=defaultStroke(targets[0].strokes.length);const sharedId=template.id;targets.forEach(ch=>{ch.strokes.push({...deepClone(template),id:sharedId});markDirty(ch)}); } clearRuntimeCaches();updateInspector();render();pushHistory(); }
  function addInnerShadow(){ const scope=currentEffectScope(); if(!scope)return; if(scope.type==='group'){ const g=scope.group; g.innerShadows=g.innerShadows||[]; g.innerShadows.push(defaultInnerShadow()); } else { const targets=scope.chars;if(!targets.length)return;const template=defaultInnerShadow();const sharedId=template.id;targets.forEach(ch=>{ch.innerShadows.push({...deepClone(template),id:sharedId});markDirty(ch)}); } clearRuntimeCaches();updateInspector();render();pushHistory();}

  function makeGroup(){
    const ids=[...state.selectedIds];if(ids.length<2){toast('그룹화할 글자를 2개 이상 선택하세요.');return;}const gid=uid('grp'); ids.forEach(id=>{const c=charById(id);if(c)c.groupId=gid;}); state.groups.push({id:gid,strokes:[],innerShadows:[]}); setSelection(ids,activeChar()?.id||ids[0]); updateAll();pushHistory();toast(`${ids.length}개 글자를 그룹으로 묶었습니다. 이제 함께 이동하며, 그룹 획은 합쳐진 외곽선으로 적용됩니다.`);
  }
  function ungroup(){const c=activeChar();if(!c||!c.groupId)return;const gid=c.groupId;groupMembers(gid).forEach(x=>x.groupId=null); state.groups=state.groups.filter(g=>g.id!==gid); updateAll();pushHistory();toast('그룹을 해제했습니다.');}

  function updateLayers(){
    const box=$('layerList');box.innerHTML='';[...state.chars].reverse().forEach(ch=>{const row=document.createElement('div');row.className='layer-row'+(ch.id===state.activeId?' active':'')+(state.selectedIds.has(ch.id)?' selected':'');row.draggable=true;row.dataset.id=ch.id;row.innerHTML=`<button class="layer-eye" title="표시/숨김">${ch.visible===false?'○':'●'}</button><button class="layer-lock" title="잠금">${ch.locked?'🔒':'🔓'}</button><div class="layer-name"><strong>${escapeHtml(ch.text)}</strong><span>${escapeHtml(ch.fontFamily)} · ${Math.round(ch.fontSize)}px · ${Math.round(ch.angle||0)}°</span></div>${ch.groupId?'<span class="group-dot" title="그룹"></span>':'<span></span>'}`;
      row.addEventListener('click',(e)=>{if(e.target.closest('button'))return;if(e.shiftKey){const ids=[...state.selectedIds];const ix=ids.indexOf(ch.id);if(ix>=0)ids.splice(ix,1);else ids.push(ch.id);setSelection(ids,ch.id);}else if(ch.groupId)setSelection(groupMembers(ch.groupId).map(x=>x.id),ch.id);else setSelection([ch.id],ch.id);});
      row.querySelector('.layer-eye').addEventListener('click',()=>{ch.visible=ch.visible===false?true:false;render();updateLayers();pushHistory();});
      row.querySelector('.layer-lock').addEventListener('click',()=>{ch.locked=!ch.locked;render();updateLayers();pushHistory();});
      row.addEventListener('dragstart',(e)=>{e.dataTransfer.setData('text/plain',ch.id);e.dataTransfer.effectAllowed='move';});
      row.addEventListener('dragover',(e)=>e.preventDefault());row.addEventListener('drop',(e)=>{e.preventDefault();const from=e.dataTransfer.getData('text/plain');reorderByDrop(from,ch.id);});box.appendChild(row);});
  }
  function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}
  function reorderByDrop(fromId,targetId){const a=state.chars.findIndex(c=>c.id===fromId),b=state.chars.findIndex(c=>c.id===targetId);if(a<0||b<0||a===b)return;const [it]=state.chars.splice(a,1);state.chars.splice(b,0,it);updateLayers();render();pushHistory();}
  function moveLayer(where){const c=activeChar();if(!c)return;let i=state.chars.indexOf(c);if(i<0)return;let ni=i;if(where==='up')ni=Math.min(state.chars.length-1,i+1);if(where==='down')ni=Math.max(0,i-1);if(where==='top')ni=state.chars.length-1;if(where==='bottom')ni=0;if(ni===i)return;state.chars.splice(i,1);state.chars.splice(ni,0,c);updateLayers();render();pushHistory();}
  function deleteSelected(){if(!state.selectedIds.size)return;state.chars=state.chars.filter(c=>!state.selectedIds.has(c.id));setSelection([]);pushHistory();updateAll();}

  function selectionBounds(){ const chars=[...state.selectedIds].map(charById).filter(Boolean); if(!chars.length) return null; let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; for(const ch of chars){ const b=objectBox(ch), pts=[worldPoint(ch,-b.w/2,-b.h/2),worldPoint(ch,b.w/2,-b.h/2),worldPoint(ch,b.w/2,b.h/2),worldPoint(ch,-b.w/2,b.h/2)]; for(const p of pts){ if(p.x<minX)minX=p.x; if(p.y<minY)minY=p.y; if(p.x>maxX)maxX=p.x; if(p.y>maxY)maxY=p.y; } } return {chars,minX,minY,maxX,maxY,cx:(minX+maxX)/2,cy:(minY+maxY)/2}; }
  function centerSelected(){ const b=selectionBounds(); if(!b)return; const dx=state.project.width/2-b.cx, dy=state.project.height/2-b.cy; b.chars.forEach(c=>{c.x+=dx;c.y+=dy}); render(); updateInspector(); pushHistory(); }
  function centerSelectedX(){ const b=selectionBounds(); if(!b)return; const dx=state.project.width/2-b.cx; b.chars.forEach(c=>{c.x+=dx}); render(); updateInspector(); pushHistory(); }
  function centerSelectedY(){ const b=selectionBounds(); if(!b)return; const dy=state.project.height/2-b.cy; b.chars.forEach(c=>{c.y+=dy}); render(); updateInspector(); pushHistory(); }

  function initFonts(){
    const base=['Malgun Gothic','Arial','Verdana','Georgia','Times New Roman','Courier New','sans-serif','serif'];
    state.customFonts=base.map(x=>({name:x,type:'system'}));refreshFontSelects(); renderFontManager();
  }
  function refreshFontSelects(){
    for(const el of [$('fontSelect'),$('charFontFamily')]){const current=el.value;el.innerHTML='';state.customFonts.forEach(f=>{const o=document.createElement('option');o.value=f.name;o.textContent=f.name+(f.type==='system'?'':' · 가져옴');el.appendChild(o)});if([...el.options].some(o=>o.value===current))el.value=current;}
    if(!$('fontSelect').value)$('fontSelect').value='Malgun Gothic'; renderFontManager();
  }
  function renderFontManager(){ const box=$('loadedFontList'); if(!box) return; const list=state.customFonts.filter(f=>f.type!=='system'); box.innerHTML=''; if(!list.length){box.innerHTML='<div class="hint">삭제 가능한 가져온 폰트가 아직 없습니다.</div>'; return;} list.forEach(f=>{ const row=document.createElement('div'); row.className='font-item'; const kind=f.type==='css'?'웹 CSS':f.type==='url'?'직접 URL':'로컬 파일'; const saved=f.saved===false?'':' · 자동 저장'; row.innerHTML=`<div class="font-meta"><strong>${escapeHtml(f.name)}</strong><span>${kind}${saved}</span><div class="font-preview" style="font-family:'${String(f.name).replace(/'/g,"\'")}'">가나다 ABC 123</div></div><div class="font-actions"><button class="ghost small" data-font-use="${escapeHtml(f.name)}">선택</button><button class="danger small" data-font-del="${escapeHtml(f.name)}">삭제</button></div>`; row.querySelector('[data-font-use]').addEventListener('click',()=>{$('fontSelect').value=f.name; if(activeChar()) applyCharMutation(ch=>ch.fontFamily=f.name);}); row.querySelector('[data-font-del]').addEventListener('click',()=>removeCustomFont(f.name)); box.appendChild(row); }); }
  function disposeFontResource(name){
    const reg=state.fontRegistry[name]; if(!reg)return;
    try{if(reg.fontFace)document.fonts.delete(reg.fontFace);}catch(_){}
    try{if(reg.link)reg.link.remove();}catch(_){}
    try{if(reg.style)reg.style.remove();}catch(_){}
    delete state.fontRegistry[name];
  }
  function registerFont(name,type,meta={}){
    const clean=cleanFamilyName(name); if(!clean)return;
    const existing=state.customFonts.find(f=>f.name===clean);
    if(existing) Object.assign(existing,{name:clean,type,...meta}); else state.customFonts.push({name:clean,type,...meta});
    refreshFontSelects(); $('fontSelect').value=clean;
  }
  async function addCssFont(){
    clearFontLoadStatus();
    const raw=$('fontCssUrl').value.trim(), explicit=cleanFamilyName($('fontCssFamily').value);
    const input=extractWebCssInput(raw);
    if(input.kind==='empty'){setFontLoadStatus('CSS 주소 또는 코드를 입력하세요.','error');toast('CSS 주소 또는 코드를 입력하세요.');return;}
    if(input.kind==='unknown'){setFontLoadStatus('지원하는 CSS 주소·<link>·@import·@font-face 형식이 아닙니다.','error');return;}

    setFontLoadStatus('웹폰트를 확인하고 있습니다…','info');
    let sourceUrl='', cssText='', resource=null, family=explicit, method='';
    try{
      if(input.kind==='css'){
        cssText=input.cssText;
        if(!family) family=extractFamiliesFromCss(cssText)[0]||'';
        if(!family) throw new Error('CSS에서 font-family 이름을 찾지 못했습니다. 아래 family 이름 칸에 직접 입력하세요.');
        disposeFontResource(family);
        resource=injectCssText(cssText,family); method='css-code';
      }else{
        sourceUrl=input.url;
        if(!family) family=inferFamilyFromGoogleUrl(sourceUrl);
        // 1차: CSS를 직접 받아 style로 삽입. 상대 font URL도 절대 URL로 보정합니다.
        try{
          cssText=await fetchCssText(sourceUrl);
          if(!family) family=extractFamiliesFromCss(cssText)[0]||'';
          if(!family) throw new Error('CSS에서 font-family 이름을 자동 감지하지 못했습니다.');
          disposeFontResource(family);
          resource=injectCssText(absolutizeCssUrls(cssText,sourceUrl),family); method='fetched-css';
        }catch(fetchErr){
          // 2차: CORS 때문에 fetch가 막힌 CSS는 브라우저 stylesheet 링크로 다시 시도합니다.
          if(!family) family=inferFamilyFromGoogleUrl(sourceUrl);
          if(!family&&explicit) family=explicit;
          if(!family) throw new Error('CSS 내용을 읽을 수 없어서 family 이름 자동 감지가 불가능합니다. family 이름을 직접 입력하세요.');
          disposeFontResource(family);
          const loaded=await loadCssLink(sourceUrl); resource=loaded.link; method='stylesheet-link';
        }
      }

      const ready=await ensureFontReady(family,12000);
      const meta={url:sourceUrl||'',cssText:input.kind==='css'?cssText:'',sourceMethod:method};
      registerFont(family,'css',meta);
      state.fontRegistry[family]={type:'css',...(resource&&resource.tagName==='LINK'?{link:resource}:{style:resource})};
      const savedCssText = method==='fetched-css' ? absolutizeCssUrls(cssText,sourceUrl) : (input.kind==='css'?cssText:'');
      const persisted=await saveFontRecord({name:family,type:'css',url:sourceUrl||'',cssText:savedCssText,sourceMethod:method,savedAt:Date.now()});
      const savedMeta=state.customFonts.find(f=>f.name===family);if(savedMeta)savedMeta.saved=persisted;
      $('fontCssFamily').value=family;
      refreshFontSelects(); clearRuntimeCaches(); render();
      if(ready){
        setFontLoadStatus(`✓ “${family}” 로드 완료. 폰트 목록에서 선택해 사용할 수 있습니다.`,'ok');
        toast(`웹폰트 “${family}”을 불러왔습니다.`);
      }else{
        setFontLoadStatus(`CSS는 연결됐지만 “${family}” 글꼴 파일 로드 확인이 끝나지 않았습니다. 우선 목록에 추가했습니다. 미리보기에서 모양을 확인하세요. 모양이 기본 폰트라면 family 이름 또는 폰트 서버 CORS 문제일 수 있습니다.`,'warn');
        toast(`“${family}”을 목록에 추가했습니다. 미리보기를 확인하세요.`);
      }
    }catch(e){
      try{resource?.remove();}catch(_){}
      const message=e&&e.message?e.message:'알 수 없는 오류';
      setFontLoadStatus(`불러오기 실패: ${message}`,'error');
      toast('웹폰트 연결에 실패했습니다. 아래 오류 설명을 확인하세요.');
      console.error('[FontFX webfont]',e);
    }
  }
  async function addUrlFont(){
    clearFontLoadStatus();
    const url=decodeHtmlUrl($('fontFileUrl').value.trim()),name=cleanFamilyName($('fontUrlFamily').value);
    if(!url||!name){toast('폰트 이름과 URL을 모두 입력하세요.');return;}
    setFontLoadStatus('폰트 파일을 직접 불러오는 중…','info');
    try{
      disposeFontResource(name);
      const ff=new FontFace(name,`url("${url.replace(/"/g,'%22')}")`); await ff.load(); document.fonts.add(ff);
      state.fontRegistry[name]={type:'url',fontFace:ff}; registerFont(name,'url',{url,saved:false});
      const persisted=await saveFontRecord({name,type:'url',url,savedAt:Date.now()}); const savedMeta=state.customFonts.find(f=>f.name===name);if(savedMeta)savedMeta.saved=persisted;refreshFontSelects();
      const ready=await ensureFontReady(name,7000);
      setFontLoadStatus(ready?`✓ “${name}” 직접 URL 폰트 로드 완료.`:`“${name}” 파일은 읽었지만 렌더링 확인이 지연되고 있습니다.` ,ready?'ok':'warn');
      toast(`URL 폰트 “${name}”을 적용할 수 있습니다.`);
    }catch(e){
      setFontLoadStatus('직접 폰트 URL을 읽지 못했습니다. 해당 서버가 외부 사이트에서 폰트 파일을 읽도록 CORS를 허용해야 합니다. 가능하면 폰트 파일을 내려받아 로컬 파일 선택으로 넣어주세요.','error');
      toast('URL 폰트를 불러오지 못했습니다.'); console.error('[FontFX font url]',e);
    }
  }
  async function addLocalFont(file){
    if(!file)return; clearFontLoadStatus();
    const name=cleanFamilyName(file.name.replace(/\.(ttf|otf|woff2?)$/i,''));
    setFontLoadStatus('로컬 폰트 파일을 읽는 중…','info');
    try{
      disposeFontResource(name); const buf=await file.arrayBuffer(); const ff=new FontFace(name,buf); await ff.load(); document.fonts.add(ff);
      state.fontRegistry[name]={type:'local',fontFace:ff}; registerFont(name,'local',{saved:false,fileName:file.name});
      const persisted=await saveFontRecord({name,type:'local',fileName:file.name,data:buf.slice(0),savedAt:Date.now()}); const savedMeta=state.customFonts.find(f=>f.name===name);if(savedMeta)savedMeta.saved=persisted;refreshFontSelects(); await ensureFontReady(name,5000);
      setFontLoadStatus(`✓ 로컬 폰트 “${name}” 로드 완료.`,'ok'); toast(`로컬 폰트 “${name}”을 불러왔습니다.`);
    }catch(e){setFontLoadStatus('이 폰트 파일을 브라우저에서 읽지 못했습니다. 손상 여부 또는 폰트 형식을 확인하세요.','error');toast('이 폰트 파일을 브라우저에서 읽지 못했습니다.');}
  }
  function removeCustomFont(name){
    const font=state.customFonts.find(f=>f.name===name); if(!font||font.type==='system') return;
    disposeFontResource(name); state.customFonts=state.customFonts.filter(f=>f.name!==name); deleteFontRecord(name);
    state.chars.forEach(ch=>{if(ch.fontFamily===name){ch.fontFamily='Malgun Gothic';markDirty(ch);}});
    clearRuntimeCaches();refreshFontSelects();updateAll();pushHistory();toast(`폰트 “${name}”을 삭제했습니다. 자동 저장된 사본도 함께 삭제했습니다.`);
  }

  function renderHarmony(colors){const box=$('harmonySwatches');box.innerHTML='';colors.forEach(c=>{const b=document.createElement('button');b.className='swatch';b.style.background=c;b.title=c;b.addEventListener('click',()=>applyColorToActive(c));box.appendChild(b);});}
  function renderBevelRecommendations(base){ const box=$('bevelSwatches'); if(!box) return; const rec=makeBevelRecommendations(base||'#9389DE'); box.innerHTML=''; [['상단빛',rec.highlight],['하단그림자',rec.shadow]].forEach(([label,colors])=>{ const row=document.createElement('div'); row.className='bevel-row'; const name=document.createElement('span'); name.textContent=label; row.appendChild(name); colors.forEach(c=>{ const b=document.createElement('button'); b.className='bevel-chip'; b.style.background=c; b.title=`${label} · ${c}`; b.addEventListener('click',()=>{ navigator.clipboard?.writeText(c).catch(()=>{}); toast(`${c} 색상을 복사했습니다.`); }); row.appendChild(b); }); box.appendChild(row); }); }
  function applyColorToActive(color){const c=activeChar();if(!c){toast('먼저 글자를 선택하세요.');return;}applyCharMutation(ch=>{ch.fill=color;if((ch.fillMode||'solid')!=='solid'){const g=ensureGradient(ch);const mid=[...g.stops].sort((a,b)=>Math.abs(a.position-50)-Math.abs(b.position-50))[0];if(mid)mid.color=normalizeHex(color);}});updateInspector();}
  function renderPalettes(){const box=$('paletteList');box.innerHTML='';PALETTES.forEach(([name,colors])=>{const wrap=document.createElement('div');wrap.className='palette';wrap.innerHTML=`<div class="palette-name">${name}</div><div class="palette-colors"></div>`;const row=wrap.querySelector('.palette-colors');colors.forEach(c=>{const b=document.createElement('button');b.style.background=c;b.title=c;b.addEventListener('click',()=>applyColorToActive(c));row.appendChild(b)});box.appendChild(wrap);});}

  function applyCanvasSize(){const w=clamp(Math.round(Number($('canvasWidth').value)||1200),32,8192),h=clamp(Math.round(Number($('canvasHeight').value)||1200),32,8192);state.project.width=w;state.project.height=h;resizeDisplay();pushHistory();toast(`${w}×${h}px 캔버스를 적용했습니다.`);}

  function serializable(){return {version:'1.2.9',project:deepClone(state.project),chars:deepClone(state.chars),groups:deepClone(state.groups),drawings:deepClone(state.drawings),drawTool:deepClone(state.drawTool),customFonts:state.customFonts.filter(f=>f.type!=='local'),groupEffectEdit:state.groupEffectEdit,effectPresets:deepClone(state.effectPresets)};}
  function snapshot(){return JSON.stringify({project:state.project,chars:state.chars,groups:state.groups,drawings:state.drawings,drawTool:state.drawTool,groupEffectEdit:state.groupEffectEdit});}
  function pushHistory(){if(state.suppressHistory)return;clearTimeout(historyTimer);const s=snapshot();if(state.history[state.historyIndex]===s)return;state.history=state.history.slice(0,state.historyIndex+1);state.history.push(s);if(state.history.length>80)state.history.shift();else state.historyIndex++;updateHistoryButtons();}
  function scheduleHistory(){clearTimeout(historyTimer);historyTimer=setTimeout(pushHistory,350);}
  function restoreSnapshot(s){state.suppressHistory=true;const d=JSON.parse(s);state.project=d.project;state.chars=d.chars;state.groups=d.groups||[];state.drawings=d.drawings||[]; state.drawTool=Object.assign({ enabled:false,color:'#FF5AA5',size:18,aboveText:true,stabilize:0.88,brushType:'pen',assistMode:'freehand' }, d.drawTool||{}); state.groupEffectEdit=d.groupEffectEdit!==false;clearRuntimeCaches();state.selectedIds=new Set();state.activeId=null;$('canvasWidth').value=state.project.width;$('canvasHeight').value=state.project.height;state.suppressHistory=false;resizeDisplay();updateAll(); updateDrawToolUI(); }
  function undo(){if(state.historyIndex<=0)return;state.historyIndex--;restoreSnapshot(state.history[state.historyIndex]);updateHistoryButtons();}
  function redo(){if(state.historyIndex>=state.history.length-1)return;state.historyIndex++;restoreSnapshot(state.history[state.historyIndex]);updateHistoryButtons();}
  function updateHistoryButtons(){$('undoBtn').disabled=state.historyIndex<=0;$('redoBtn').disabled=state.historyIndex>=state.history.length-1;}

  function downloadBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1200);}
  function saveProject(){const blob=new Blob([JSON.stringify(serializable(),null,2)],{type:'application/json'});downloadBlob(blob,`${sanitizeFilename($('exportName').value)}.fontfx.json`);}
  async function loadProject(file){
    if(!file)return;
    try{
      const d=JSON.parse(await file.text());if(!d.project||!Array.isArray(d.chars))throw new Error('format');
      state.project=d.project;state.chars=d.chars;state.groups=d.groups||[];state.drawings=d.drawings||[]; state.drawTool=Object.assign({ enabled:false,color:'#FF5AA5',size:18,aboveText:true,stabilize:0.88,brushType:'pen',assistMode:'freehand' }, d.drawTool||{}); state.groupEffectEdit=d.groupEffectEdit!==false;
      if(d.effectPresets)mergeEffectPresets(d.effectPresets);
      for(const f of (d.customFonts||[])){
        if(!state.customFonts.some(x=>x.name===f.name))state.customFonts.push(f);
        if(f.type==='css'){
          try{
            if(f.cssText){const style=injectCssText(f.cssText,f.name);state.fontRegistry[f.name]={type:'css',style};}
            else if(f.url){const loaded=await loadCssLink(f.url,8000);state.fontRegistry[f.name]={type:'css',link:loaded.link};}
          }catch(_){/* 프로젝트는 열되 폰트만 사용자가 다시 연결할 수 있게 둡니다. */}
        }
        if(f.type==='url'&&f.url){
          try{const ff=new FontFace(f.name,`url("${f.url}")`);const x=await ff.load();document.fonts.add(x);state.fontRegistry[f.name]={type:'url',fontFace:x};}catch(_){}
        }
      }
      refreshFontSelects();clearRuntimeCaches();$('canvasWidth').value=state.project.width;$('canvasHeight').value=state.project.height;state.history=[];state.historyIndex=-1;setSelection([]);resizeDisplay();pushHistory();updateAll();toast('프로젝트를 불러왔습니다.');
    }catch(e){toast('FontFX 프로젝트 JSON을 읽지 못했습니다.');}
  }

  function drawProjectToCanvas(scale=1,onlyChar=null,mode='canvas'){
    const chars=onlyChar?[onlyChar]:state.chars.filter(c=>c.visible!==false);
    let outW=state.project.width,outH=state.project.height,offsetX=0,offsetY=0;
    if(onlyChar&&mode==='tight'){
      const surf=renderCharSurface(onlyChar,Math.max(2,scale*2));const m=charAffine(onlyChar); const hw=surf.logicalW/2, hh=surf.logicalH/2; const pts=[{x:-hw,y:-hh},{x:hw,y:-hh},{x:hw,y:hh},{x:-hw,y:hh}].map(p=>({x:m.a*p.x+m.c*p.y,y:m.b*p.x+m.d*p.y})); const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y); const boundW=Math.max(...xs)-Math.min(...xs), boundH=Math.max(...ys)-Math.min(...ys); outW=Math.ceil(boundW+8); outH=Math.ceil(boundH+8); offsetX=outW/2-onlyChar.x; offsetY=outH/2-onlyChar.y;
    }
    const out=document.createElement('canvas');out.width=Math.max(1,Math.round(outW*scale));out.height=Math.max(1,Math.round(outH*scale));const g=out.getContext('2d');g.setTransform(scale,0,0,scale,offsetX*scale,offsetY*scale);
    if(!onlyChar){
      drawFreehand(g,'below',{onlyGlobal:true});
      drawGroupEffects(g,'before');
      chars.forEach(ch=>{ drawFreehand(g,'below',{onlyAnchorCharId:ch.id}); drawChar(g,ch,Math.max(2,scale*2*(ch.scale||1))); drawFreehand(g,'above',{onlyAnchorCharId:ch.id}); });
      drawGroupEffects(g,'after');
      const seenGroups=new Set();
      chars.forEach(ch=>{ if(ch.groupId && !seenGroups.has(ch.groupId)){ seenGroups.add(ch.groupId); drawFreehand(g,'below',{onlyGroupId:ch.groupId}); drawFreehand(g,'above',{onlyGroupId:ch.groupId}); } });
      drawFreehand(g,'above',{onlyGlobal:true});
    } else {
      drawFreehand(g,'below',{onlyChar});
      drawChar(g,onlyChar,Math.max(2,scale*2*(onlyChar.scale||1)));
      drawFreehand(g,'above',{onlyChar});
    }
    return out;
  }
  function canvasBlob(c){return new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('PNG export failed')),'image/png'));}
  async function exportCombined(){
    if(!state.chars.length){toast('저장할 글자가 없습니다.');return;}const scale=Number($('exportScale').value)||1;try{await document.fonts.ready;const out=drawProjectToCanvas(scale);const blob=await canvasBlob(out);downloadBlob(blob,`${sanitizeFilename($('exportName').value)}.png`);toast('투명 PNG를 저장했습니다.');}catch(e){toast('PNG 저장에 실패했습니다. 원격 폰트 CORS를 확인하세요.');}
  }

  // Minimal ZIP writer (STORE method, no compression) so the app stays dependency-free/offline.
  const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
  function crc32(bytes){let c=0xFFFFFFFF;for(const b of bytes)c=crcTable[(c^b)&0xFF]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
  function u16(v){return new Uint8Array([v&255,(v>>>8)&255]);} function u32(v){return new Uint8Array([v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255]);}
  function concatArrays(arrs){const len=arrs.reduce((n,a)=>n+a.length,0),out=new Uint8Array(len);let p=0;for(const a of arrs){out.set(a,p);p+=a.length;}return out;}
  function dosDateTime(d=new Date()){let year=Math.max(1980,d.getFullYear());return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()};}
  async function makeZip(files){
    const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;const dt=dosDateTime();
    for(const f of files){const name=enc.encode(f.name),data=new Uint8Array(await f.blob.arrayBuffer()),crc=crc32(data);const local=concatArrays([u32(0x04034b50),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);
      const central=concatArrays([u32(0x02014b50),u16(20),u16(20),u16(0x0800),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length;}
    const centralData=concatArrays(centrals);const end=concatArrays([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralData.length),u32(offset),u16(0)]);return new Blob([concatArrays([...locals,centralData,end])],{type:'application/zip'});
  }
  async function exportChars(){
    const visible=state.chars.filter(c=>c.visible!==false);if(!visible.length){toast('저장할 글자가 없습니다.');return;}const scale=Number($('exportScale').value)||1,mode=$('perCharMode').value,base=sanitizeFilename($('exportName').value),folder=`${base}_characters/`;try{await document.fonts.ready;const files=[];for(let i=0;i<visible.length;i++){const ch=visible[i],out=drawProjectToCanvas(scale,ch,mode),blob=await canvasBlob(out),safe=sanitizeFilename(ch.text)||`char_${i+1}`;files.push({name:`${folder}${String(i+1).padStart(2,'0')}_${safe}.png`,blob});}const zip=await makeZip(files);downloadBlob(zip,`${base}_characters.zip`);toast(`${files.length}개 글자 PNG를 ZIP으로 저장했습니다.`);}catch(e){console.error(e);toast('글자별 ZIP 저장에 실패했습니다.');}
  }

  function copyStyle(){ const c=activeChar(); if(!c){toast('스타일을 복사할 글자를 선택하세요.'); return;} state.styleClipboard=charStyleSnapshot(c); toast('스타일을 복사했습니다.'); }
  function pasteStyle(){ if(!state.styleClipboard){toast('복사된 스타일이 없습니다.'); return;} const targets=state.selectedIds.size?[...state.selectedIds].map(charById).filter(Boolean):[activeChar()].filter(Boolean); if(!targets.length){toast('스타일을 붙여넣을 글자를 선택하세요.'); return;} targets.forEach(ch=>applyStyleSnapshot(ch,state.styleClipboard)); clearRuntimeCaches(); updateAll(); pushHistory(); toast(`${targets.length}개 글자에 스타일을 붙여넣었습니다.`); }

  function updateAll(){updateInspector();updateLayers();updateDrawToolUI();render();updateHistoryButtons();}

  function bindInspector(){
    $('charText').addEventListener('input',e=>applyCharMutation(c=>c.text=e.target.value||' '));
    $('charFontSize').addEventListener('input',e=>applyCharMutation(c=>c.fontSize=clamp(Number(e.target.value)||8,8,1200)));
    $('charFontFamily').addEventListener('change',e=>applyCharMutation(c=>c.fontFamily=e.target.value));
    $('charFillMode').addEventListener('change',e=>{applyCharMutation(c=>{c.fillMode=e.target.value;ensureGradient(c)});updateInspector();});
    $('charFill').addEventListener('input',e=>{const h=normalizeHex(e.target.value);$('charFillHex').value=h;applyCharMutation(c=>{c.fill=h;if((c.fillMode||'solid')!=='solid'){const g=ensureGradient(c),mid=[...g.stops].sort((a,b)=>Math.abs(a.position-50)-Math.abs(b.position-50))[0];if(mid)mid.color=h;}})});
    $('charFillHex').addEventListener('change',e=>{const h=normalizeHex(e.target.value,activeChar()?.fill||'#000000');e.target.value=h;$('charFill').value=h;applyCharMutation(c=>{c.fill=h;if((c.fillMode||'solid')!=='solid'){const g=ensureGradient(c),mid=[...g.stops].sort((a,b)=>Math.abs(a.position-50)-Math.abs(b.position-50))[0];if(mid)mid.color=h;}})});
    $('gradientAngle').addEventListener('input',e=>{applyCharMutation(c=>{ensureGradient(c).angle=Number(e.target.value)||0});renderGradientPreview(activeChar());});
    $('gradientRange').addEventListener('input',e=>{applyCharMutation(c=>{ensureGradient(c).range=clamp(Number(e.target.value)||100,1,600)});renderGradientPreview(activeChar());});
    $('gradientCenterX').addEventListener('input',e=>{applyCharMutation(c=>{const v=Number(e.target.value);ensureGradient(c).centerX=Number.isFinite(v)?clamp(v,-300,300):50});renderGradientPreview(activeChar());});
    $('gradientCenterY').addEventListener('input',e=>{applyCharMutation(c=>{const v=Number(e.target.value);ensureGradient(c).centerY=Number.isFinite(v)?clamp(v,-300,300):50});renderGradientPreview(activeChar());});
    $('charX').addEventListener('input',e=>applyCharMutation(c=>c.x=Number(e.target.value)||0,false));
    $('charY').addEventListener('input',e=>applyCharMutation(c=>c.y=Number(e.target.value)||0,false));
    $('charAngle').addEventListener('input',e=>applyCharMutation(c=>c.angle=Number(e.target.value)||0,false));
    $('charScale').addEventListener('input',e=>applyCharMutation(c=>c.scale=clamp(Number(e.target.value)||1,.05,20),false));
    $('charScaleX').addEventListener('input',e=>applyCharMutation(c=>c.scaleX=clamp(Number(e.target.value)||1,.05,20),false));
    $('charScaleY').addEventListener('input',e=>applyCharMutation(c=>c.scaleY=clamp(Number(e.target.value)||1,.05,20),false));
    $('charSkewX').addEventListener('input',e=>applyCharMutation(c=>c.skewX=clamp(Number(e.target.value)||0,-89,89),false));
    $('charSkewY').addEventListener('input',e=>applyCharMutation(c=>c.skewY=clamp(Number(e.target.value)||0,-89,89),false));
  }

  function bindEvents(){
    $('applyCanvasSize').addEventListener('click',applyCanvasSize);document.querySelectorAll('.canvas-preset').forEach(b=>b.addEventListener('click',()=>{$('canvasWidth').value=b.dataset.w;$('canvasHeight').value=b.dataset.h;applyCanvasSize();}));
    $('createTextBtn').addEventListener('click',createText);$('addCssFontBtn').addEventListener('click',addCssFont);$('addUrlFontBtn').addEventListener('click',addUrlFont);$('localFontInput').addEventListener('change',e=>addLocalFont(e.target.files[0]));
    $('fontSelect').addEventListener('change',()=>{const name=$('fontSelect').value; if(state.selectedIds.size){ [...state.selectedIds].map(charById).filter(Boolean).forEach(ch=>{ch.fontFamily=name; markDirty(ch);}); clearRuntimeCaches(); updateAll(); pushHistory(); }});$('makeHarmonyBtn').addEventListener('click',()=>{const h=normalizeHex($('harmonyBaseHex').value,$('harmonyBaseColor').value);$('harmonyBaseHex').value=h;$('harmonyBaseColor').value=h;renderHarmony(makeHarmony(h));});$('harmonyBaseColor').addEventListener('input',e=>{$('harmonyBaseHex').value=normalizeHex(e.target.value);renderHarmony(makeHarmony(e.target.value));});$('harmonyBaseHex').addEventListener('change',e=>{const h=normalizeHex(e.target.value);e.target.value=h;$('harmonyBaseColor').value=h;renderHarmony(makeHarmony(h));});
    $('addGradientStopBtn').addEventListener('click',addGradientStop);document.querySelectorAll('.gradient-preset').forEach(b=>b.addEventListener('click',()=>applyGradientPreset(b.dataset.preset)));
    $('addStrokeBtn').addEventListener('click',addStroke);$('addInnerShadowBtn').addEventListener('click',addInnerShadow);$('makeGroupBtn').addEventListener('click',makeGroup);$('ungroupBtn').addEventListener('click',ungroup);$('groupEffectToggle').addEventListener('change',e=>{state.groupEffectEdit=e.target.checked;updateInspector();pushHistory();});$('groupMoveToggle').addEventListener('change',e=>state.groupMove=e.target.checked);$('copyStyleBtn').addEventListener('click',copyStyle);$('pasteStyleBtn').addEventListener('click',pasteStyle);
    $('saveStrokePresetBtn').addEventListener('click',()=>saveEffectPreset('stroke'));$('applyStrokePresetBtn').addEventListener('click',()=>applyEffectPreset('stroke'));$('deleteStrokePresetBtn').addEventListener('click',()=>deleteEffectPreset('stroke'));
    $('saveShadowPresetBtn').addEventListener('click',()=>saveEffectPreset('shadow'));$('applyShadowPresetBtn').addEventListener('click',()=>applyEffectPreset('shadow'));$('deleteShadowPresetBtn').addEventListener('click',()=>deleteEffectPreset('shadow'));
    $('strokePresetName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveEffectPreset('stroke');}});$('shadowPresetName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();saveEffectPreset('shadow');}});
    $('layerTopBtn').addEventListener('click',()=>moveLayer('top'));$('layerUpBtn').addEventListener('click',()=>moveLayer('up'));$('layerDownBtn').addEventListener('click',()=>moveLayer('down'));$('layerBottomBtn').addEventListener('click',()=>moveLayer('bottom'));
    $('fitBtn').addEventListener('click',fitPreview); $('centerSelectedBtn').addEventListener('click',centerSelected); $('centerXBtn').addEventListener('click',centerSelectedX); $('centerYBtn').addEventListener('click',centerSelectedY); ['drawModeBtn','drawModeBtn2'].forEach(id=>$(id).addEventListener('click',()=>{setDrawMode(!state.drawTool.enabled);}));
    $('zoomOutBtn').addEventListener('click',()=>zoomBy(1/1.2)); $('zoomInBtn').addEventListener('click',()=>zoomBy(1.2)); $('zoomValueBtn').addEventListener('click',zoomTo100);
    $('zoomSlider').addEventListener('input',e=>applyPreviewZoom(clamp((Number(e.target.value)||100)/100,.05,4),'manual'));
    viewport.addEventListener('wheel',e=>{ if(!(e.ctrlKey||e.metaKey))return; e.preventDefault(); zoomBy(e.deltaY<0?1.12:1/1.12,{x:e.clientX,y:e.clientY}); },{passive:false});
    $('drawColor').addEventListener('input',e=>{ state.drawTool.color=normalizeHexInput(e.target.value,'#FF5AA5'); updateDrawToolUI(); });
    $('drawColorHex').addEventListener('change',e=>{ state.drawTool.color=normalizeHexInput(e.target.value,state.drawTool.color); updateDrawToolUI(); });
    $('drawBrushType').addEventListener('change',e=>{ state.drawTool.brushType=e.target.value||'pen'; updateDrawToolUI(); });
    $('drawAssistMode').addEventListener('change',e=>{ state.drawTool.assistMode=e.target.value||'freehand'; updateDrawToolUI(); });
    $('drawBrushSize').addEventListener('input',e=>{ state.drawTool.size=clamp(Number(e.target.value)||18,1,160); updateDrawToolUI(); });
    $('undoLastDrawBtn').addEventListener('click',removeLastDrawing); $('clearDrawingsBtn').addEventListener('click',clearAllDrawings); $('drawBelowTextBtn').addEventListener('click',()=>{ state.drawTool.aboveText=!state.drawTool.aboveText; updateDrawToolUI(); render(); });
    $('exportCombinedBtn').addEventListener('click',exportCombined);$('exportCharsBtn').addEventListener('click',exportChars);$('saveProjectBtn').addEventListener('click',saveProject);$('loadProjectInput').addEventListener('change',e=>loadProject(e.target.files[0]));
    $('undoBtn').addEventListener('click',undo);$('redoBtn').addEventListener('click',redo);window.addEventListener('resize',()=>setTimeout(resizeDisplay,50));
    bindInspector();
  }

  async function boot(){loadEffectPresets();initFonts();renderPalettes();renderHarmony(makeHarmony('#9389DE'));renderAllEffectPresetControls();bindEvents();resizeDisplay();pushHistory();updateAll();await restoreSavedFonts();updateAll();}
  boot();
})();
