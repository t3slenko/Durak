const express=require('express'),http=require('http'),{Server}=require('socket.io'),DB=require('better-sqlite3'),bc=require('bcryptjs'),cr=require('crypto');
const app=express(),srv=http.createServer(app),io=new Server(srv),db=new DB(process.env.DB||'durak.db');
app.use(express.static(__dirname+'/public'));
app.get('/av/:id',(rq,rs)=>{const u=db.prepare('SELECT img FROM users WHERE id=?').get(+rq.params.id);if(!u||!u.img)return rs.sendStatus(404);rs.set({'Content-Type':'image/jpeg','Cache-Control':'public,max-age=86400','X-Content-Type-Options':'nosniff'});rs.end(u.img)});
db.exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT UNIQUE,hash TEXT,token TEXT,coins INTEGER DEFAULT 5000,wins INTEGER DEFAULT 0,games INTEGER DEFAULT 0)');
["gems INTEGER DEFAULT 0","avatar INTEGER DEFAULT 0","email TEXT","email_ok INTEGER DEFAULT 0","ecode TEXT","skin TEXT DEFAULT 'classic'","skins TEXT DEFAULT 'classic'","img BLOB","imgv INTEGER DEFAULT 0","bonus_at INTEGER DEFAULT 0"].forEach(c=>{try{db.exec('ALTER TABLE users ADD COLUMN '+c)}catch{}});
const aurl=u=>u.imgv?'/av/'+u.id+'?v='+u.imgv:null,NR=/^[\wА-Яа-яЁё]{3,16}$/,NICK=50,SKP={retro:300,night:550,neon:800,velvet:1100,gold:1800},PK={100:1,550:5,1200:10,3000:25},ml={},bf={};
const mail=(to,c)=>{try{if(!process.env.SMTP_URL)return console.log('[MAIL] код для '+to+': '+c);require('nodemailer').createTransport(process.env.SMTP_URL).sendMail({from:process.env.MAIL_FROM,to,subject:'Код подтверждения',text:'Ваш код: '+c})}catch(e){console.log(e.message)}};
const q=(s,...a)=>db.prepare(s).get(...a),x=(s,...a)=>db.prepare(s).run(...a);
const get=id=>q('SELECT * FROM users WHERE id=?',id),pub=u=>({name:u.name,coins:u.coins,wins:u.wins,games:u.games,gems:u.gems,av:u.avatar,email:u.email,eok:!!u.email_ok,skin:u.skin,skins:u.skins.split(','),ai:aurl(u),bn:(u.bonus_at||0)+72e5});
const rooms=new Map();let rid=1;
const L=()=>io.emit('rooms',[...rooms.values()].filter(r=>!r.priv&&!r.g).map(r=>({id:r.id,name:r.ps.map(p=>p.name).join(', '),bet:r.bet,n:r.ps.length,max:r.max,deck:r.deck,tr:r.tr,ch:r.ch})));
const nx=(R,i)=>{const n=R.ps.length;for(let k=1;k<=n;k++){const j=(i+k)%n;if(R.ps[j].hand.length)return j}return i};
const rk=g=>new Set(g.table.flatMap(e=>e.d?[e.a.r,e.d.r]:[e.a.r]));
const view=(R,i)=>{const g=R.g;return{bet:R.bet,tr:R.tr,ch:R.ch,deck:R.deck,max:R.max,code:R.code,host:R.ps[0].name,i,play:!!g,hand:R.ps[i].hand,ps:R.ps.map(p=>({n:p.name,c:p.hand.length,av:p.av,ai:p.ai})),...(g&&{t:g.t,left:g.d.length,table:g.table.map(e=>({a:e.a,d:e.d})),att:g.att,def:g.def,take:g.take})}};
const upd=R=>{if(!R.over)R.ps.forEach((p,i)=>io.to(p.sid).emit('st',view(R,i)))};
function start(R){const lo=R.deck==24?9:R.deck==36?6:2,d=[];for(let s=0;s<4;s++)for(let r=lo;r<=14;r++)d.push({r,s});
 for(let i=d.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[d[i],d[j]]=[d[j],d[i]]}
 const t=d[d.length-1];let att=0,mn=99;
 R.ps.forEach((p,i)=>{p.hand=d.splice(0,6);x('UPDATE users SET coins=coins-?,games=games+1 WHERE id=?',R.bet,p.uid);p.hand.forEach(c=>{if(c.s==t.s&&c.r<mn){mn=c.r;att=i}})});
 const df=nx(R,att);R.g={d,t,tr:t.s,table:[],att,def:df,pass:new Set(),take:false,lim:Math.min(6,R.ps[df].hand.length)}}
