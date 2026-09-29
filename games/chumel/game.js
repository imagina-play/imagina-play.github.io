'use strict';
(() => {
const $=s=>document.querySelector(s),canvas=$('#screen'),ctx=canvas.getContext('2d',{alpha:false});
const {Game,LEVELS,clamp,isDownGesture,plasmaFrame,macheteFrame}=window.PulsoEngine,g=new Game();
g.events=[];
const assets={},keys=new Set(),input={axis:0,guard:false},touch={x:0,y:0,id:null,b:false,bTime:0},W=480,H=270;
let atlas,loaded=false,last=0,noticeTimer=0,uiTimer=0,visualTime=0,fromHelp='menu',musicStep=0,musicTime=0;
let qaSession=false,panelOpen=null,panelReturnFocus=null,unlockTimer=0;
ctx.imageSmoothingEnabled=false;
// Keep the protagonist on a dedicated image layer. Its visibility must not
// depend on mobile Canvas atlas-cropping/compositing or the joystick overlay.
const playerNode=document.createElement('div');
playerNode.id='player-sprite';playerNode.setAttribute('role','img');playerNode.setAttribute('aria-label','Chumel');playerNode.hidden=true;
playerNode.style.cssText='position:absolute;left:0;top:0;overflow:hidden;pointer-events:none;z-index:2;image-rendering:pixelated;transform-origin:center center;will-change:transform';
$('#game').appendChild(playerNode);
let spriteScale=1,spriteOffsetX=0,spriteOffsetY=0,spriteFrame=-1,spriteSheet='',spriteLayoutScale=0;
function layoutPlayer(){const width=canvas.clientWidth,height=canvas.clientHeight;spriteScale=Math.min(width/W,height/H);spriteOffsetX=(width-W*spriteScale)/2;spriteOffsetY=(height-H*spriteScale)/2;spriteLayoutScale=0;}
window.addEventListener('resize',layoutPlayer);
if(typeof ResizeObserver!=='undefined')new ResizeObserver(layoutPlayer).observe(canvas);
function preparePlayer(){for(const name of ['player','machete']){const im=assets[name];im.alt='';im.draggable=false;im.hidden=name!=='player';im.style.cssText='position:absolute;max-width:none;image-rendering:pixelated;pointer-events:none;user-select:none';playerNode.appendChild(im);}layoutPlayer();}
function renderPlayer(camera,shakeX=0,shakeY=0){
 playerNode.hidden=g.mode==='menu';if(playerNode.hidden)return;
 const pose=playerFrame(g.p),name=pose>=24?'machete':'player',frame=pose>=24?pose-24:pose,im=assets[name];
 const info=name==='machete'?atlas.machete.frames[frame]:{source:[frame%6*256,Math.floor(frame/6)*256,256,256],anchor:[128,256]},[sx,sy,sw,sh]=info.source,worldScale=name==='machete'?atlas.machete.worldScale:60/256,scale=worldScale*spriteScale;
 if(frame!==spriteFrame||name!==spriteSheet||spriteLayoutScale!==spriteScale){
  assets.player.hidden=name!=='player';assets.machete.hidden=name!=='machete';playerNode.style.width=sw*scale+'px';playerNode.style.height=sh*scale+'px';
  // Mirror around the hip, not the crop center: weapon reach stays symmetric.
  playerNode.style.transformOrigin=info.anchor[0]*scale+'px '+info.anchor[1]*scale+'px';
  im.style.width=im.naturalWidth*scale+'px';im.style.height=im.naturalHeight*scale+'px';im.style.left=-sx*scale+'px';im.style.top=-sy*scale+'px';spriteFrame=frame;spriteSheet=name;spriteLayoutScale=spriteScale;
 }
 const x=(Math.round(g.p.x+9)-camera+shakeX)*spriteScale-info.anchor[0]*scale+spriteOffsetX,y=(Math.round(g.p.y+(name==='machete'?48:49))+shakeY)*spriteScale-info.anchor[1]*scale+spriteOffsetY;
 playerNode.style.transform=`translate3d(${x}px,${y}px,0) scaleX(${g.p.dir<0?-1:1})`;playerNode.style.opacity=g.p.inv>0&&Math.floor(g.time*14)%2?'.8':'1';
}
class Sound{
 constructor(){this.ctx=null;this.muted=false;}
 init(){try{if(!this.ctx)this.ctx=new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended'||this.ctx.state==='interrupted')this.ctx.resume().catch(()=>{});}catch{}}
 tone(freq,duration=.1,type='square',volume=.035,end){if(this.muted||!this.ctx)return;const c=this.ctx,o=c.createOscillator(),v=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,c.currentTime);if(end)o.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);v.gain.setValueAtTime(volume,c.currentTime);v.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(v);v.connect(c.destination);o.start();o.stop(c.currentTime+duration);}
 fx(n){const f={jump:[260,.12,'square',.025,530],double:[520,.16,'square',.028,950],dash:[340,.12,'sawtooth',.017,60],swing:[150,.065,'triangle',.09,50],sword:[750,.11,'sawtooth',.018,90],plasma:[860,.13,'square',.025,110],hit:[100,.08,'sawtooth',.05,35],hurt:[170,.22,'sawtooth',.035,42],parryStart:[800,.1,'triangle',.035,950],parry:[1300,.25,'triangle',.09,2100],block:[480,.055,'square',.02,160],pickup:[660,.22,'triangle',.07,1320],boss:[95,.4,'sawtooth',.035,35],victory:[440,.65,'triangle',.06,1760]}[n];if(f)this.tone(...f);}
 music(dt){if(this.muted||g.mode!=='playing')return;musicTime-=dt;if(musicTime>0)return;musicTime=.145;const bass=[110,110,130.81,110,98,98,82.41,98,110,110,146.83,130.81,98,98,82.41,98],melody=[440,0,659.25,0,587.33,523.25,0,392,440,0,523.25,659.25,587.33,0,392,0];const i=musicStep++%16;this.tone(bass[i]*(g.level===2?.75:1),.14,'triangle',.027);if(melody[i])this.tone(melody[i],.07,'square',.008);if(i%4===0)this.tone(90,.065,'triangle',.07,30);}
}
const portraitPhone=window.matchMedia('(orientation: portrait) and (max-width: 900px)');
const sound=new Sound();document.addEventListener('pointerdown',()=>sound.init(),{passive:true});
function loadImage(name,path){return new Promise((resolve,reject)=>{const im=new Image();im.onload=async()=>{try{if(im.decode)await im.decode();if(!im.naturalWidth||!im.naturalHeight)throw Error('Imagen vacía: '+path);assets[name]=im;resolve(im);}catch(error){reject(error);}};im.onerror=()=>reject(new Error('No se pudo cargar '+path));im.src=window.PULSO_INLINE?.images?.[name]||path;});}
const manifestPromise=window.PULSO_INLINE?Promise.resolve(window.PULSO_INLINE.atlas):fetch('assets/atlas-manifest.json?v=7').then(r=>{if(!r.ok)throw Error('Atlas no disponible');return r.json()});
Promise.all([loadImage('player','assets/player.webp?v=3'),loadImage('machete','assets/machete.webp?v=7'),loadImage('enemies','assets/enemies.webp'),loadImage('street','assets/street.webp'),loadImage('palace','assets/palace.webp'),loadImage('archive','assets/archive.webp'),manifestPromise.then(a=>atlas=a)]).then(()=>{preparePlayer();loaded=true;$('#qa-open').disabled=false;$('#loading').hidden=true;requestAnimationFrame(loop);registerTools();}).catch(error=>{$('#loading').textContent='No se pudo cargar el juego. Toca para reintentar.';$('#loading').onclick=()=>location.reload();console.error(error);});
function screenMode(){const active=['playing','paused','dead','transition','won'].includes(g.mode);$('#menu').hidden=g.mode!=='menu';$('#hud').hidden=!active;$('#notice').hidden=!active;$('#touch').hidden=panelOpen||g.mode!=='playing';$('#boss-hud').hidden=!(active&&g.bossActive&&g.boss&&g.boss.hp>0);$('#qa-badge').hidden=!qaSession||!active;$('#unlock-banner').hidden=!(!panelOpen&&g.mode==='playing'&&unlockTimer>0);}
function clearInput(){keys.clear();touch.x=touch.y=0;touch.id=null;touch.b=false;input.axis=0;input.guard=false;$('#stick').style.transform='';$('#attack').classList.remove('pressed');$('#jump').classList.remove('pressed');}
function showDialog(eyebrow,title,body,actions){clearInput();$('#dialog').classList.remove('qa-dialog');$('#dialog-eyebrow').textContent=eyebrow;$('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-actions').replaceChildren();for(const [label,fn,alt]of actions){const b=document.createElement('button');b.textContent=label;if(alt)b.className='alt';b.onclick=fn;$('#dialog-actions').appendChild(b);}$('#dialog').hidden=false;screenMode();}
function hideDialog(){$('#dialog').hidden=true;$('#dialog').classList.remove('qa-dialog');clearInput();screenMode();last=performance.now();}
function begin(){if(!loaded)return;closePanel(false);sound.init();qaSession=false;unlockTimer=0;noticeTimer=0;$('#notice').textContent='';g.start();hideDialog();handleEvents();}
// Panels freeze the underlying state without replacing its dialogs or callbacks.
function openPanel(name){
 if(!loaded||panelOpen===name)return;if(panelOpen)closePanel(false);sound.init();panelReturnFocus=document.activeElement;panelOpen=name;clearInput();
 const panel=$('#'+name+'-panel');
 for(const el of $('#game').children)if(el.id!=='qa-open'&&el!==panel)el.inert=true;
 panel.hidden=false;$('#qa-open').setAttribute('aria-expanded',String(name==='qa'));$('#qa-open').setAttribute('aria-label',name==='qa'?'Cerrar modo QA':'Abrir modo QA');$('#qa-open span').textContent=name==='qa'?'CERRAR':'NIVELES';screenMode();panel.querySelector('button').focus();
}
function openQA(){openPanel('qa');}
function closePanel(restoreFocus=true){
 if(!panelOpen)return;$('#'+panelOpen+'-panel').hidden=true;panelOpen=null;
 for(const el of $('#game').children)el.inert=false;
 $('#qa-open').setAttribute('aria-expanded','false');$('#qa-open').setAttribute('aria-label','Abrir modo QA');$('#qa-open span').textContent='NIVELES';clearInput();screenMode();last=performance.now();
 if(restoreFocus)(panelReturnFocus?.isConnected&&panelReturnFocus.getClientRects().length?panelReturnFocus:$('#qa-open')).focus();
}
function startQA(destination){closePanel(false);qaSession=true;unlockTimer=0;noticeTimer=0;$('#notice').textContent='';g.startQA(destination);hideDialog();handleEvents();screenMode();sound.fx('pickup');}
function showLevelIntro(n,first=false){g.mode='transition';const title=n===0?'La calle no calla.':n===1?'Corta con la impunidad.':'Que la verdad ilumine.';let copy=n===0?'Los corruptos tomaron el barrio. Abre camino hasta el palacio.':n===1?'Has conseguido el machete. Ataca por la espalda a los escudos o devuélveles el golpe con un parry.':'Has conseguido el plasma. Administra tu energía y devuelve los bulos de La Ignorancia.';copy+='<div class="control-grid"><div><b>JOYSTICK</b><span>Muévete a los lados<br>↓ + A: dash<br>↓ + B: parry</span></div><div><b>A · SALTO</b><span>Salta en carrera<br>Doble salto bloqueado<br>Se activa ante el jefe</span></div><div><b>B · ATAQUE</b><span>Pulsa para combos<br>Mantén para cubrirte<br>La energía se regenera</span></div></div><small>Teclado: A/D o flechas · Espacio: salto · J: ataque · K: dash · L: parry · Esc: pausa</small>';showDialog('NIVEL '+(n+1)+' / 3 · '+LEVELS[n].weapon,title,copy,[[first?'ENTRAR AL BARRIO':'CONTINUAR',()=>{g.mode='playing';hideDialog();sound.fx('pickup');}]]);}
function pause(){if(!panelOpen&&g.mode==='playing'){g.pause();const actions=[['SEGUIR',()=>{g.resume();hideDialog();}],['CONTROLES',()=>help()]];if(qaSession)actions.push(['CAMBIAR NIVEL',openQA]);actions.push(['SALIR',menu,true]);showDialog('PAUSA','La verdad puede esperar.','Recupera el aliento. Tu progreso sigue aquí.',actions);}}
function menu(){g.mode='menu';g.bossActive=false;qaSession=false;unlockTimer=0;hideDialog();screenMode();}
function help(){fromHelp=g.mode;if(g.mode==='playing')g.pause();showDialog('MANUAL DE COMBATE','Dos botones. Muchas respuestas.','<div class="control-grid"><div><b>MOVER / ESQUIVAR</b><span>Joystick o A/D / ← →<br>↓ + A o K: dash<br>El dash evita daño</span></div><div><b>SALTAR / ATACAR</b><span>A o Espacio: salto<br>Doble salto: ante el jefe<br>B o J: combo de 3</span></div><div><b>PARRY / GUARDIA</b><span>↓ + B o L: parry<br>Mantén B: cubrirte<br>Parry devuelve plasma</span></div></div><p>La señal <b style="color:#ffd789">!</b> anuncia un ataque. Haz parry justo antes del impacto. Los destellos verdes recuperan salud; los faros activan puntos de control.</p>',[['ENTENDIDO',()=>{if(fromHelp==='menu'){g.mode='menu';hideDialog();}else{g.mode='playing';hideDialog();}}]]);}
$('#start').onclick=begin;$('#how').onclick=help;$('#pause').onclick=pause;$('#qa-open').onclick=()=>panelOpen==='qa'?closePanel():openQA();$('#qa-back').onclick=()=>closePanel();for(const b of document.querySelectorAll('[data-qa-destination]'))b.onclick=()=>startQA(b.dataset.qaDestination==='boss'?'boss':Number(b.dataset.qaDestination));
// Fullscreen must be requested directly from a player gesture. The help panel
// freezes the simulation and keeps any existing pause/level dialog underneath.
const standaloneDisplay=window.matchMedia('(display-mode: standalone)'),fullscreenDisplay=window.matchMedia('(display-mode: fullscreen)');
const fullscreenButtons=[...document.querySelectorAll('[data-fullscreen]')];
const fullscreenElement=()=>document.fullscreenElement||document.webkitFullscreenElement;
const standalone=()=>standaloneDisplay.matches||fullscreenDisplay.matches||window.navigator.standalone===true;
const canFullscreen=()=>!!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen);
let fullscreenPending=false;
function displayHelp(message=''){
 $('#display-feedback').textContent=message;$('#display-feedback').hidden=!message;openPanel('display');
}
function syncFullscreen(){
 const active=!!fullscreenElement();
 for(const b of fullscreenButtons){
  const label=active?'SALIR DE PANTALLA COMPLETA':'PANTALLA COMPLETA';
  b.setAttribute('aria-pressed',String(active));b.setAttribute('aria-label',active?'Salir de pantalla completa':'Pantalla completa');b.title=label;
  const text=b.querySelector('[data-fullscreen-label]');if(text)text.textContent=label;
  b.hidden=!active&&standalone()&&!canFullscreen();
 }
 fitViewport();
}
async function toggleFullscreen(){
 if(fullscreenPending)return;
 if(!fullscreenElement()&&!canFullscreen()){displayHelp('Este navegador no permite activar la pantalla completa aquí. Usa el acceso de la pantalla de inicio.');return;}
 fullscreenPending=true;
 try{
  if(fullscreenElement()){
   const exit=document.exitFullscreen||document.webkitExitFullscreen;
   if(exit)await exit.call(document);
  }else{
   const root=document.documentElement;
   if(root.requestFullscreen)await root.requestFullscreen({navigationUI:'hide'});
   else await root.webkitRequestFullscreen();
  }
 }catch{displayHelp('El navegador no pudo activar la pantalla completa. Puedes seguir jugando o usar estas alternativas.');}
 finally{fullscreenPending=false;syncFullscreen();}
}
for(const b of fullscreenButtons)b.addEventListener('click',toggleFullscreen);
for(const b of document.querySelectorAll('[data-display-help]'))b.addEventListener('click',()=>displayHelp());
$('#display-back').onclick=()=>closePanel();
document.addEventListener('fullscreenchange',syncFullscreen);document.addEventListener('webkitfullscreenchange',syncFullscreen);
standaloneDisplay.addEventListener?.('change',syncFullscreen);fullscreenDisplay.addEventListener?.('change',syncFullscreen);syncFullscreen();
$('#sound').onclick=()=>{sound.init();sound.muted=!sound.muted;$('#sound').textContent=sound.muted?'♪̸':'♪';$('#sound').setAttribute('aria-pressed',String(sound.muted));};
function fitViewport(){
 const v=window.visualViewport,root=document.documentElement;
 root.style.setProperty('--view-w',(v?.width||innerWidth)+'px');root.style.setProperty('--view-h',(v?.height||innerHeight)+'px');
 layoutPlayer();
}
window.visualViewport?.addEventListener('resize',fitViewport);window.addEventListener('resize',fitViewport);window.addEventListener('pageshow',()=>{fitViewport();clearInput();last=performance.now();});fitViewport();
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden){clearInput();pause();}});window.addEventListener('blur',()=>{clearInput();pause();});
window.addEventListener('resize',()=>{if(innerHeight>innerWidth&&innerWidth<900)pause();});
document.addEventListener('keydown',e=>{const k=e.code;
 if(panelOpen){
  if(k==='Escape'){e.preventDefault();closePanel();}
  else if(k==='Tab'){
   const buttons=[$('#qa-open'),...$('#'+panelOpen+'-panel').querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
   if(e.shiftKey&&index<=0){e.preventDefault();buttons.at(-1).focus();}
   else if(!e.shiftKey&&(index<0||index===buttons.length-1)){e.preventDefault();buttons[0].focus();}
  }else if(!['Enter','Space'].includes(k))e.preventDefault();
  return;
 }
if(['Space','Enter'].includes(k)&&e.target.closest?.('button,a'))return;
if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyJ','KeyK','KeyL','Escape'].includes(k))e.preventDefault();if(e.repeat)return;keys.add(k);if(k==='Escape'){if(g.mode==='playing')pause();else if(g.mode==='paused'){g.resume();hideDialog();}return;}if(g.mode!=='playing')return;if(['Space','Enter'].includes(k)&&e.target.closest?.('button,a'))return;
if(['Space','ArrowUp','KeyW'].includes(k)){if(keys.has('ArrowDown')||keys.has('KeyS'))g.dash();else g.jump();}if(k==='KeyJ'){if(keys.has('ArrowDown')||keys.has('KeyS'))g.parry();else g.attack();touch.bTime=performance.now();}if(k==='KeyK')g.dash();if(k==='KeyL')g.parry();});
document.addEventListener('keyup',e=>{keys.delete(e.code);});
document.addEventListener('click',e=>{if(e.detail>0&&e.target.closest?.('#hud button'))e.target.closest('button').blur();});
const joy=$('#joystick');
function joyMove(e){if(e.pointerId!==touch.id)return;const r=joy.getBoundingClientRect(),radius=r.width*.38;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius;const len=Math.hypot(x,y);if(len>1){x/=len;y/=len;}touch.x=Math.abs(x)>.18?x:0;touch.y=y;$('#stick').style.transform=`translate(${x*radius*.75}px,${y*radius*.75}px)`;}
joy.addEventListener('pointerdown',e=>{e.preventDefault();if(touch.id!==null)return;touch.id=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);sound.init();});joy.addEventListener('pointermove',joyMove);function joyEnd(e){if(e.pointerId===touch.id){touch.id=null;touch.x=touch.y=0;$('#stick').style.transform='';}}joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);joy.addEventListener('lostpointercapture',joyEnd);
for(const [id,action]of [['jump',()=>isDownGesture(touch.x,touch.y)?g.dash():g.jump()],['attack',()=>isDownGesture(touch.x,touch.y)?g.parry():g.attack()]]){const b=$('#'+id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('pressed');sound.init();if(id==='attack'){touch.b=true;touch.bTime=performance.now();}action();});const release=()=>{b.classList.remove('pressed');if(id==='attack')touch.b=false;};b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);b.addEventListener('contextmenu',e=>e.preventDefault());}
function handleEvents(){while(g.events.length){const e=g.events.shift();if(e.type==='sound')sound.fx(e.name);if(e.type==='notice'){$('#notice').textContent=e.text;noticeTimer=e.duration||3;}if(e.type==='level'){screenMode();$('#level-count').textContent=`0${g.level+1} / 03`;$('#level-name').textContent=g.config.name;$('#weapon').textContent=g.config.weapon;}
 if(e.type==='dead')showDialog('NO ES EL FINAL','La corrupción ganó esta ronda.','Vuelve al último punto de control con la salud y la energía restauradas.',[['REINTENTAR',()=>{g.retry();hideDialog();}],['SALIR',menu,true]]);
 if(e.type==='transition'){const n=e.next;showDialog('ZONA LIBERADA',n===1?'El barrio respira.':'El palacio se tambalea.',n===1?'Has recuperado un machete. La siguiente puerta lleva al corazón de la burocracia.':'Encontraste el emisor de plasma. Ahora entra al archivo y enfrenta a La Ignorancia.',[[n===1?'TOMAR MACHETE':'TOMAR PLASMA',()=>{g.load(n);showLevelIntro(n);}]]);}
 if(e.type==='boss')screenMode();if(e.type==='doubleJumpUnlocked'){unlockTimer=5;noticeTimer=0;$('#notice').textContent='';$('#unlock-banner').hidden=false;screenMode();}if(e.type==='bossTell'){const words=['¡BULOS! · PARRY','¡ONDA! · SALTA','¡EMBESTIDA! · DASH'][e.move];g.label(g.boss.x+20,g.boss.y-15,words,'#f4d195');}
 if(e.type==='won'){screenMode();const mins=Math.floor(g.elapsed/60),secs=String(Math.floor(g.elapsed%60)).padStart(2,'0');showDialog('DEMO COMPLETADO','La Ignorancia ha caído.',`<p>La ciudad recuperó el pulso.<br>La siguiente batalla apenas comienza.</p><div class="control-grid"><div><b>${g.kills}</b><span>Corruptos vencidos</span></div><div><b>${g.parries}</b><span>Parries perfectos</span></div><div><b>${mins}:${secs}</b><span>Tiempo de misión</span></div></div>`,[['VOLVER A JUGAR',begin],['MENÚ',menu,true]]);}
 }}
