/**
 * app.js v5 — 命式占 3ページSPA統合版
 * ページ：今日の運勢 / あなたはどんな人 / 相性診断
 */
'use strict';

// ══════════════════════════════════════════
// 星空アニメーション
// ══════════════════════════════════════════
const StarField = {
  init() {
    const c = document.getElementById('star-canvas');
    if (!c) return;
    const ctx = c.getContext('2d');
    const resize = () => { c.width = innerWidth; c.height = innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const stars = Array.from({length:160}, () => ({
      x:Math.random()*innerWidth, y:Math.random()*innerHeight,
      r:Math.random()*1.3+0.2, o:Math.random()*0.6+0.1,
      sp:Math.random()*0.004+0.001, ph:Math.random()*Math.PI*2,
      hue:Math.random()>0.85?'rgba(180,160,255,':'rgba(220,200,140,',
    }));
    const draw = () => {
      ctx.clearRect(0,0,c.width,c.height);
      const t = Date.now()*0.001;
      stars.forEach(s => {
        const p = Math.sin(t*s.sp*60+s.ph)*0.3+0.7;
        ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2);
        ctx.fillStyle = s.hue+(s.o*p)+')'; ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
  },
};

// ══════════════════════════════════════════
// 計算エンジン群
// ══════════════════════════════════════════
const CE = {
  SO:[
    {month:2,day:4,si:2},{month:3,day:6,si:3},{month:4,day:5,si:4},
    {month:5,day:6,si:5},{month:6,day:6,si:6},{month:7,day:7,si:7},
    {month:8,day:7,si:8},{month:9,day:8,si:9},{month:10,day:8,si:10},
    {month:11,day:7,si:11},{month:12,day:7,si:0},{month:1,day:6,si:1},
  ],
  rd(y){ return RISSHUN_DAYS[y]||4; },
  year(y,m,d){
    let yr=y;
    if(m<2||(m===2&&d<this.rd(y))) yr--;
    return { kanIdx:((yr-4)%10+10)%10, shiIdx:((yr-4)%12+12)%12 };
  },
  msi(y,m,d){
    const c=this.rd(y)-4;
    for(let i=0;i<this.SO.length;i++){
      const s=this.SO[i];
      if(s.month===m) return d>=s.day+c?s.si:this.SO[(i-1+12)%12].si;
    }
    return 2;
  },
  month(yk,y,m,d){
    const si=this.msi(y,m,d);
    const sk=[2,4,6,8,0,2,4,6,8,0][yk];
    return { kanIdx:(sk+((si-2+12)%12))%10, shiIdx:si };
  },
  day(y,m,d){
    const diff=Math.round((new Date(y,m-1,d)-new Date(1900,0,1))/86400000);
    return { kanIdx:(diff%10+10)%10, shiIdx:((diff+10)%12+12)%12 };
  },
  hour(dk,h){
    const si=[0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11][h]??0;
    return { kanIdx:([0,2,4,6,8,0,2,4,6,8][dk]+si)%10, shiIdx:si };
  },
};

const PE = {
  calc(y,m,d,h){
    const yr=CE.year(y,m,d);
    const mo=CE.month(yr.kanIdx,y,m,d);
    const dy=CE.day(y,m,d);
    const hr=CE.hour(dy.kanIdx,h);
    return {year:yr,month:mo,day:dy,hour:hr};
  },
};

const AE = {
  count(pillars){
    const c={"木":0,"火":0,"土":0,"金":0,"水":0};
    Object.values(pillars).forEach(p=>{
      c[JIKKAN[p.kanIdx].element]+=2;
      const z=ZOKAN[JUNISHI[p.shiIdx].name];
      if(z){
        if(z.honki !=null) c[JIKKAN[z.honki].element] +=3;
        if(z.chuuki!=null) c[JIKKAN[z.chuuki].element]+=2;
        if(z.yoki  !=null) c[JIKKAN[z.yoki].element]  +=1;
      }
    });
    return c;
  },
  balance(c){
    const t=Object.values(c).reduce((a,b)=>a+b,0);
    const r={};
    for(const k in c) r[k]=Math.round(c[k]/t*100);
    return r;
  },
  mrei(dk,msi){ const z=ZOKAN[JUNISHI[msi].name]; return z?.honki!=null?getTsuhensei(dk,z.honki):null; },
};

const SE = {
  ts(dk,p){ return {year:getTsuhensei(dk,p.year.kanIdx),month:getTsuhensei(dk,p.month.kanIdx),hour:getTsuhensei(dk,p.hour.kanIdx)}; },
  ju(dk,p){ const t=JUNIUN_TABLE[dk]||[]; return {year:JUNIUN[t[p.year.shiIdx]??0],month:JUNIUN[t[p.month.shiIdx]??0],day:JUNIUN[t[p.day.shiIdx]??0],hour:JUNIUN[t[p.hour.shiIdx]??0]}; },
};

const StE = {
  judge(dk,p,c){
    let sc=0;
    const mr=AE.mrei(dk,p.month.shiIdx);
    const st=["比肩","劫財","印綬","偏印"];
    sc+=(mr&&st.includes(mr))?30:-20;
    [getTsuhensei(dk,p.year.kanIdx),getTsuhensei(dk,p.month.kanIdx),getTsuhensei(dk,p.hour.kanIdx)]
      .forEach(ts=>{ sc+=st.includes(ts)?10:-5; });
    const me=JIKKAN[dk].element;
    const sup={"木":["水","木"],"火":["木","火"],"土":["火","土"],"金":["土","金"],"水":["金","水"]}[me]||[];
    const tot=Object.values(c).reduce((a,b)=>a+b,0);
    sc+=Math.round((sup.reduce((a,e)=>a+(c[e]||0),0)/tot-0.4)*50);
    const pw=Math.min(100,Math.max(0,50+sc));
    return sc>=0
      ?{label:"身強",power:pw,color:"#4fc97a",desc:"日干のエネルギーが強い「身強」です。月令を味方につけており、積極的に行動することで運が開けます。"}
      :{label:"身弱",power:pw,color:"#5ab8f5",desc:"日干のエネルギーが控えめな「身弱」です。人の助けや環境の力を借りながら進むことで大きな力になります。"};
  },
};

const DE = {
  calc(by,bm,bd,gender,p){
    const yy=JIKKAN[p.year.kanIdx].yin_yang;
    const jun=(yy==="陽"&&gender==="男")||(yy==="陰"&&gender==="女");
    const sa=this.startAge(by,bm,bd,jun);
    let k=p.month.kanIdx,s=p.month.shiIdx;
    const list=[];
    for(let i=0;i<8;i++){
      k=jun?(k+1)%10:((k-1)+10)%10;
      s=jun?(s+1)%12:((s-1)+12)%12;
      const ts=getTsuhensei(p.day.kanIdx,k);
      list.push({age:sa+i*10,endAge:sa+i*10+9,kan:JIKKAN[k],shi:JUNISHI[s],tsuhen:ts,
        juniun:JUNIUN[JUNIUN_TABLE[p.day.kanIdx]?.[s]??0],interp:DAIUNN_INTERPRETATIONS[ts]||""});
    }
    return {startAge:sa,isJunko:jun,list};
  },
  startAge(y,m,d,jun){
    const b=[6,4,6,5,6,6,7,7,8,8,7,7],c=(RISSHUN_DAYS[y]||4)-4;
    let days=0,mo=m,dy=d,yr=y;
    for(let i=0;i<60;i++){
      jun?dy++:dy--;
      days++;
      if(jun){ const dm=new Date(yr,mo,0).getDate(); if(dy>dm){dy=1;mo++;if(mo>12){mo=1;yr++;}} if(dy===b[mo-1]+c)break; }
      else    { if(dy<1){mo--;if(mo<1){mo=12;yr--;}dy=new Date(yr,mo,0).getDate();} if(dy===b[mo-1]+c)break; }
    }
    return Math.max(1,Math.round(days/3));
  },
};

const FE = {
  daily(bp,today){
    const dp=CE.day(today.getFullYear(),today.getMonth()+1,today.getDate());
    const rel=getTsuhensei(bp.day.kanIdx,dp.kanIdx);
    const me=JIKKAN[dp.kanIdx].element;
    const sm={
      "比肩":{action:85,judge:70,social:75,money:60},"劫財":{action:90,judge:60,social:65,money:55},
      "食神":{action:70,judge:75,social:80,money:70},"傷官":{action:65,judge:85,social:60,money:65},
      "偏財":{action:75,judge:70,social:85,money:90},"正財":{action:60,judge:80,social:75,money:85},
      "偏官":{action:80,judge:65,social:70,money:75},"正官":{action:70,judge:90,social:80,money:75},
      "偏印":{action:60,judge:90,social:65,money:60},"印綬":{action:65,judge:85,social:70,money:65},
    };
    const st=sm[rel]||{action:55,judge:55,social:55,money:55};
    const score=Math.round((st.action+st.judge+st.social+st.money)/4);
    const seed=today.getDate()+today.getMonth()*31;
    const ms=MISSIONS[me]||MISSIONS["土"];
    const av=AVOID_ACTIONS[me]||AVOID_ACTIONS["土"];
    const kb=KANTEIBUN[rel]||KANTEIBUN["比肩"];
    return {
      dayPillar:dp,todayKan:JIKKAN[dp.kanIdx],todayShi:JUNISHI[dp.shiIdx],
      mainElem:me,gogyo:GOGYO[me],tsuhensei:rel,status:st,score,
      rank:getFortuneRank(score),title:FORTUNE_TITLES[rel]||"今日の術者",
      mission:ms[seed%ms.length],avoids:[av[seed%av.length],av[(seed+1)%av.length]],
      kanteibun:kb[seed%kb.length],lucky:LUCKY_ELEMENTS[me]||LUCKY_ELEMENTS["土"],
    };
  },
};

// ══════════════════════════════════════════
// アプリ状態管理
// ══════════════════════════════════════════
const AppState = {
  name: '',
  pillars: null,
  gc: null,
  gb: null,
  str: null,
  fortune: null,
  daiun: null,
  myType: null,
  birthYear: null,
  currentPage: 'input', // input / fortune / honshitsu / aisho
};

// ══════════════════════════════════════════
// ページ切り替え
// ══════════════════════════════════════════
const PageManager = {
  pages: ['sec-input','sec-fortune','sec-honshitsu','sec-aisho'],

  show(pageId) {
    this.pages.forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById(pageId)?.classList.remove('hidden');

    const nav = document.getElementById('bottom-nav');
    const isResultPage = ['sec-fortune','sec-honshitsu','sec-aisho'].includes(pageId);
    nav?.classList.toggle('hidden', !isResultPage);

    // ナビボタンのactive切り替え
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const target = 'sec-' + btn.dataset.page;
      btn.classList.toggle('active', target === pageId);
    });

    AppState.currentPage = pageId.replace('sec-', '');
    window.scrollTo({top:0, behavior:'smooth'});
  },
};

// ══════════════════════════════════════════
// メイン計算
// ══════════════════════════════════════════
const App = {
  calc() {
    const name   = document.getElementById('inp-name').value.trim() || 'あなた';
    const dv     = document.getElementById('inp-date').value;
    const tv     = document.getElementById('inp-time').value;
    const gender = document.getElementById('inp-gender').value;
    if (!dv) { alert('生年月日を入力してください'); return; }
    const [y,m,d] = dv.split('-').map(Number);
    const h = tv ? parseInt(tv.split(':')[0]) : 12;

    AppState.name      = name;
    AppState.pillars   = PE.calc(y,m,d,h);
    AppState.gc        = AE.count(AppState.pillars);
    AppState.gb        = AE.balance(AppState.gc);
    AppState.str       = StE.judge(AppState.pillars.day.kanIdx, AppState.pillars, AppState.gc);
    AppState.fortune   = FE.daily(AppState.pillars, new Date());
    AppState.daiun     = DE.calc(y,m,d,gender,AppState.pillars);
    AppState.myType    = MEISHIKI_TYPES[JIKKAN[AppState.pillars.day.kanIdx].name] || MEISHIKI_TYPES["甲"];
    AppState.birthYear = y;

    UI.renderFortunePage();
    PageManager.show('sec-fortune');
  },
};

// ══════════════════════════════════════════
// UIレンダラー
// ══════════════════════════════════════════
const UI = {

  // ── 今日の運勢ページ ──────────────────
  renderFortunePage() {
    const d = AppState;
    document.getElementById('user-name-disp').textContent = d.name + ' さんの命式';
    this.typeCard(d);
    this.fortuneCard(d);
    this.statusGrid(d);
    this.luckyCard(d);
    this.gogyouCard(d);
    this.pillarsDetail(d);
    this.daiunDetail(d);
  },

  typeCard(d) {
    const t = d.myType;
    const kan = JIKKAN[d.pillars.day.kanIdx];
    document.getElementById('type-icon').textContent  = t.icon;
    document.getElementById('type-name').textContent  = t.name;
    document.getElementById('type-name').style.color  = t.color;
    document.getElementById('type-title').textContent = `〜 ${t.title} 〜`;
    document.getElementById('type-desc').textContent  = t.desc;
    document.getElementById('type-bg-kanji').textContent = kan.name;
  },

  fortuneCard(d) {
    const f = d.fortune;
    const today = new Date();
    const days = ['日','月','火','水','木','金','土'];
    document.getElementById('fc-date').textContent =
      `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日（${days[today.getDay()]}）`;
    const rank = f.rank;
    const rl = document.getElementById('rank-letter');
    rl.textContent = rank.rank; rl.style.color = rank.color;
    document.getElementById('rank-label-text').textContent = '本日の運気ランク';
    document.getElementById('rank-title-text').textContent = rank.label;
    document.getElementById('fc-kan').textContent = f.todayKan.name;
    document.getElementById('fc-kan').style.color = GOGYO[f.mainElem].color;
    document.getElementById('fc-shi').textContent = f.todayShi.name;
    document.getElementById('fc-shi').style.color = GOGYO[f.todayShi.element].color;
    // 通変星をタップ可能に
    document.getElementById('fc-ts').innerHTML = TermTip.tag(f.tsuhensei);
    const ge = GOGYO[f.mainElem];
    document.getElementById('fc-flow').innerHTML =
      `今日は ${TermTip.tag(f.mainElem, `${ge.emoji} ${f.mainElem}（${ge.desc}）`, 'flow-elem-highlight')} の気が流れています。`;
    document.getElementById('fc-shogo').textContent   = `✦ ${f.title} ✦`;
    document.getElementById('fc-kanteibun').textContent = f.kanteibun;
    document.getElementById('fc-mission').textContent   = f.mission;
    document.getElementById('fc-avoids').innerHTML = f.avoids.map(a =>
      `<div class="avoid-item"><div class="avoid-x">✕</div><span>${a}</span></div>`).join('');
  },

  statusGrid(d) {
    const s = d.fortune.status;
    const stats = [
      {icon:'⚡',name:'行動力',val:s.action,accent:'rgba(255,107,74,0.5)',glow:'rgba(255,107,74,0.15)'},
      {icon:'🧠',name:'判断力',val:s.judge, accent:'rgba(90,184,245,0.5)',glow:'rgba(90,184,245,0.15)'},
      {icon:'🤝',name:'対人運',val:s.social,accent:'rgba(79,201,122,0.5)',glow:'rgba(79,201,122,0.15)'},
      {icon:'💰',name:'金運',  val:s.money, accent:'rgba(201,168,76,0.5)',glow:'rgba(201,168,76,0.15)'},
    ];
    const grid = document.getElementById('stat-grid');
    grid.innerHTML = '';
    stats.forEach((st,i) => {
      const cls = st.val>=80?'high':st.val>=60?'mid':'low';
      const colors = {high:'#f5d878',mid:'#90c8a0',low:'#b090e0'};
      const fills  = {
        high:`linear-gradient(90deg,${st.accent.replace('0.5','0.8')},${st.accent.replace('0.5','1.2')})`,
        mid:'linear-gradient(90deg,rgba(60,180,100,0.8),rgba(90,220,130,1))',
        low:'linear-gradient(90deg,rgba(100,80,200,0.8),rgba(140,110,240,1))',
      };
      const card = document.createElement('div');
      card.className = 'stat-card';
      card.style.setProperty('--card-accent', st.accent);
      card.style.setProperty('--card-glow', st.glow);
      card.style.animationDelay = `${0.2+i*0.08}s`;
      card.innerHTML = `
        <span class="stat-icon">${st.icon}</span>
        <div class="stat-name">${st.name}</div>
        <div class="stat-value" style="color:${colors[cls]};text-shadow:0 0 16px ${colors[cls]}88">${st.val}</div>
        <div class="stat-gauge"><div class="stat-fill" style="width:0%;background:${fills[cls]}" data-w="${st.val}"></div></div>`;
      grid.appendChild(card);
    });
    setTimeout(() => {
      document.querySelectorAll('.stat-fill').forEach(el => { el.style.width = el.dataset.w + '%'; });
    }, 300);
  },

  luckyCard(d) {
    const lk = d.fortune.lucky;
    const ge = d.fortune.gogyo;
    document.getElementById('lucky-title').innerHTML = `${ge.emoji} 今日のラッキー要素`;
    document.getElementById('lucky-color').textContent     = lk.color;
    document.getElementById('lucky-number').textContent    = lk.number.join('・');
    document.getElementById('lucky-direction').textContent = lk.direction;
    document.getElementById('lucky-food').textContent      = lk.food;
    document.getElementById('lucky-time').textContent      = lk.time;
    document.getElementById('lucky-item-val').textContent  = lk.luckyItem || ge.luckyItem;
  },

  gogyouCard(d) {
    const gb = d.gb;
    const order = ["木","火","土","金","水"];
    const cx=90, cy=90, r=65;
    let svgContent = `<defs><filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`;
    [0.33,0.66,1].forEach(sc => {
      const gpts = order.map((_,i) => { const a=(i/5)*Math.PI*2-Math.PI/2; return `${cx+r*sc*Math.cos(a)},${cy+r*sc*Math.sin(a)}`; });
      svgContent += `<polygon points="${gpts.join(' ')}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    });
    order.forEach((_,i) => {
      const a=(i/5)*Math.PI*2-Math.PI/2;
      svgContent += `<line x1="${cx}" y1="${cy}" x2="${cx+r*Math.cos(a)}" y2="${cy+r*Math.sin(a)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
    });
    const pts = order.map((e,i) => { const a=(i/5)*Math.PI*2-Math.PI/2,v=(gb[e]||0)/100; return {x:cx+r*v*Math.cos(a),y:cy+r*v*Math.sin(a),e}; });
    const polyPts = pts.map(p=>`${p.x},${p.y}`).join(' ');
    const dom = order.reduce((a,b)=>(gb[a]||0)>(gb[b]||0)?a:b);
    const dc = GOGYO[dom].color;
    svgContent += `<polygon points="${polyPts}" fill="${dc}22" stroke="${dc}" stroke-width="1.5" filter="url(#glow)"/>`;
    pts.forEach((p,i) => {
      const g=GOGYO[p.e];
      svgContent += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="${g.color}" filter="url(#glow)"/>`;
      const lx=cx+(r+18)*Math.cos((i/5)*Math.PI*2-Math.PI/2), ly=cy+(r+18)*Math.sin((i/5)*Math.PI*2-Math.PI/2);
      svgContent += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="${g.color}" font-size="12" font-weight="700" font-family="serif">${p.e}</text>`;
    });
    document.getElementById('gogyou-svg').innerHTML = svgContent;
    document.getElementById('gogyou-dom').textContent = dom + GOGYO[dom].emoji;
    const bl = document.getElementById('gogyou-bars');
    bl.innerHTML = '';
    order.forEach(e => {
      const g=GOGYO[e], pct=gb[e]||0;
      bl.innerHTML += `
        <div class="gogyou-bar-row">
          <span class="gogyou-bar-icon">${g.emoji}</span>
          <span class="gogyou-bar-name" style="color:${g.color}">${e}</span>
          <div class="gogyou-bar-track"><div class="gogyou-bar-fill" style="width:${pct}%;background:${g.color};color:${g.color}"></div></div>
          <span class="gogyou-bar-pct">${pct}%</span>
        </div>`;
    });
  },

  pillarsDetail(d) {
    const labelKeys = [
      { label:'年', termKey:'年柱', pillarKey:'year'  },
      { label:'月', termKey:'月柱', pillarKey:'month' },
      { label:'日', termKey:'日柱', pillarKey:'day'   },
      { label:'時', termKey:'時柱', pillarKey:'hour'  },
    ];
    const pg = document.getElementById('pillars-g4');
    pg.innerHTML = '';
    labelKeys.forEach(({label, termKey, pillarKey}) => {
      const p   = d.pillars[pillarKey];
      const kan = JIKKAN[p.kanIdx];
      const shi = JUNISHI[p.shiIdx];
      const z   = ZOKAN[shi.name];
      let zk = '';
      if (z) {
        const pts = [];
        if (z.honki  != null) pts.push(`<span class="tt-word tt-zk" data-term="${JIKKAN[z.honki].name}">${JIKKAN[z.honki].name}<sup class="tt-q">?</sup></span>`);
        if (z.chuuki != null) pts.push(`<span class="tt-word tt-zk" data-term="${JIKKAN[z.chuuki].name}">${JIKKAN[z.chuuki].name}<sup class="tt-q">?</sup></span>`);
        if (z.yoki   != null) pts.push(`<span class="tt-word tt-zk" data-term="${JIKKAN[z.yoki].name}">${JIKKAN[z.yoki].name}<sup class="tt-q">?</sup></span>`);
        zk = pts.join(' ');
      }
      const div = document.createElement('div');
      div.className = 'pillar-mini';
      div.innerHTML = `
        <div class="pillar-mini-lbl">${TermTip.tag(termKey, label+'柱')}</div>
        <span class="pillar-mini-kan tt-word" data-term="${kan.element}" style="color:${GOGYO[kan.element].color}">${kan.name}</span>
        <span class="pillar-mini-shi tt-word" data-term="${shi.element}" style="color:${GOGYO[shi.element].color}">${shi.name}</span>
        <div class="pillar-mini-zk">${zk || '—'}</div>`;
      pg.appendChild(div);
    });

    // 身強・身弱（タップ可能）
    const s = d.str;
    const strEl = document.getElementById('str-label');
    strEl.innerHTML  = TermTip.tag(s.label, s.label, 'str-label-inner');
    strEl.style.color = s.color;
    document.getElementById('str-bar').style.width      = s.power + '%';
    document.getElementById('str-bar').style.background = `linear-gradient(90deg,${s.color}88,${s.color})`;
    document.getElementById('str-desc').textContent     = s.desc;
  },

  daiunDetail(d) {
    const age  = new Date().getFullYear() - d.birthYear;
    const dir  = d.daiun.isJunko ? '順行' : '逆行';
    document.getElementById('daiun-info').innerHTML =
      `${TermTip.tag('起運')} ${d.daiun.startAge}歳 ／ ${TermTip.tag(dir)}`;

    const list = document.getElementById('daiun-list2');
    list.innerHTML = '';
    d.daiun.list.forEach(r => {
      const isCur = age >= r.age && age <= r.endAge;
      const ti    = TSUHENSEI[r.tsuhen] || {};
      const juTag = TermTip.tag(r.juniun?.name || '', r.juniun?.name || '', 'daiun-ju-tag');
      const div   = document.createElement('div');
      div.className = `daiun-item${isCur ? ' now' : ''}`;
      div.innerHTML = `
        <span class="daiun-age">${r.age}〜${r.endAge}歳</span>
        <span class="daiun-kanshi">
          <span style="color:${GOGYO[r.kan.element].color}">${r.kan.name}</span>
          <span style="color:${GOGYO[r.shi.element].color}">${r.shi.name}</span>
        </span>
        <span class="daiun-ts">${TermTip.tag(r.tsuhen, r.tsuhen)}</span>
        <span class="daiun-ju">${juTag}</span>
        ${isCur ? '<span class="daiun-now-badge">現在</span>' : ''}`;
      list.appendChild(div);
    });
  },

  // ── あなたはどんな人ページ ────────────
  renderHonshitsuPage() {
    const d   = AppState;
    const kan = JIKKAN[d.pillars.day.kanIdx];
    const hs  = HONSHITSU[kan.name] || HONSHITSU["甲"];
    const gb  = d.gb;

    document.getElementById('hs-subtitle').textContent =
      `${d.name} さん ／ 日干：${kan.name}（${kan.reading}） ／ ${d.str.label}`;

    const sections = [
      { icon:'🌟', title:'あなたの基本タイプ', key:'basicType', isShort:true },
      { icon:'🌿', title:'性格の傾向',         key:'seikaku' },
      { icon:'⚡', title:'才能・向いていること', key:'sainou' },
      { icon:'🤝', title:'人間関係の傾向',      key:'ningenKankei' },
      { icon:'💰', title:'仕事・お金の傾向',    key:'shigoKane' },
      { icon:'❤️', title:'恋愛・家族の傾向',    key:'renaiKazoku' },
      { icon:'🌙', title:'人生のテーマ',        key:'jinsei' },
      { icon:'✨', title:'開運アドバイス',       key:'kaiun' },
    ];

    const container = document.getElementById('honshitsu-cards');
    container.innerHTML = '';

    sections.forEach((sec, idx) => {
      const text = hs[sec.key] || '';
      const card = document.createElement('div');
      card.className = 'hs-card';
      card.style.animationDelay = `${idx * 0.07}s`;

      if (sec.isShort) {
        card.innerHTML = `
          <div class="hs-card-header">
            <span class="hs-card-icon">${sec.icon}</span>
            <h3 class="hs-card-title">${sec.title}</h3>
          </div>
          <div class="hs-basic-type">
            <span class="hs-type-icon">${d.myType.icon}</span>
            <span class="hs-type-name" style="color:${d.myType.color}">${text}</span>
          </div>
          <p class="hs-card-body">${d.myType.desc}</p>`;
      } else {
        // 複数段落に分割して表示
        const paras = text.split('\n\n').filter(p => p.trim());
        const parasHtml = paras.map(p => `<p class="hs-para">${p.trim()}</p>`).join('');
        card.innerHTML = `
          <div class="hs-card-header">
            <span class="hs-card-icon">${sec.icon}</span>
            <h3 class="hs-card-title">${sec.title}</h3>
          </div>
          <div class="hs-card-body">${parasHtml}</div>`;
      }
      container.appendChild(card);
    });

    // 五行特性カードを末尾に追加
    const order = ["木","火","土","金","水"];
    const dom   = order.reduce((a,b) => (gb[a]||0)>(gb[b]||0) ? a : b);
    const weak  = order.reduce((a,b) => (gb[a]||0)<(gb[b]||0) ? a : b);
    const domG  = GOGYO[dom], weakG = GOGYO[weak];

    const gogyouCard = document.createElement('div');
    gogyouCard.className = 'hs-card hs-gogyou-summary';
    gogyouCard.style.animationDelay = `${sections.length * 0.07}s`;
    gogyouCard.innerHTML = `
      <div class="hs-card-header">
        <span class="hs-card-icon">⊕</span>
        <h3 class="hs-card-title">あなたの五行エネルギー</h3>
      </div>
      <div class="hs-gogyou-chips">
        <div class="hs-gogyou-chip" style="border-color:${domG.color}22;background:${domG.color}10">
          <span class="hsgc-label">最も強い気</span>
          <span class="hsgc-elem" style="color:${domG.color}">${domG.emoji} ${dom}</span>
          <span class="hsgc-desc">${domG.desc}</span>
        </div>
        <div class="hs-gogyou-chip" style="border-color:${weakG.color}22;background:${weakG.color}10">
          <span class="hsgc-label">補うと整う気</span>
          <span class="hsgc-elem" style="color:${weakG.color}">${weakG.emoji} ${weak}</span>
          <span class="hsgc-desc">${weakG.desc}を意識すると好バランスに</span>
        </div>
      </div>`;
    container.appendChild(gogyouCard);
  },

  // ── 相性診断ページ ────────────────────
  calcAisho() {
    const myDateVal  = document.getElementById('a-my-date').value;
    const thDateVal  = document.getElementById('a-th-date').value;
    if (!myDateVal || !thDateVal) { alert('二人の生年月日を入力してください'); return; }

    const myNoTime = document.getElementById('a-my-notime').checked;
    const thNoTime = document.getElementById('a-th-notime').checked;
    const myTimeVal = document.getElementById('a-my-time').value;
    const thTimeVal = document.getElementById('a-th-time').value;
    const myGender = document.getElementById('a-my-gender').value;
    const thGender = document.getElementById('a-th-gender').value;
    const thName   = document.getElementById('a-th-name').value.trim() || '相手';
    const relation = document.querySelector('.chip.active')?.dataset.val || '恋人';

    const [my,mm,md] = myDateVal.split('-').map(Number);
    const [ty,tm,td] = thDateVal.split('-').map(Number);
    const mh = (!myNoTime && myTimeVal) ? parseInt(myTimeVal.split(':')[0]) : 12;
    const th = (!thNoTime && thTimeVal) ? parseInt(thTimeVal.split(':')[0]) : 12;

    const myPillars = PE.calc(my,mm,md,mh);
    const thPillars = PE.calc(ty,tm,td,th);
    const myGc = AE.count(myPillars);
    const thGc = AE.count(thPillars);
    const myGb = AE.balance(myGc);
    const thGb = AE.balance(thGc);

    const myElem = JIKKAN[myPillars.day.kanIdx].element;
    const thElem = JIKKAN[thPillars.day.kanIdx].element;
    const relType = (GOGYOU_RELATION[myElem]?.[thElem]) || "比和";
    const score   = calcAishoScore(myElem, thElem, myGb, thGb);
    const aType   = AISHOTYP[relType] || AISHOTYP["比和"];
    const hitokoto= (HITOKOTO_AISHŌ[relType] || {})[relation] || "二人の縁はこれから深まっていきます。";

    this.renderAishoResult({
      myName: AppState.name, thName, relation, score,
      relType, aType, hitokoto,
      myPillars, thPillars, myGb, thGb,
      myElem, thElem,
    });
  },

  renderAishoResult(data) {
    document.getElementById('aisho-input-area').classList.add('hidden');
    const ra = document.getElementById('aisho-result-area');
    ra.classList.remove('hidden');
    ra.classList.add('fade-in');

    document.getElementById('ar-myname').textContent = data.myName;
    document.getElementById('ar-thname').textContent = data.thName;

    // スコアリング（円グラフ）
    document.getElementById('ar-score-num').textContent = data.score;
    const ring = document.getElementById('ar-score-ring');
    const circumference = 327;
    const offset = circumference - (data.score / 100) * circumference;
    // スコアに応じた色
    const scoreColor = data.score >= 80 ? '#f5d878' : data.score >= 65 ? '#c9a84c' : data.score >= 50 ? '#9b5de5' : '#8888cc';
    ring.style.stroke = scoreColor;
    setTimeout(() => { ring.style.strokeDashoffset = offset; }, 200);

    // 関係タイプ
    document.getElementById('ar-type-icon').textContent = data.aType.icon;
    document.getElementById('ar-type-name').textContent = data.aType.name;
    document.getElementById('ar-type-desc').textContent = data.aType.desc;

    // ひとこと
    document.getElementById('ar-hitokoto').textContent = data.hitokoto;

    // 五行比較
    this.renderGogyouCompare(data);
  },

  renderGogyouCompare(data) {
    const order = ["木","火","土","金","水"];
    const container = document.getElementById('ar-gogyou-compare');
    container.innerHTML = '';
    order.forEach(e => {
      const g = GOGYO[e];
      const myPct = data.myGb[e] || 0;
      const thPct = data.thGb[e] || 0;
      container.innerHTML += `
        <div class="agc-row">
          <span class="agc-name" style="color:${g.color}">${g.emoji}${e}</span>
          <div class="agc-bars">
            <div class="agc-bar-wrap agc-left">
              <div class="agc-bar agc-bar-left" style="width:${myPct}%;background:${g.color}88"></div>
            </div>
            <div class="agc-mid-label">${myPct}<span class="agc-vs">vs</span>${thPct}</div>
            <div class="agc-bar-wrap agc-right">
              <div class="agc-bar agc-bar-right" style="width:${thPct}%;background:${g.color}"></div>
            </div>
          </div>
        </div>`;
    });
    // 凡例
    container.innerHTML += `
      <div class="agc-legend">
        <span><span class="agc-dot" style="background:rgba(201,168,76,0.5)"></span>${data.myName}</span>
        <span><span class="agc-dot" style="background:#c9a84c"></span>${data.thName}</span>
      </div>`;
  },
};

// ══════════════════════════════════════════
// 用語辞書（TermDictionary）
// ══════════════════════════════════════════
const TERM_DICT = {
  // 命式の基本構造
  "四柱": {
    reading: "しちゅう",
    short: "生年月日時を4つの柱で表したもの",
    body: "生まれた「年・月・日・時間」をそれぞれ干支（かんし）に変換した4つの柱のことです。この4本の柱があなたの命式の土台で、性格・才能・運の流れがすべてここに凝縮されています。",
    advice: "4つの柱を組み合わせて読むことで、あなたの本質や人生のテーマが見えてきます。",
  },
  "日主": {
    reading: "にっしゅ",
    short: "命式の中心・あなた自身を表す柱",
    body: "日柱の天干（上の漢字）のことで、命式の中で「自分自身」を意味します。四柱推命では、他のすべての星は日主との関係で意味が決まります。",
    advice: "日主の五行（木・火・土・金・水）があなたの基本的な性質や行動パターンの源になっています。",
  },
  "蔵干": {
    reading: "ぞうかん",
    short: "地支の中に隠れた干のこと",
    body: "十二支（地支）の中には、表に見えない干（かん）が隠れています。これを蔵干といいます。本気（最も影響が強い）・中気・余気の3層があり、命式をより精密に読むために使います。",
    advice: "蔵干を含めた五行バランスを見ることで、表面には出にくいあなたの隠れた才能や性質が分かります。",
  },
  "年柱": {
    reading: "ねんちゅう",
    short: "生まれた年から出る柱。祖先・社会運を表す",
    body: "生まれた年の干支から算出する柱です。祖先・家系・社会や組織における立場・若い頃の運を読みます。また、他者から見たあなたの第一印象にも関係します。",
    advice: "年柱の通変星は、あなたが社会の中でどう見られやすいかのヒントになります。",
  },
  "月柱": {
    reading: "げっちゅう",
    short: "生まれた月から出る柱。才能・仕事運の核心",
    body: "生まれた月の節入り（節気）を基準に算出する柱です。才能・仕事・親兄弟との関係・壮年期の運を読みます。四柱の中でも最も影響力が強いとされ、身強・身弱の判定でも重要な役割を持ちます。",
    advice: "月柱はあなたの「天職」や「得意なこと」と深くつながっています。",
  },
  "日柱": {
    reading: "にっちゅう",
    short: "生まれた日から出る柱。あなた自身と配偶者を表す",
    body: "生まれた日から算出する柱で、命式の中心です。上の漢字（天干）があなた自身、下の漢字（地支）が配偶者や最も親しいパートナーを表します。",
    advice: "日柱はあなたの本質を最もダイレクトに表す柱。日干の五行とタイプ名から自分らしさを読み取ってみましょう。",
  },
  "時柱": {
    reading: "じちゅう",
    short: "生まれた時間から出る柱。子供・晩年運を表す",
    body: "生まれた時間帯から算出する柱です。子供・部下・晩年（50代以降）の運を読みます。出生時間が分かると命式の精度が上がります。",
    advice: "時柱の星は、人生後半に向けて開花しやすいテーマを教えてくれます。",
  },
  // 身強・身弱
  "身強": {
    reading: "みきょう",
    short: "自分のエネルギーが強めな状態",
    body: "日主（あなた自身）を表すエネルギーが強めな命式です。自分の意志で物事を動かす力があり、主体的に行動しやすいタイプです。特に月令（生まれた月との相性）が強さの根拠になっています。",
    advice: "持ち前の行動力と意志の強さを活かして、自ら道を切り開いていきましょう。頑張りすぎや独りよがりには意識的に注意すると、さらに力が開花します。",
  },
  "身弱": {
    reading: "みじゃく",
    short: "自分のエネルギーが控えめな状態",
    body: "日主（あなた自身）を表すエネルギーが控えめな命式です。一人で抱え込むより、周囲の力・環境・縁を活かして進むことで真価を発揮するタイプです。感受性が豊かで繊細な感性を持っていることが多いです。",
    advice: "「弱さ」ではなく「柔軟さ」。流れに乗り、人とつながることで大きな力になります。自分を助けてくれる環境や人を大切にしましょう。",
  },
  // 通変星
  "比肩": {
    reading: "ひけん",
    short: "自立心・意志の強さを表す星",
    body: "日主と同じ五行・同じ陰陽を持つ干との関係から生まれる星です。自立心、自分らしさ、独立心、競争心を表します。自分の道を自分の力で歩む傾向を示します。",
    advice: "人に流されず、自分の軸を持って進む力があります。その独立心を活かして、自分だけの得意分野を深めていきましょう。",
  },
  "劫財": {
    reading: "ごうざい",
    short: "仲間・競争心・大きな流れを動かす力",
    body: "日主と同じ五行・異なる陰陽を持つ干との関係から生まれる星です。仲間を巻き込む力、競争心、積極性、大胆さを表します。エネルギーが外に向かって発散しやすい星です。",
    advice: "人を巻き込む力がありますが、お金や人間関係では勢いに任せすぎないように。チームで動くときに最大の力を発揮します。",
  },
  "食神": {
    reading: "しょくじん",
    short: "楽しみ・才能・ゆとりを表す星",
    body: "日主が生み出す五行との関係から生まれる星です。楽しみ、表現力、ゆとり、衣食住の豊かさ、才能の発揮を表します。自分らしく楽しみながら輝ける星です。",
    advice: "楽しんでいる人に幸運は集まります。好きなことを追求することで、才能が自然と開花していきます。",
  },
  "傷官": {
    reading: "しょうかん",
    short: "表現力・個性・鋭いセンスを表す星",
    body: "日主が生み出す五行・異なる陰陽との関係から生まれる星です。卓越した表現力、鋭い感性、完璧主義、美意識の高さを表します。型にはまらない独創性が光る星です。",
    advice: "美意識や言葉の力が強く出やすい星です。繊細になりすぎず、その感性をクリエイティブな方向に向けていきましょう。",
  },
  "偏財": {
    reading: "へんざい",
    short: "行動的な財運・社交性を表す星",
    body: "日主が剋する五行・同じ陰陽との関係から生まれる星です。社交性、行動力、人とのつながり、動的なお金の流れを表します。動けば動くほどチャンスが広がる星です。",
    advice: "人とのつながりの中にチャンスが生まれやすいタイプです。積極的に外に出て、人と交流することが開運への道になります。",
  },
  "正財": {
    reading: "せいざい",
    short: "堅実な財運・安定感を表す星",
    body: "日主が剋する五行・異なる陰陽との関係から生まれる星です。堅実さ、安定、現実感覚、コツコツ積み上げる力を表します。長期的に安定した財運につながる星です。",
    advice: "地道な積み重ねが確実に実を結ぶ星です。焦らずコツコツ続けることが、長期的な豊かさへの最短ルートです。",
  },
  "偏官": {
    reading: "へんかん",
    short: "行動力・決断力・勝負強さを表す星",
    body: "日主を剋する五行・同じ陰陽との関係から生まれる星です。行動力、決断力、プレッシャーへの対応力、勝負強さを表します。困難を乗り越えるたびに強くなる星です。",
    advice: "試練がある場面でこそ本来の力が発揮されます。困難から逃げずに向き合うことで、あなたの器がどんどん大きくなっていきます。",
  },
  "正官": {
    reading: "せいかん",
    short: "責任感・信用・社会性を表す星",
    body: "日主を剋する五行・異なる陰陽との関係から生まれる星です。責任感、信用、規律、ルール感覚、社会的な評価を表します。誠実に積み重ねることで信頼される立場につながる星です。",
    advice: "まじめに積み重ねたものが最大の武器になります。誠実さと品格を大切にすることで、人生の大切な場面で評価され、道が開けていきます。",
  },
  "偏印": {
    reading: "へんいん",
    short: "ひらめき・独自性・変化への対応力",
    body: "日主を生み出す五行・同じ陰陽との関係から生まれる星です。独自の感性、直感力、ひらめき、型にはまらない発想を表します。普通とは違う視点でものを見る星です。",
    advice: "アイデアや創作活動に強みが出やすい星です。直感を信じて行動することで、思わぬ才能が開花していきます。",
  },
  "印綬": {
    reading: "いんじゅ",
    short: "学び・知性・保護・精神的な支え",
    body: "日主を生み出す五行・異なる陰陽との関係から生まれる星です。学問、知恵、保護、精神的な安定、人からの支援を表します。学ぶことで力が増す星です。",
    advice: "知識を深めたり、信頼できる人から助けを受けることで力を発揮しやすいタイプです。学び続けることがあなたの最大の開運行動です。",
  },
  // 十二運
  "長生": {
    reading: "ちょうせい",
    short: "生まれ出るような新鮮なエネルギー",
    body: "十二運のひとつで、生命力が湧き出る状態を表します。新しいことへの好奇心と純粋なエネルギーが特徴です。",
    advice: "この星がある柱は、新しいことをスタートさせる力が強いエリアです。",
  },
  "建禄": {
    reading: "けんろく",
    short: "最も充実したエネルギーの状態",
    body: "十二運のひとつで、本来の力が最大限に発揮される状態を表します。安定した実力と自信が特徴です。",
    advice: "この星がある柱のテーマで、あなたは本来の力を最大限に発揮できます。",
  },
  "帝旺": {
    reading: "ていおう",
    short: "頂点に立つ圧倒的なエネルギー",
    body: "十二運のひとつで、生命力・支配力が頂点に達した状態を表します。強いリーダーシップと存在感が特徴です。",
    advice: "この星がある柱のテーマで、あなたは特に強い影響力を発揮できます。",
  },
  "冠帯": {
    reading: "かんたい",
    short: "才能が開花するエネルギー",
    body: "十二運のひとつで、才能や実力が外に現れ始める状態を表します。自信と活力が高まる時期のイメージです。",
    advice: "この星がある柱は、才能が表に出やすいエリアです。積極的に自己表現してみましょう。",
  },
  "沐浴": {
    reading: "もくよく",
    short: "磨かれる試練のエネルギー",
    body: "十二運のひとつで、磨かれる時期・試練の時期を表します。不安定さがある反面、その経験が才能を磨きます。",
    advice: "試練があってもそれが成長の種。この柱のテーマは、経験を通じて輝きが増す分野です。",
  },
  "衰": {
    reading: "すい",
    short: "熟成・知恵が深まるエネルギー",
    body: "十二運のひとつで、勢いは落ち着きながらも知恵が深まる状態を表します。内側に力が蓄積されていきます。",
    advice: "この星がある柱のテーマは、経験と知恵を活かす方向で力を発揮できます。",
  },
  "病": {
    reading: "びょう",
    short: "充電・内省のエネルギー",
    body: "十二運のひとつで、エネルギーが弱まり充電が必要な状態を表します。無理をせず内省することで次の力が蓄えられます。",
    advice: "この星がある柱のテーマは、焦らずゆっくり進むことで力が発揮されやすい分野です。",
  },
  "死": {
    reading: "し",
    short: "変容・新しい始まりの準備",
    body: "十二運のひとつで、古いものが終わり新しいものへ変容する状態を表します。「死」という字ですが、次の生への準備期間を意味します。",
    advice: "この星がある柱のテーマは、手放すことで新しい扉が開く分野です。",
  },
  "墓": {
    reading: "ぼ",
    short: "蓄積・内側に力を溜めるエネルギー",
    body: "十二運のひとつで、内側に力や財を蓄積している状態を表します。表には出にくいですが、確かな力が内在しています。",
    advice: "この星がある柱のテーマは、地道な積み重ねが後に大きな力になる分野です。",
  },
  "絶": {
    reading: "ぜつ",
    short: "ゼロリセット・生まれ変わりの準備",
    body: "十二運のひとつで、完全にリセットされ次の周期へ向かう準備の状態です。変化への対応力が高まります。",
    advice: "この星がある柱のテーマは、変化を恐れずに新しい自分へ向かうことで力が開花する分野です。",
  },
  "胎": {
    reading: "たい",
    short: "可能性のタネが宿るエネルギー",
    body: "十二運のひとつで、次の生命のタネが宿る状態を表します。まだ形にはなっていないが、大きな可能性が内包されています。",
    advice: "この柱のテーマは、時間をかけてじっくり育てることで大きな花を咲かせる分野です。",
  },
  "養": {
    reading: "よう",
    short: "育まれ・サポートされるエネルギー",
    body: "十二運のひとつで、周囲に育まれながら成長する状態を表します。人から助けられながら力をつけていく時期のイメージです。",
    advice: "この星がある柱のテーマは、人のサポートを素直に受け取ることで力が増す分野です。",
  },
  // 大運・運気
  "大運": {
    reading: "だいうん",
    short: "10年ごとに変わる人生の大きな流れ",
    body: "人生を10年ごとに区切った大きな運気の流れのことです。人生の季節のようなもので、その時期に出やすいテーマや課題が変わります。月柱の干支を基準に、順行か逆行かで10年ごとに進んでいきます。",
    advice: "現在どの大運にいるかを知ることで、今の人生のテーマや向かい風・追い風が見えてきます。",
  },
  "起運": {
    reading: "きうん",
    short: "大運が始まる年齢",
    body: "その人の大運が何歳から始まるかを示す年齢のことです。生まれてから最初の節気（節入り）までの日数を3で割って計算されます。人によって1歳〜10歳程度の幅があります。",
    advice: "起運年齢から10年ごとに大運が切り替わっていきます。自分の人生の「季節の変わり目」を知るヒントになります。",
  },
  "順行": {
    reading: "じゅんこう",
    short: "大運が月柱から順方向に進むこと",
    body: "大運の干支が、生まれた月柱の次の干支へと順番に進んでいく流れのことです。陽年生まれの男性・陰年生まれの女性が順行となります。",
    advice: "順行・逆行どちらが良い・悪いということはありません。それぞれ異なる人生の流れのパターンを表しています。",
  },
  "逆行": {
    reading: "ぎゃっこう",
    short: "大運が月柱から逆方向に進むこと",
    body: "大運の干支が、生まれた月柱の前の干支へと逆方向に進んでいく流れのことです。陽年生まれの女性・陰年生まれの男性が逆行となります。",
    advice: "逆行だから不利ということはありません。順行・逆行はただ「進み方の方向」が異なるだけです。",
  },
  // 五行
  "木": {
    reading: "もく",
    short: "成長・発展・創造性のエネルギー",
    body: "五行のひとつ。春の生命力、伸びる力、創造性、柔軟性を象徴します。肝・胆と対応し、方角は東、季節は春です。",
    advice: "木のエネルギーが強い日・時期は、新しいことを始めたり、計画を立てたりするのに最適です。",
  },
  "火": {
    reading: "か",
    short: "情熱・行動・社交性のエネルギー",
    body: "五行のひとつ。夏の熱気、情熱、表現力、行動力、社交性を象徴します。心・小腸と対応し、方角は南、季節は夏です。",
    advice: "火のエネルギーが強い日・時期は、積極的に人と関わり、自分を表現することが開運につながります。",
  },
  "土": {
    reading: "ど・つち",
    short: "安定・信頼・包容力のエネルギー",
    body: "五行のひとつ。大地のような安定感、包容力、信頼、調和を象徴します。脾・胃と対応し、方角は中央、季節は土用です。",
    advice: "土のエネルギーが強い日・時期は、基盤を固め、人との信頼関係を育てることが大切です。",
  },
  "金": {
    reading: "きん・かね",
    short: "決断・収穫・洗練のエネルギー",
    body: "五行のひとつ。収穫の秋、決断力、正義感、洗練、完成を象徴します。肺・大腸と対応し、方角は西、季節は秋です。",
    advice: "金のエネルギーが強い日・時期は、決断し、不要なものを整理・手放すことが運を高めます。",
  },
  "水": {
    reading: "すい・みず",
    short: "知恵・柔軟・潜在力のエネルギー",
    body: "五行のひとつ。冬の静寂、知恵、直感力、柔軟性、潜在能力を象徴します。腎・膀胱と対応し、方角は北、季節は冬です。",
    advice: "水のエネルギーが強い日・時期は、直感を信じ、学びや内省に時間を使うことが力を高めます。",
  },
  // 陰陽
  "陽": {
    reading: "よう",
    short: "積極的・外向き・拡大のエネルギー",
    body: "陰陽のうちの「陽」。外に向かって発散する積極的なエネルギーを表します。活動的で行動を起こす方向性があります。十干では甲・丙・戊・庚・壬が陽です。",
    advice: "陽の干を持つ柱は、積極的に動くことでエネルギーが活きる分野を示しています。",
  },
  "陰": {
    reading: "いん",
    short: "受容的・内向き・凝縮のエネルギー",
    body: "陰陽のうちの「陰」。内に向かって凝縮する受容的なエネルギーを表します。繊細さや柔軟性が特徴です。十干では乙・丁・己・辛・癸が陰です。",
    advice: "陰の干を持つ柱は、じっくりと育て磨いていくことでエネルギーが活きる分野を示しています。",
  },
};

// ══════════════════════════════════════════
// TermTip（用語説明ボトムシート）
// ══════════════════════════════════════════
const TermTip = {
  /**
   * 用語をタップ可能なspanに変換するHTML生成
   * @param {string} term 用語名
   * @param {string} [displayText] 表示テキスト（省略時はterm）
   * @param {string} [extraClass] 追加クラス
   */
  tag(term, displayText, extraClass = '') {
    const text = displayText || term;
    const hasDef = !!TERM_DICT[term];
    if (!hasDef) return `<span>${text}</span>`;
    return `<span class="tt-word ${extraClass}" data-term="${term}">${text}<sup class="tt-q">?</sup></span>`;
  },

  /** ボトムシートを開く */
  open(term) {
    const def = TERM_DICT[term];
    if (!def) return;

    document.getElementById('tt-name').textContent    = term;
    document.getElementById('tt-reading').textContent = def.reading ? `（${def.reading}）` : '';
    document.getElementById('tt-short').textContent   = def.short;
    document.getElementById('tt-body').textContent    = def.body;
    document.getElementById('tt-advice').textContent  = def.advice;

    const sheet = document.getElementById('term-sheet');
    const overlay = document.getElementById('term-overlay');
    sheet.classList.remove('tt-hidden');
    overlay.classList.remove('tt-hidden');
    // アニメーション
    requestAnimationFrame(() => {
      sheet.classList.add('tt-open');
    });
    // スクロール防止
    document.body.style.overflow = 'hidden';
  },

  /** ボトムシートを閉じる */
  close() {
    const sheet = document.getElementById('term-sheet');
    const overlay = document.getElementById('term-overlay');
    sheet.classList.remove('tt-open');
    overlay.classList.add('tt-hidden');
    setTimeout(() => {
      sheet.classList.add('tt-hidden');
      document.body.style.overflow = '';
    }, 300);
  },

  /** 用語タップのグローバルハンドラ登録 */
  init() {
    // イベントデリゲーション（動的生成要素にも対応）
    document.addEventListener('click', e => {
      const word = e.target.closest('.tt-word');
      if (word) {
        e.stopPropagation();
        this.open(word.dataset.term);
      }
    });
    // オーバーレイクリックで閉じる
    document.getElementById('term-overlay')?.addEventListener('click', () => this.close());
    // 閉じるボタン
    document.getElementById('tt-close')?.addEventListener('click', () => this.close());
    // スワイプダウンで閉じる（簡易版）
    let startY = 0;
    const sheet = document.getElementById('term-sheet');
    sheet?.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, {passive:true});
    sheet?.addEventListener('touchend',   e => { if (e.changedTouches[0].clientY - startY > 60) this.close(); }, {passive:true});
  },
};