function fin(R,l){R.over=1;const n=R.ps.length,pot=R.bet*n;
 R.ps.forEach((p,i)=>{const gain=l==null?R.bet:i==l?0:Math.floor(pot/(n-1));x('UPDATE users SET coins=coins+?,wins=wins+? WHERE id=?',gain,l==null||i==l?0:1,p.uid)});
 io.to('r'+R.id).emit('over',{loser:l==null?null:R.ps[l].name});
 R.ps.forEach(p=>{const so=io.sockets.sockets.get(p.sid);if(so){so.room=null;so.leave('r'+R.id);so.emit('me',pub(get(p.uid)))}});
 rooms.delete(R.id);L()}
function end(R,took){const g=R.g,n=R.ps.length,D=R.ps[g.def];
 if(took)D.hand.push(...g.table.flatMap(e=>e.d?[e.a,e.d]:[e.a]));
 g.table=[];g.pass.clear();g.take=false;
 [...Array(n).keys()].map(k=>(g.att+k)%n).filter(i=>i!=g.def).concat(g.def).forEach(i=>{const h=R.ps[i].hand;while(h.length<6&&g.d.length)h.push(g.d.shift())});
 const al=R.ps.map((p,i)=>i).filter(i=>R.ps[i].hand.length);
 if(al.length<2)return fin(R,al[0]);
 g.att=took||!D.hand.length?nx(R,g.def):g.def;g.def=nx(R,g.att);g.lim=Math.min(6,R.ps[g.def].hand.length)}
function chk(R){const g=R.g;if(!g.table.length)return;
 const el=R.ps.map((p,i)=>i).filter(i=>i!=g.def&&R.ps[i].hand.length),all=el.every(i=>g.pass.has(i)),full=g.table.length>=g.lim,open=g.table.some(e=>!e.d);
 if(g.take){if(all||full)end(R,true)}else if(!open&&(all||full||!R.ps[g.def].hand.length))end(R,false)}
function join(s,R){const u=s.uid&&get(s.uid);if(!u||s.room)return;const e=R.g?'Игра уже началась':R.ps.length>=R.max?'Стол заполнен':u.coins<R.bet?'Не хватает монет для ставки':0;if(e)return s.emit('err',e);
 R.ps.push({uid:u.id,name:u.name,av:u.avatar,ai:aurl(u),sid:s.id,hand:[]});s.room=R;s.join('r'+R.id);upd(R);L()}
function leave(s){const R=s.room;if(!R)return;const i=R.ps.findIndex(p=>p.uid==s.uid);
 if(R.g)return fin(R,i);
 R.ps.splice(i,1);s.leave('r'+R.id);s.room=null;s.emit('left');if(!R.ps.length)rooms.delete(R.id);else upd(R);L()}