function ui(dt){uiTimer-=dt;if(uiTimer>0)return;uiTimer=.08;const p=g.p;$('#hearts').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i<p.hp?'':'empty'}"></i>`).join('');$('#hearts').setAttribute('aria-label',`Salud: ${p.hp} de 6`);$('#energy').style.width=p.energy+'%';$('#progress').style.width=Math.min(100,p.x/g.config.width*100)+'%';if(g.boss)$('#boss-health').style.width=(Math.max(0,g.boss.hp)/g.boss.maxHp*100)+'%';const unlocked=g.doubleJumpUnlocked;$('#jump-status').textContent=unlocked?'↑↑ DOBLE SALTO · A + A':'↑ SALTO SIMPLE';$('#jump-status').classList.toggle('unlocked',unlocked);$('#jump').classList.toggle('unlocked',unlocked);$('#jump span').textContent=unlocked?'DOBLE SALTO':'SALTO';$('#jump').setAttribute('aria-label',unlocked?'A: Saltar y doble salto desbloqueado. Con joystick hacia abajo, dash.':'A: Salto simple. Doble salto bloqueado hasta La Ignorancia. Con joystick hacia abajo, dash.');$('#unlock-banner').hidden=!(!panelOpen&&g.mode==='playing'&&unlockTimer>0);}
function playerFrame(p){if(g.mode==='dead')return 23;if(p.hurt>0)return 22;if(p.parry>0)return 21;if(p.guard)return 20;if(p.dash>0)return Math.floor(g.time*20)%2+10;if(p.attack>0){if(g.level===2)return plasmaFrame(p);if(g.level===1)return 24+macheteFrame(p);return 12+p.combo;}if(!p.ground){if(p.jumps===2&&p.vy<-20)return 9;if(p.vy<-70)return 7;if(p.vy>70)return 8;return 6;}if(Math.abs(p.vx)>10)return 2+Math.floor(g.time*10)%4;return 0;}
function drawShot(s){const color=s.friendly?'#80eee8':'#cf9cf4',x=s.x+s.w/2,y=s.y+s.h/2,r=Math.min(s.w,s.h)/2;ctx.save();const disc=(cx,cy,radius,fill,alpha=1)=>{ctx.globalAlpha=alpha;ctx.fillStyle=fill;ctx.beginPath();ctx.arc(cx,cy,radius,0,Math.PI*2);ctx.fill();};
 if(s.wave){ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=.8;ctx.beginPath();ctx.arc(x,y,r+2,Math.PI,Math.PI*2);ctx.stroke();}
 else{const tail=Math.min((s.age||0)*Math.abs(s.vx),8),dir=Math.sign(s.vx);disc(x-dir*tail,y,r*.65,color,.2);disc(x,y,r+3,color,.18);disc(x,y,r,color);disc(x-.7,y-.7,r*.55,'#f3ffe1');}
 if(s.orb&&!s.friendly)text('?',x,y-r-3,'#dfc1fa',7,'center');ctx.restore();}