// ══════════════════════════════════════════
// イベントリスナー
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  StarField.init();
  TermTip.init();

  // 命式計算
  document.getElementById('btn-calc').addEventListener('click', () => App.calc());

  // 戻るボタン
  document.getElementById('btn-back').addEventListener('click', () => {
    document.getElementById('bottom-nav').classList.add('hidden');
    PageManager.show('sec-input');
  });

  // ボトムナビ
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!AppState.pillars) return;
      const page = 'sec-' + btn.dataset.page;
      if (page === 'sec-honshitsu') UI.renderHonshitsuPage();
      PageManager.show(page);
    });
  });

  // 展開トグル
  document.querySelectorAll('.expand-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const open = btn.classList.toggle('open');
      btn.nextElementSibling.classList.toggle('open', open);
    });
  });

  // プレミアムモーダル
  document.querySelectorAll('.premium-trigger, .btn-unlock').forEach(b => {
    b.addEventListener('click', () => document.getElementById('modal').classList.remove('hidden'));
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('modal').classList.add('hidden');
  });
  document.getElementById('modal').addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) document.getElementById('modal').classList.add('hidden');
  });

  // 関係性チップ
  document.getElementById('relation-chips').addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });

  // 出生時間不明チェックボックス
  document.getElementById('a-my-notime').addEventListener('change', e => {
    document.getElementById('a-my-time').disabled = e.target.checked;
    if (e.target.checked) document.getElementById('a-my-time').value = '';
  });
  document.getElementById('a-th-notime').addEventListener('change', e => {
    document.getElementById('a-th-time').disabled = e.target.checked;
    if (e.target.checked) document.getElementById('a-th-time').value = '';
  });

  // 相性計算
  document.getElementById('btn-aisho-calc').addEventListener('click', () => UI.calcAisho());

  // 相性リセット
  document.getElementById('btn-aisho-reset').addEventListener('click', () => {
    document.getElementById('aisho-result-area').classList.add('hidden');
    document.getElementById('aisho-input-area').classList.remove('hidden');
    document.getElementById('ar-score-ring').style.strokeDashoffset = 327;
    window.scrollTo({top:0, behavior:'smooth'});
  });
});