io.on('connection',s=>{
 s.on('auth',(a,cb)=>{let u;try{
  if(a.token)u=q('SELECT * FROM users WHERE token=?',String(a.token));
  else{const n=String(a.name||''),p=String(a.pass||'');
   if(a.reg){if(!/^[\wА-Яа-яЁё]{3,16}$/.test(n)||p.length<4)return cb({err:'Ник 3–16 букв/цифр, пароль от 4 символов'});
    x('INSERT INTO users(name,hash,token) VALUES(?,?,?)',n,bc.hashSync(p,8),cr.randomUUID());u=q('SELECT * FROM users WHERE name=?',n)}
   else{u=q('SELECT * FROM users WHERE name=?',n);if(!u||!bc.compareSync(p,u.hash))return cb({err:'Неверный ник или пароль'})}}
 }catch{return cb({err:'Этот ник уже занят'})}
 if(!u)return cb({err:'Сессия истекла, войдите заново'});
 s.uid=u.id;cb({token:u.token,me:pub(u),now:Date.now()});L();
 for(const R of rooms.values()){const p=R.ps.find(p=>p.uid==u.id);if(p){p.sid=s.id;s.room=R;s.join('r'+R.id);upd(R)}}});
 s.on('act',(a,cb)=>{const u=s.uid&&get(s.uid);if(!u||typeof cb!='function')return;a=a||{};
  const res=(e,m)=>cb(e?{err:e}:{ok:1,msg:m,me:pub(get(u.id)),token:get(u.id).token}),v=String(a.v==null?'':a.v);
  if(a.t=='av'){if(!(+v>=0&&+v<12))return;x('UPDATE users SET avatar=?,img=NULL,imgv=0 WHERE id=?',+v,u.id);res(0,'Аватар обновлён')}
  else if(a.t=='img'){if(!v){x('UPDATE users SET img=NULL,imgv=0 WHERE id=?',u.id);return res(0,'Фото удалено')}
   const m=/^data:image\/jpeg;base64,([A-Za-z0-9+\/=]+)$/.exec(v);if(!m||v.length>90000)return res('Нужно изображение JPEG до 60 КБ');
   const b=Buffer.from(m[1],'base64');if(b.length>65000||b[0]!=0xFF||b[1]!=0xD8||b[2]!=0xFF)return res('Некорректное изображение');
   x('UPDATE users SET img=?,imgv=? WHERE id=?',b,Math.floor(Date.now()/1e3),u.id);res(0,'Фото обновлено')}
  else if(a.t=='buy'){const p=SKP[v];if(!p)return res('Нет такого предмета');if(u.skins.split(',').includes(v))return res('Уже куплено');
   if(!x("UPDATE users SET gems=gems-?,skins=skins||','||? WHERE id=? AND gems>=? AND (','||skins||',') NOT LIKE ?",p,v,u.id,p,'%,'+v+',%').changes)return res('Не хватает кристаллов');res(0,'Скин куплен')}
  else if(a.t=='bonus'){const n=Date.now();if(!x('UPDATE users SET coins=coins+1000,bonus_at=? WHERE id=? AND bonus_at<=?',n,u.id,n-72e5).changes)return res('Бонус ещё не готов');res(0,'+1000 монет!')}
  else if(a.t=='equip'){if(!u.skins.split(',').includes(v))return res('Нет такого предмета');x('UPDATE users SET skin=? WHERE id=?',v,u.id);res(0,'Скин надет')}
  else if(a.t=='nick'){if(s.room)return res('Сначала выйдите из-за стола');if(!NR.test(v))return res('Ник 3–16 букв/цифр');if(v==u.name)return res('Это ваш текущий ник');
   if(q('SELECT 1 FROM users WHERE lower(name)=lower(?)',v))return res('Ник занят');
   try{if(!x('UPDATE users SET name=?,gems=gems-? WHERE id=? AND gems>=?',v,NICK,u.id,NICK).changes)return res('Не хватает кристаллов, нужно '+NICK)}catch{return res('Ник занят')}res(0,'Ник изменён')}
  else if(a.t=='pass'){if(!bc.compareSync(String(a.o||''),u.hash))return res('Неверный текущий пароль');if(v.length<4)return res('Пароль от 4 символов');
   x('UPDATE users SET hash=?,token=? WHERE id=?',bc.hashSync(v,8),cr.randomUUID(),u.id);res(0,'Пароль изменён')}
  else if(a.t=='email'){if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)||v.length>80)return res('Некорректная почта');if(Date.now()-(ml[u.id]||0)<6e4)return res('Подождите минуту перед повторной отправкой');
   ml[u.id]=Date.now();bf[u.id]=0;const c=String(cr.randomInt(1e5,1e6));x('UPDATE users SET email=?,email_ok=0,ecode=? WHERE id=?',v,c,u.id);mail(v,c);res(0,'Код отправлен на почту')}
  else if(a.t=='ecode'){if((bf[u.id]=(bf[u.id]||0)+1)>5)return res('Слишком много попыток, запросите новый код');if(!u.ecode||v!=u.ecode)return res('Неверный код');x('UPDATE users SET email_ok=1,ecode=NULL WHERE id=?',u.id);res(0,'Почта подтверждена')}
  else if(a.t=='pay'){if(!PK[+a.v])return;
   if(process.env.DEV_PAY!='1')return res('Платёжный сервис пока не подключён');/* здесь: создать счёт у провайдера (карта/крипта) и ответить cb({url}); зачислять кристаллы только по вебхуку провайдера */
   x('UPDATE users SET gems=gems+? WHERE id=?',+a.v,u.id);res(0,'Тестовое пополнение: +'+a.v)}});
 s.on('create',o=>{if(!s.uid||s.room)return;const mx=Math.min(6,Math.max(2,+o.max||2)),dk=[24,36,52].includes(+o.deck)?+o.deck:36;
  const bet=Math.max(100,Math.min(5000,(+o.bet)|0));if(get(s.uid).coins<bet)return s.emit('err','Не хватает монет для такой ставки');
  const R={id:rid++,bet,deck:dk,max:dk==24?Math.min(mx,4):mx,tr:!!o.tr,ch:!!o.ch,priv:!!o.priv,code:Math.random().toString(36).slice(2,6).toUpperCase(),ps:[],g:null};
  rooms.set(R.id,R);join(s,R)});
 s.on('join',a=>{const R=a.code?[...rooms.values()].find(r=>r.code==String(a.code).toUpperCase().trim()):rooms.get(+a.id);if(!R||R.over||(R.priv&&!a.code))return s.emit('err','Лобби недействительно');join(s,R)});
 s.on('leave',()=>leave(s));
 s.on('disconnect',()=>{const R=s.room;if(R&&!R.g)setTimeout(()=>{const p=R.ps.find(p=>p.uid==s.uid);if(p&&p.sid==s.id&&!R.g)leave(s)},30000)});
 s.on('start',()=>{const R=s.room;if(R&&!R.g&&R.ps[0].uid==s.uid&&R.ps.length>1&&R.ps.every(p=>get(p.uid).coins>=R.bet)){start(R);upd(R);L()}});
 s.on('mv',m=>{const R=s.room,g=R&&R.g;if(!g||R.over)return;const i=R.ps.findIndex(p=>p.uid==s.uid),P=R.ps[i],c=P.hand[m.c],T=g.table,open=()=>T.some(e=>!e.d);
  if(m.t=='att'){if(!c||i==g.def||T.length>=g.lim||(!T.length&&i!=g.att))return;const ok=!T.length||rk(g).has(c.r);if(!ok&&!R.ch)return;T.push({a:c,x:ok?-1:i});P.hand.splice(m.c,1);g.pass.clear()}
  else if(m.t=='def'){const e=T[m.e];if(!c||!e||e.d||i!=g.def||g.take)return;const ok=c.s==e.a.s?c.r>e.a.r:c.s==g.tr;if(!ok&&!R.ch)return;e.d=c;if(!ok)e.x=i;P.hand.splice(m.c,1)}
  else if(m.t=='tr'){if(!R.tr||!c||i!=g.def||g.take||T.some(e=>e.d))return;const nd=nx(R,i),ok=T.every(e=>e.a.r==c.r);if(!ok&&!R.ch)return;if(nd==i||R.ps[nd].hand.length<=T.length||T.length>=6)return;T.push({a:c,x:ok?-1:i});P.hand.splice(m.c,1);g.att=i;g.def=nd;g.lim=Math.min(6,R.ps[nd].hand.length);g.pass.clear()}
  else if(m.t=='take'){if(i!=g.def||!T.length||g.take)return;g.take=true;g.pass.clear()}
  else if(m.t=='pass'){if(i==g.def||!T.length||(open()&&!g.take))return;g.pass.add(i)}
  else if(m.t=='acc'){if(!R.ch||!T.length)return;const e=T.find(e=>e.x>=0);g.def=e?e.x:i;end(R,true)}
  else return;
  chk(R);upd(R)});
});
srv.listen(process.env.PORT||3000,()=>console.log('Durak: http://localhost:'+(process.env.PORT||3000)));