function drawPlayer(x,y,dir,frame,opacity=1){const fw=assets.player.naturalWidth/6,fh=assets.player.naturalHeight/4;ctx.save();ctx.globalAlpha=opacity;ctx.translate(Math.round(x+9),Math.round(y+48+1));ctx.scale(dir,1);ctx.drawImage(assets.player,(frame%6)*fw,Math.floor(frame/6)*fh,fw,fh,-30,-60,60,60);ctx.restore();}
function drawEnemy(e){if(e.hp<=0&&e.dead<.2)return;let frame;if(e.boss)frame=e.hit>0?11:e.state==='windup'?9:e.state==='attack'?10:8;else frame=e.type*4+(e.state==='windup'?2:e.state==='attack'?3:(Math.abs(e.vx)>1?Math.floor(g.time*5)%2:0));const [sx,sy,sw,sh]=atlas.enemies.frames[frame].source;const scale=e.boss?.285:.188;let x=e.x+e.w/2,y=e.y+e.h;ctx.save();if(e.hp<=0)ctx.globalAlpha=Math.max(0,e.dead/.7);if(e.hit>0&&Math.floor(g.time*70)%2)ctx.globalAlpha=.55;ctx.translate(Math.round(x),Math.round(y));ctx.scale(-e.dir,1);ctx.drawImage(assets.enemies,sx,sy,sw,sh,Math.round(-sw*scale/2),Math.round(-sh*scale),Math.round(sw*scale),Math.round(sh*scale));ctx.restore();if(e.hp>0){if(e.state==='windup'){ctx.fillStyle='#ffd483';ctx.fillRect(Math.round(x-3),e.y-14,6,8);ctx.fillRect(Math.round(x-2),e.y-4,4,2);}if(e.stun>.2){ctx.fillStyle='#d5ff94';for(let i=0;i<3;i++)ctx.fillRect(x-9+i*8,e.y-8+Math.sin(g.time*8+i)*2,3,2);}if(e.hp<e.maxHp&&!e.boss){ctx.fillStyle='#131c21';ctx.fillRect(x-13,e.y-6,26,2);ctx.fillStyle='#c5d890';ctx.fillRect(x-13,e.y-6,26*(e.hp/e.maxHp),2);}if(e.boss&&e.shield){ctx.strokeStyle='#b593e5';ctx.lineWidth=2;ctx.strokeRect(e.x-4,e.y-4,e.w+8,e.h+8);}}}
function text(t,x,y,color='#d6d5c2',size=6,align='left'){ctx.font=`bold ${size}px monospace`;ctx.textAlign=align;ctx.fillStyle='#09101dc0';ctx.fillText(t,Math.round(x)+1,Math.round(y)+1);ctx.fillStyle=color;ctx.fillText(t,Math.round(x),Math.round(y));}
function terrain(){const conf=g.config;for(const s of g.solids){if(s.x+s.w<g.camera-20||s.x>g.camera+500)continue;ctx.fillStyle=g.level===0?'#514144':g.level===1?'#25454b':'#302942';ctx.fillRect(s.x,s.y,s.w,s.h);ctx.fillStyle=g.level===0?'#be9173':g.level===1?'#789e91':'#81758f';ctx.fillRect(s.x,s.y,s.w,3);ctx.fillStyle='#151d2c';ctx.fillRect(s.x,s.y+3,s.w,2);ctx.fillStyle=g.level===0?'#765758':g.level===1?'#355d5f':'#494057';for(let y=s.y+7;y<s.y+s.h;y+=11)for(let x=Math.max(s.x,Math.floor((g.camera-40)/28)*28)+(y%2?14:0);x<s.x+s.w&&x<g.camera+500;x+=28){const width=Math.min(25,s.x+s.w-x);if(width>0)ctx.fillRect(x,y,width,1);}if(!s.ground){ctx.fillStyle='#0f172080';ctx.fillRect(s.x+4,s.y+s.h,s.w-8,4);}}
 for(const[a,b]of conf.pits){ctx.fillStyle='#081320';ctx.fillRect(a,236,b-a,40);for(let x=a+8;x<b;x+=14){ctx.fillStyle=conf.accent;ctx.globalAlpha=.25+Math.sin(visualTime*2+x)*.12;ctx.fillRect(x,250,3,10);}ctx.globalAlpha=1;}
 const cx=conf.checkpoint;if(Math.abs(cx-g.camera)<520){ctx.fillStyle=g.checkpointActive?'#cafa6b':'#8cc7c0';ctx.globalAlpha=.18;ctx.fillRect(cx-8,160,16,64);ctx.globalAlpha=1;ctx.fillRect(cx-1,172,2,52);ctx.fillRect(cx-8,165,16,7);text(g.checkpointActive?'GUARDADO':'CONTROL',cx,157,'#cafa6b',5,'center');}
 if(g.level<2){const gx=conf.gate;const open=!g.enemies.some(e=>e.guard&&e.hp>0);ctx.fillStyle='#0a1422';ctx.fillRect(gx,138,49,86);ctx.fillStyle=open?'#b9eaa0':'#b19071';ctx.fillRect(gx,136,49,3);ctx.fillRect(gx,136,3,88);ctx.fillRect(gx+46,136,3,88);ctx.fillStyle=open?'#b9eaa035':'#ad7c7744';ctx.fillRect(gx+4,141,41,83);text(open?'ENTRAR →':'ACCESO',gx+24,128,open?'#cafa6b':'#e9c7a7',6,'center');}
}
function render(){ctx.save();ctx.fillStyle='#131624';ctx.fillRect(0,0,W,H);const menuMode=g.mode==='menu';const camera=menuMode?0:Math.round(g.camera);const bg=assets[g.config.theme];const bw=640,bh=366,ox=-(camera*.23)%bw;ctx.drawImage(bg,Math.floor(ox),-92,bw,bh);ctx.drawImage(bg,Math.floor(ox+bw),-92,bw,bh);ctx.fillStyle=g.level===2?'#100c2224':'#0a1b2920';ctx.fillRect(0,0,W,H);const shakeX=g.shake>0?Math.round((Math.random()-.5)*g.shake):0,shakeY=g.shake>0?Math.round((Math.random()-.5)*g.shake):0;renderPlayer(camera,shakeX,shakeY);if(menuMode){ctx.restore();return;}ctx.translate(shakeX-camera,shakeY);terrain();
 for(const q of g.pickups)if(!q.taken){const y=q.y+Math.sin(visualTime*3+q.x)*2;ctx.globalAlpha=.2;ctx.fillStyle='#d5ff94';ctx.fillRect(q.x-3,y-3,18,18);ctx.globalAlpha=1;ctx.fillStyle='#d5ff94';ctx.fillRect(q.x+4,y,4,12);ctx.fillRect(q.x,y+4,12,4);}
 for(const t of g.trails)drawPlayer(t.x,t.y,t.dir,10,t.life*2);for(const e of g.enemies)if(e.x+100>camera&&e.x-100<camera+W)drawEnemy(e);if(g.boss)drawEnemy(g.boss);
 if(g.p.parry>0||g.p.guard){ctx.strokeStyle=g.p.parry>0?'#d6ff9f':'#86d9eb';ctx.lineWidth=g.p.parry>0?2:1;ctx.beginPath();ctx.arc(g.p.x+9+g.p.dir*8,g.p.y+24,24,-1.15+(g.p.dir<0?Math.PI:0),1.15+(g.p.dir<0?Math.PI:0));ctx.stroke();}
 for(const s of g.shots)drawShot(s);
 for(const q of g.particles){ctx.globalAlpha=Math.min(1,q.life/.2);ctx.fillStyle=q.color;ctx.fillRect(Math.round(q.x),Math.round(q.y),q.size,q.size);}ctx.globalAlpha=1;for(const q of g.labels){ctx.globalAlpha=Math.min(1,q.life*3);text(q.text,q.x,q.y,q.color,6,'center');}ctx.globalAlpha=1;ctx.restore();}
