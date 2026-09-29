(function(root){
'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
const PHYSICS=Object.freeze({moveSpeed:120,jumpSpeed:340,airJumpSpeed:320,gravity:790,coyoteTime:.14,jumpBuffer:.16});
const PLASMA=Object.freeze({radius:4,speed:310,recoilTime:.09});
// Atlas cells are 256 px, rendered at 60 px with feet at (player.x+9, player.y+49).
// Frame 19 includes recoil and a muzzle flash; its barrel ends at cell pixel (205,77).
const plasmaFrame=p=>p.attack>0&&p.attackTotal-p.attack<PLASMA.recoilTime?19:18;
const plasmaMuzzle=p=>({x:Math.round(p.x+9)+p.dir*(205*60/256-30),y:Math.round(p.y+49)-60+77*60/256});
const isDownGesture=(x,y)=>y>.7&&Math.abs(x)<.45;
// Three distinct cuts; impact poses and collision timing share the same clock.
const MACHETE=Object.freeze([
 Object.freeze({duration:.36,hitAt:.105,recoverAt:.245}),
 Object.freeze({duration:.34,hitAt:.095,recoverAt:.225}),
 Object.freeze({duration:.44,hitAt:.14,recoverAt:.30})
]);
const macheteFrame=p=>{const combo=clamp(p.combo,0,2),move=MACHETE[combo],elapsed=p.attackTotal-p.attack;return combo*3+(elapsed<move.hitAt?0:elapsed<move.recoverAt?1:2);};
const LEVELS=[
 {name:'LA CALLE NO CALLA',place:'Barrio del Centro',weapon:'PUÑOS',width:2200,theme:'street',accent:'#e6ae72',pits:[[690,762],[1290,1362]],platforms:[[310,180,110],[470,144,110],[800,176,110],[1050,178,110],[1400,180,110],[1550,144,110]],enemies:[[430,0],[575,0],[900,0],[1140,0],[1480,0],[1680,0],[1930,0],[2040,0]],pickups:[[515,123],[1100,157],[1590,123]],checkpoint:1120,gate:2120,intro:'Recupera la calle. Encadena tres golpes y abre el acceso al palacio.'},
 {name:'EL PALACIO DE LAS MORDIDAS',place:'Patio de Gobierno',weapon:'MACHETE',width:2400,theme:'palace',accent:'#67d5c1',pits:[[740,820],[1430,1510]],platforms:[[280,180,110],[450,144,115],[890,178,110],[1050,180,95],[1170,144,115],[1560,180,110],[1740,144,115]],enemies:[[385,0],[590,1],[930,0],[1100,1],[1350,0],[1630,1],[1880,0],[2110,1],[2210,0]],pickups:[[490,123],[1215,123],[1790,123]],checkpoint:1190,gate:2320,intro:'Machete desbloqueado. Los escudos caen con un parry o un ataque por la espalda.'},
 {name:'EL ARCHIVO DEL OLVIDO',place:'Archivo Nacional',weapon:'PLASMA',width:2820,theme:'archive',accent:'#c599ef',pits:[[650,725],[1190,1270]],platforms:[[300,180,110],[455,146,110],[800,178,110],[945,180,90],[1050,144,115],[1340,180,110],[1515,146,115],[1880,176,110]],enemies:[[410,0],[550,1],[885,1],[1080,0],[1440,1],[1680,0],[1940,1]],pickups:[[495,125],[1090,123],[1595,125]],checkpoint:1770,gate:2740,intro:'Plasma desbloqueado. Al fondo del archivo te espera La Ignorancia.'}
];
class Game{
 constructor(){this.mode='menu';this.level=0;this.time=0;this.elapsed=0;this.kills=0;this.parries=0;this.deaths=0;this.events=[];this.camera=0;this.particles=[];this.labels=[];this.shots=[];this.trails=[];this.shake=0;this.freeze=0;this.noticeTime=0;this.ready=false;this.load(0);this.mode='menu';}
 emit(type,data={}){this.events.push({type,...data});}
 load(n){if(!Number.isInteger(n)||!LEVELS[n])throw new RangeError('Nivel no válido');this.level=n;this.config=LEVELS[n];this.time=0;this.camera=0;this.shots=[];this.particles=[];this.labels=[];this.trails=[];this.boss=null;this.bossActive=false;this.bossWon=false;this.bossWonTime=0;this.doubleJumpUnlocked=false;this.jumpHintAt=0;this.checkpointActive=false;this.checkpointX=130;this.exitWarn=0;this.freeze=0;this.shake=0;
  this.p={x:130,y:165,w:18,h:48,vx:0,vy:0,dir:1,hp:6,maxHp:6,energy:100,ground:false,jumps:0,coyote:0,jumpBuffer:0,inv:1,attack:0,attackTotal:.3,attackDelay:0,combo:0,comboWindow:0,hit:false,queued:false,dash:0,dashCd:0,parry:0,parryCd:0,guard:false,hurt:0};
  this.solids=[];let last=0;for(const [a,b]of this.config.pits){this.solids.push({x:last,y:224,w:a-last,h:70,ground:true});last=b;}this.solids.push({x:last,y:224,w:this.config.width-last,h:70,ground:true});for(const [x,y,w]of this.config.platforms)this.solids.push({x,y,w,h:8,ground:false});
  this.enemies=this.config.enemies.map(([x,type],i)=>({id:i,x,y:224-46,w:type?22:19,h:46,vx:0,vy:0,dir:-1,type,hp:type?6:5,maxHp:type?6:5,state:'walk',timer:.3+i*.07,stun:0,hit:0,dead:0,attackDone:false,guard:i>=this.config.enemies.length-2,home:x}));
  this.pickups=this.config.pickups.map(([x,y])=>({x,y,w:12,h:12,taken:false}));this.mode='playing';this.emit('level',{level:n});this.emit('notice',{text:this.config.intro,duration:5});
 }
 start(){this.elapsed=0;this.kills=0;this.parries=0;this.deaths=0;this.events=[];this.load(0);}
 startQA(destination){if(![0,1,2,'boss'].includes(destination))throw new RangeError('Destino QA no válido');this.elapsed=0;this.kills=0;this.parries=0;this.deaths=0;this.events=[];this.load(destination==='boss'?2:destination);if(destination==='boss'){this.enemies=[];this.p.x=2340;this.p.y=176;this.p.ground=true;this.camera=2175;this.enterBoss();}}
 enterBoss(){if(this.level!==2||this.bossActive)return false;this.bossActive=true;this.doubleJumpUnlocked=true;this.p.jumpBuffer=0;this.checkpointX=2180;this.p.hp=Math.max(this.p.hp,5);this.boss={boss:true,x:2580,y:224-82,w:45,h:82,hp:90,maxHp:90,dir:-1,state:'idle',timer:2.5,stun:0,hit:0,dead:0,vx:0,vy:0,cycle:0,shield:false};this.shots=[];this.emit('boss');this.emit('doubleJumpUnlocked');this.emit('sound',{name:'double'});return true;}
 pause(){if(this.mode==='playing')this.mode='paused';}
 resume(){if(this.mode==='paused')this.mode='playing';}
 retry(){this.deaths++;this.p.hp=6;this.p.energy=100;this.p.x=this.checkpointX;this.p.y=150;this.p.vx=this.p.vy=0;this.p.ground=false;this.p.coyote=0;this.p.jumpBuffer=0;this.p.inv=2;this.p.hurt=0;this.p.attack=0;this.p.queued=false;this.p.dash=0;this.p.parry=0;this.p.parryCd=0;this.p.jumps=0;this.p.combo=0;this.p.comboWindow=0;this.p.dashCd=0;this.shots=[];this.mode='playing';if(this.bossActive){this.bossActive=false;this.boss=null;this.p.x=2200;this.enterBoss();}this.camera=clamp(this.p.x-165,0,this.config.width-480);for(const e of this.enemies){if(e.hp>0){e.state='walk';e.timer=.7;e.stun=0;e.x=e.home;e.y=224-e.h;}}if(!this.bossActive)this.emit('notice',{text:'Nueva oportunidad. La corrupción no descansa.',duration:3});}
 jump(){const p=this.p;if(this.mode!=='playing')return false;p.jumpBuffer=PHYSICS.jumpBuffer;const jumped=this.performJump();if(!jumped&&!this.doubleJumpUnlocked&&!p.ground&&p.jumps>0&&this.time>=this.jumpHintAt){this.jumpHintAt=this.time+3;this.emit('notice',{text:'El doble salto se desbloquea ante La Ignorancia.',duration:2});}return jumped;}
 performJump(){const p=this.p;if(p.dash>0)return false;const grounded=p.ground||p.coyote>0;if(grounded||(this.doubleJumpUnlocked&&p.jumps<2)){const double=!grounded;p.vy=-(double?PHYSICS.airJumpSpeed:PHYSICS.jumpSpeed);p.jumps=double?2:1;p.ground=false;p.coyote=0;p.jumpBuffer=0;this.burst(p.x+9,p.y+p.h,double?'#84f1f7':'#dbceb2',double?14:6);this.emit('sound',{name:double?'double':'jump'});return true;}return false;}
 dash(){const p=this.p;if(this.mode!=='playing'||p.dashCd>0||p.energy<24)return false;p.energy-=24;p.dash=.19;p.dashCd=.7;p.inv=Math.max(p.inv,.23);p.vy=0;p.attack=0;p.parry=0;p.guard=false;p.queued=false;this.emit('sound',{name:'dash'});return true;}
 parry(){const p=this.p;if(this.mode!=='playing'||p.parryCd>0||p.energy<14||p.dash>0)return false;p.energy-=14;p.parry=.25;p.parryCd=.65;p.attack=0;p.guard=true;this.emit('sound',{name:'parryStart'});return true;}
 attack(){const p=this.p;if(this.mode!=='playing'||p.dash>0||p.parry>0||p.hurt>0)return false;if(p.attack>0){p.queued=true;return false;}if(p.attackDelay>0)return false;p.guard=false;p.combo=p.comboWindow>0?(p.combo+1)%3:0;p.comboWindow=.75;p.attackTotal=this.level===2?.28:this.level===1?MACHETE[p.combo].duration:(p.combo===2?.38:.28);p.attack=p.attackTotal;p.hit=false;p.queued=false;
  if(this.level===2){if(p.energy<12){p.attack=0;this.emit('notice',{text:'Recarga de plasma…',duration:1});return false;}p.energy-=12;const muzzle=plasmaMuzzle(p),r=PLASMA.radius;this.shots.push({x:muzzle.x-r,y:muzzle.y-r,vx:p.dir*PLASMA.speed,vy:0,w:r*2,h:r*2,age:0,life:1.45,friendly:true,dmg:3});this.emit('sound',{name:'plasma'});}else this.emit('sound',{name:this.level===1?'sword':'swing'});return true;}
 burst(x,y,color,n=8){for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2;const speed=35+Math.random()*95;this.particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed-25,life:.25+Math.random()*.3,max:.6,color,size:1+Math.floor(Math.random()*3)});}}
 label(x,y,text,color='#f6dfa7'){this.labels.push({x,y,text,color,life:.8});}
 perfect(source){const p=this.p;p.parry=0;p.inv=.65;p.energy=Math.min(100,p.energy+26);this.parries++;this.freeze=.075;this.shake=3;this.burst(p.x+9+p.dir*16,p.y+20,'#d5ff94',22);this.label(p.x+9,p.y-10,'¡PARRY!','#d5ff94');this.emit('sound',{name:'parry'});if(source&&'state'in source){source.stun=1.8;source.state='walk';source.hp-=source.boss?4:2;this.checkDeath(source);} }
 hurt(amount,sourceX,source){const p=this.p;if(p.inv>0||p.dash>0||this.mode!=='playing')return false;const facing=Math.sign(sourceX-(p.x+9))===p.dir;if(p.parry>0&&facing){this.perfect(source);return 'parry';}if(p.guard&&facing&&p.energy>=12){p.energy-=12;p.inv=.25;this.burst(p.x+9+p.dir*15,p.y+24,'#8ddceb',7);this.emit('sound',{name:'block'});return false;}p.hp-=amount;p.inv=1.15;p.hurt=.3;p.vy=-125;p.vx=Math.sign(p.x-sourceX)*95;p.attack=0;p.queued=false;this.shake=4;this.freeze=.05;this.burst(p.x+9,p.y+24,'#f9958b',12);this.emit('sound',{name:'hurt'});if(p.hp<=0){p.hp=0;this.mode='dead';this.emit('dead');}return true;}
 hitEnemy(e,dmg,dir,reflected=false){if(e.hp<=0)return;if(e.type===1&&e.stun<=0&&dir===-e.dir&&!reflected){this.burst(e.x+e.w/2,e.y+24,'#bdcfdf',5);this.label(e.x,e.y-5,'ESCUDO','#bdcfdf');e.hp-=.35;this.checkDeath(e);return;}if(e.boss&&e.shield&&!reflected)dmg*=.35;e.hp-=dmg;e.hit=.15;e.vx=dir*(e.boss?20:100);e.stun=Math.max(e.stun,e.boss?.1:.36);this.burst(e.x+e.w/2,e.y+e.h*.45,e.boss?'#d7a9f3':'#aadea5',10);this.freeze=.04;this.shake=2;this.emit('sound',{name:'hit'});this.checkDeath(e);}
 checkDeath(e){if(e.hp>0)return;if(e.dead)return;e.dead=.7;e.hp=0;this.kills++;this.burst(e.x+e.w/2,e.y+e.h*.5,e.boss?'#ecd18c':'#aac695',22);this.label(e.x,e.y-5,e.boss?'LA VERDAD PREVALECE':'+100');if(e.boss){this.bossWon=true;this.shots=this.shots.filter(s=>s.friendly);this.emit('sound',{name:'victory'});}else if(this.kills%4===0){this.pickups.push({x:e.x,y:e.y+25,w:12,h:12,taken:false});}}
 moveBody(b,dt){const oldBottom=b.y+b.h;b.x=clamp(b.x+b.vx*dt,0,this.config.width-b.w);b.y+=b.vy*dt;b.ground=false;let landing=null;const margin=b===this.p?2:0;
  // One-way platforms: pass through on ascent, land on the first top crossed.
  if(b.vy>=0)for(const s of this.solids){if(oldBottom<=s.y+1&&b.y+b.h>=s.y&&b.x+b.w>s.x-margin&&b.x<s.x+s.w+margin&&(!landing||s.y<landing.y))landing=s;}
  if(landing){b.y=landing.y-b.h;b.vy=0;b.ground=true;}
 }
 update(dt,input={}){dt=Math.min(dt,.034);if(this.mode!=='playing')return;if(this.freeze>0){this.freeze-=dt;return;}this.time+=dt;this.elapsed+=dt;const p=this.p;for(const key of ['inv','hurt','dashCd','parryCd','parry','attackDelay','comboWindow','jumpBuffer'])p[key]=Math.max(0,p[key]-dt);this.shake=Math.max(0,this.shake-dt*12);p.energy=Math.min(100,p.energy+dt*(p.guard?6:23));p.guard=!!input.guard&&p.attack<=0&&p.dash<=0;
  if(p.parry>0)p.guard=true;
  if(p.dash>0){p.dash-=dt;p.vx=p.dir*335;p.vy=0;if(Math.floor(this.time*60)%2===0)this.trails.push({x:p.x,y:p.y,dir:p.dir,life:.15});}
  else{const axis=input.axis||0;if(p.hurt<=0){const target=axis*(p.attack>0&&p.ground?55:PHYSICS.moveSpeed);p.vx+=(target-p.vx)*Math.min(1,dt*18);if(Math.abs(axis)>.12&&p.attack<=0&&p.parry<=0)p.dir=axis>0?1:-1;}p.vy+=PHYSICS.gravity*dt;}
  this.moveBody(p,dt);if(p.ground){p.jumps=0;p.coyote=PHYSICS.coyoteTime;}else p.coyote=Math.max(0,p.coyote-dt);
  if(p.jumpBuffer>0&&p.dash<=0)this.performJump();
  if(p.y>320){p.hp--;this.emit('sound',{name:'hurt'});if(p.hp<=0){p.hp=0;this.mode='dead';this.emit('dead');}else{p.x=this.checkpointX;p.y=150;p.vy=0;p.vx=0;p.jumps=0;p.coyote=0;p.jumpBuffer=0;p.inv=1.5;this.camera=clamp(p.x-165,0,this.config.width-480);this.emit('notice',{text:'Cuidado con el vacío. Salta en carrera o usa dash.',duration:3});}}
  if(p.attack>0){p.attack-=dt;const elapsed=p.attackTotal-p.attack;if(!p.hit&&elapsed>=(this.level===1?MACHETE[p.combo].hitAt:.075)){p.hit=true;if(this.level<2){const reach=this.level===1?53:(p.combo===2?40:31);const box={x:p.dir===1?p.x+p.w-3:p.x-reach+3,y:p.y+7,w:reach,h:41};for(const e of [...this.enemies,...(this.boss?[this.boss]:[])])if(e.hp>0&&overlap(box,e)){this.hitEnemy(e,(this.level===1?3:2)+(p.combo===2?1:0),p.dir);if(p.combo===2)this.label(p.x+9,p.y-17,'COMBO ×3','#cafa6b');}}}if(p.attack<=0&&p.queued){p.queued=false;this.attack();}}
  for(const e of this.enemies)this.updateEnemy(e,dt);
  if(this.level===2&&!this.bossActive&&p.x>2190)this.enterBoss();
  if(this.bossActive){p.x=clamp(p.x,2190,this.config.width-p.w-10);if(this.boss)this.updateBoss(dt);}
  this.updateShots(dt);
  for(const q of this.pickups){if(!q.taken&&overlap(p,q)){q.taken=true;p.hp=Math.min(6,p.hp+1);p.energy=Math.min(100,p.energy+25);this.label(p.x,p.y-10,'+ SALUD','#cafa6b');this.emit('sound',{name:'pickup'});}}
  if(!this.checkpointActive&&p.x>this.config.checkpoint&&p.x<this.config.checkpoint+150){this.checkpointActive=true;this.checkpointX=this.config.checkpoint;p.hp=Math.min(6,p.hp+2);this.emit('checkpoint');this.emit('notice',{text:'PUNTO DE CONTROL · Salud recuperada',duration:3});this.emit('sound',{name:'pickup'});}
  if(this.level<2&&p.x>this.config.gate){const guards=this.enemies.filter(e=>e.guard&&e.hp>0);if(!guards.length){this.mode='transition';this.emit('transition',{next:this.level+1});}else{p.x=this.config.gate;this.exitWarn-=dt;if(this.exitWarn<=0){this.emit('notice',{text:'Derrota a los guardianes del acceso.',duration:2});this.exitWarn=3;}}}
  if(this.bossWon){this.bossWonTime=(this.bossWonTime||0)+dt;if(this.bossWonTime>1.6){this.mode='won';this.emit('won');}}
  for(const q of this.particles){q.x+=q.vx*dt;q.y+=q.vy*dt;q.vy+=180*dt;q.life-=dt;}this.particles=this.particles.filter(q=>q.life>0);for(const q of this.labels){q.y-=16*dt;q.life-=dt;}this.labels=this.labels.filter(q=>q.life>0);for(const q of this.trails)q.life-=dt;this.trails=this.trails.filter(q=>q.life>0);this.camera+=(clamp(p.x-165,0,this.config.width-480)-this.camera)*Math.min(1,dt*5);
 }
 updateEnemy(e,dt){if(e.dead){e.dead=Math.max(.001,e.dead-dt);return;}e.hit=Math.max(0,e.hit-dt);const p=this.p;if(Math.abs(e.x-p.x)>380)return;e.vy+=790*dt;if(e.stun>0){e.stun-=dt;e.vx*=.9;this.moveBody(e,dt);return;}const dx=p.x-e.x,dy=Math.abs((p.y+p.h)-(e.y+e.h));
  if(e.state==='windup'){e.vx=0;e.timer-=dt;if(e.timer<=0){e.state='attack';e.timer=.22;e.attackDone=false;}}
  else if(e.state==='attack'){e.vx=e.dir*(e.type?64:88);if(!e.attackDone&&Math.abs(dx)<46&&dy<42){e.attackDone=true;this.hurt(1,e.x+e.w/2,e);}e.timer-=dt;if(e.timer<=0){e.state='recover';e.timer=e.type?.64:.46;}}
  else if(e.state==='recover'){e.vx=0;e.timer-=dt;if(e.timer<=0)e.state='walk';}
  else{
   const distance=Math.abs(dx),speed=e.type?37:49;
   if(dy>=40){
    // Wait below an unreachable target. Separate stop/resume distances prevent
    // repeated reversals as the target passes just above the enemy's center.
    if(distance<=12)e.waitingBelow=true;
    else if(distance>=28)e.waitingBelow=false;
    if(distance<260&&!e.waitingBelow){
     e.dir=dx>=0?1:-1;
     e.vx=e.dir*Math.min(speed,Math.max(0,distance-12)/Math.max(dt,.001));
    }else e.vx=0;
   }else{
    e.waitingBelow=false;
    if(distance<260){if(distance>2)e.dir=dx>=0?1:-1;if(distance<40){e.state='windup';e.timer=e.type?.58:.43;e.vx=0;}else e.vx=e.dir*speed;}
    else e.vx=0;
   }
   const ahead=e.x+(e.dir===1?e.w+8:-8);
   if(!this.solids.some(s=>s.ground&&ahead>s.x&&ahead<s.x+s.w))e.vx=0;
  }
  this.moveBody(e,dt);if(e.y>330){e.x=e.home;e.y=178;e.vy=0;}}
 updateBoss(dt){const b=this.boss,p=this.p;if(b.hp<=0)return;b.hit=Math.max(0,b.hit-dt);b.dir=p.x>b.x?1:-1;if(b.stun>0){b.stun-=dt;b.shield=false;return;}b.timer-=dt;const phase=b.hp<b.maxHp*.5;
  if(b.state==='idle'){b.shield=false;b.x+=Math.sign(p.x-b.x)*dt*(phase?18:12);if(b.timer<=0){b.cycle++;b.state='windup';b.timer=phase?.72:1;b.move=b.cycle%3;b.shield=b.move===0;this.emit('bossTell',{move:b.move});}}
  else if(b.state==='windup'&&b.timer<=0){b.state='attack';b.timer=.4;b.shield=false;this.shake=4;this.emit('sound',{name:'boss'});if(b.move===0){for(let i=0;i<(phase?4:3);i++)this.shots.push({x:b.x+b.w/2,y:b.y+28+i*11,vx:b.dir*(115+i*12),vy:i===0?-12:0,w:12,h:10,life:5,friendly:false,dmg:1,orb:true});}
   else if(b.move===1){this.shots.push({x:b.x+b.w/2,y:212,vx:b.dir*(phase?180:140),vy:0,w:18,h:12,life:4,friendly:false,dmg:1,wave:true});this.burst(b.x+22,221,'#d0a2ef',24);}
   else{b.dashDir=b.dir;b.timer=.45;}}
  else if(b.state==='attack'){if(b.move===2){b.x=clamp(b.x+b.dashDir*(phase?225:180)*dt,2200,2740);if(overlap(p,b))this.hurt(1,b.x+22,b);}if(b.timer<=0){b.state='idle';b.timer=phase?.85:1.15;}}
 }
 updateShots(dt){for(const s of this.shots){s.x+=s.vx*dt;s.y+=s.vy*dt;s.age=(s.age||0)+dt;s.life-=dt;if(s.friendly){for(const e of [...this.enemies,...(this.boss?[this.boss]:[])])if(e.hp>0&&overlap(s,e)){this.hitEnemy(e,s.dmg,Math.sign(s.vx),s.reflected);s.life=0;break;}}else if(overlap(s,this.p)){const result=this.hurt(s.dmg,s.x);if(result==='parry'){s.friendly=true;s.reflected=true;s.vx=this.p.dir*280;s.vy=0;s.dmg=10;s.life=2;s.age=0;s.x=this.p.x+9+this.p.dir*20;}else if(this.p.inv<=1.16)s.life=0;}}this.shots=this.shots.filter(s=>s.life>0&&s.x>0&&s.x<this.config.width);}
 snapshot(){return{mode:this.mode,level:this.level+1,weapon:this.config.weapon,doubleJumpUnlocked:this.doubleJumpUnlocked,player:{x:Math.round(this.p.x),y:Math.round(this.p.y),hp:this.p.hp,energy:Math.round(this.p.energy),jumps:this.p.jumps},enemiesRemaining:this.enemies.filter(e=>e.hp>0).length,bossHealth:this.boss?Math.max(0,Math.ceil(this.boss.hp)):null,checkpoint:this.checkpointActive,kills:this.kills,parries:this.parries,elapsed:Math.round(this.elapsed)};}
}
const api={Game,LEVELS,PHYSICS,PLASMA,MACHETE,macheteFrame,plasmaFrame,plasmaMuzzle,isDownGesture,overlap,clamp};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PulsoEngine=api;
})(typeof window!=='undefined'?window:globalThis);