function loop(stamp){const elapsed=Math.max(0,(stamp-(last||stamp))/1000),dt=Math.min(elapsed,.034);last=stamp;visualTime+=dt;
 if(!panelOpen&&!portraitPhone.matches&&g.mode==='playing'){input.axis=touch.x||(Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA')));input.guard=(touch.b||keys.has('KeyJ'))&&performance.now()-touch.bTime>260;g.update(dt,input);sound.music(dt);unlockTimer=Math.max(0,unlockTimer-dt);if(noticeTimer>0){noticeTimer-=dt;if(noticeTimer<=0)$('#notice').textContent='';}}
 handleEvents();render();ui(dt);requestAnimationFrame(loop);
}
function registerTools(){const mc=document.modelContext;if(!mc?.registerTool)return;const life=new AbortController();const strictEmpty=input=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Se requiere un objeto vacío.');};try{Promise.resolve(mc.registerTool({name:'read_game_state',title:'Ver estado de la partida',description:'Consulta el nivel, salud, energía, enemigos y estado de la partida actual.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){strictEmpty(input);return g.snapshot();}},{signal:life.signal})).catch(()=>{});Promise.resolve(mc.registerTool({name:'pause_game',title:'Pausar la partida',description:'Pausa la partida actual y muestra el menú de pausa. No reinicia el progreso.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){strictEmpty(input);if(g.mode!=='playing')throw Error('La partida no está en curso.');pause();return g.snapshot();}},{signal:life.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>life.abort(),{once:true});}
})();
