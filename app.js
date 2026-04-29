/**
 * app.js v3 — 命式占 UIロジック
 * ================================
 * 計算エンジンはv2（data.js）をそのまま使用。
 * UIRenderer を全面刷新。
 * 追加機能：
 *   - 星空アニメーション（Canvas）
 *   - 結果画面のヒーローレイアウト
 *   - 展開可能な詳細セクション（命式・大運）
 *   - ボトムシート型モーダル
 */

'use strict';

// =============================================
// StarField — 背景の星アニメーション
// =============================================
const StarField = {
  canvas: null,
  ctx: null,
  stars: [],
  animId: null,

  init() {
    this.canvas = document.getElementById('stars-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    this.createStars(120);
    this.animate();
    window.addEventListener('resize', () => this.resize());
  },

  resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  createStars(count) {
    this.stars = Array.from({ length: count }, () => ({
      x:       Math.random() * window.innerWidth,
      y:       Math.random() * window.innerHeight,
      r:       Math.random() * 1.2 + 0.2,
      opacity: Math.random() * 0.7 + 0.1,
      speed:   Math.random() * 0.003 + 0.001,
      phase:   Math.random() * Math.PI * 2,
    }));
  },

  animate() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const now = Date.now() * 0.001;
    this.stars.forEach(s => {
      const pulse = Math.sin(now * s.speed * 60 + s.phase) * 0.35 + 0.65;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240, 220, 160, ${s.opacity * pulse})`;
      ctx.fill();
    });
    this.animId = requestAnimationFrame(() => this.animate());
  },
};

// =============================================
// CalendarEngine（v2継承）
// =============================================
const CalendarEngine = {
  SETSUIRI_OFFSETS: [
    { month:2,  day:4,  shiIdx:2  },
    { month:3,  day:6,  shiIdx:3  },
    { month:4,  day:5,  shiIdx:4  },
    { month:5,  day:6,  shiIdx:5  },
    { month:6,  day:6,  shiIdx:6  },
    { month:7,  day:7,  shiIdx:7  },
    { month:8,  day:7,  shiIdx:8  },
    { month:9,  day:8,  shiIdx:9  },
    { month:10, day:8,  shiIdx:10 },
    { month:11, day:7,  shiIdx:11 },
    { month:12, day:7,  shiIdx:0  },
    { month:1,  day:6,  shiIdx:1  },
  ],
  getRisshunDay(year) { return RISSHUN_DAYS[year] || 4; },
  getYearGanZhi(year, month, day) {
    let y = year;
    if (month < 2 || (month === 2 && day < this.getRisshunDay(year))) y--;
    return { kanIdx: ((y-4)%10+10)%10, shiIdx: ((y-4)%12+12)%12 };
  },
  getMonthShiIdx(year, month, day) {
    const corr = this.getRisshunDay(year) - 4;
    for (let i = 0; i < this.SETSUIRI_OFFSETS.length; i++) {
      const s = this.SETSUIRI_OFFSETS[i];
      if (s.month === month) {
        return day >= s.day + corr
          ? s.shiIdx
          : this.SETSUIRI_OFFSETS[(i-1+12)%12].shiIdx;
      }
    }
    return 2;
  },
  getMonthGanZhi(yearKanIdx, year, month, day) {
    const shiIdx = this.getMonthShiIdx(year, month, day);
    const startKan = [2,4,6,8,0,2,4,6,8,0][yearKanIdx];
    const offset = ((shiIdx-2)+12)%12;
    return { kanIdx: (startKan+offset)%10, shiIdx };
  },
  getDayGanZhi(year, month, day) {
    const diff = Math.round((new Date(year,month-1,day) - new Date(1900,0,1)) / 86400000);
    return { kanIdx: ((diff)%10+10)%10, shiIdx: ((diff+10)%12+12)%12 };
  },
  getHourGanZhi(dayKanIdx, hour) {
    const shi = [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11][hour]??0;
    return { kanIdx: ([0,2,4,6,8,0,2,4,6,8][dayKanIdx]+shi)%10, shiIdx: shi };
  },
};

const PillarsEngine = {
  calculate(year, month, day, hour) {
    const y = CalendarEngine.getYearGanZhi(year, month, day);
    const m = CalendarEngine.getMonthGanZhi(y.kanIdx, year, month, day);
    const d = CalendarEngine.getDayGanZhi(year, month, day);
    const h = CalendarEngine.getHourGanZhi(d.kanIdx, hour);
    return { year:y, month:m, day:d, hour:h };
  },
};

const AttributesEngine = {
  countGogyou(pillars) {
    const count = {"木":0,"火":0,"土":0,"金":0,"水":0};
    [pillars.year,pillars.month,pillars.day,pillars.hour].forEach(p => {
      count[JIKKAN[p.kanIdx].element] += 2;
      const z = ZOKAN[JUNISHI[p.shiIdx].name];
      if (z) {
        if (z.honki  !== null) count[JIKKAN[z.honki].element]  += 3;
        if (z.chuuki !== null) count[JIKKAN[z.chuuki].element] += 2;
        if (z.yoki   !== null) count[JIKKAN[z.yoki].element]   += 1;
      }
    });
    return count;
  },
  getGogyouBalance(count) {
    const total = Object.values(count).reduce((a,b)=>a+b,0);
    const r = {};
    for (const k in count) r[k] = Math.round(count[k]/total*100);
    return r;
  },
  getMonthRei(dayKanIdx, monthShiIdx) {
    const z = ZOKAN[JUNISHI[monthShiIdx].name];
    return z?.honki != null ? getTsuhensei(dayKanIdx, z.honki) : null;
  },
};

const StarsEngine = {
  getTsuhensei(dk, pillars) {
    return { year:getTsuhensei(dk,pillars.year.kanIdx), month:getTsuhensei(dk,pillars.month.kanIdx), hour:getTsuhensei(dk,pillars.hour.kanIdx) };
  },
  getJuniun(dk, pillars) {
    const t=JUNIUN_TABLE[dk]||Array(12).fill(0);
    return { year:JUNIUN[t[pillars.year.shiIdx]], month:JUNIUN[t[pillars.month.shiIdx]], day:JUNIUN[t[pillars.day.shiIdx]], hour:JUNIUN[t[pillars.hour.shiIdx]] };
  },
  getZokanTs(dk, pillars) {
    const r={};
    ['year','month','day','hour'].forEach(k=>{
      const z=ZOKAN[JUNISHI[pillars[k].shiIdx].name];
      if(z) r[k]={ honki:z.honki!=null?getTsuhensei(dk,z.honki):null, chuuki:z.chuuki!=null?getTsuhensei(dk,z.chuuki):null };
    });
    return r;
  },
};

const StrengthEngine = {
  judge(dk, pillars, gogyouCount) {
    let score = 0;
    const mr = AttributesEngine.getMonthRei(dk, pillars.month.shiIdx);
    const strong = ["比肩","劫財","印綬","偏印"];
    score += (mr && strong.includes(mr)) ? 30 : -20;
    [getTsuhensei(dk,pillars.year.kanIdx),getTsuhensei(dk,pillars.month.kanIdx),getTsuhensei(dk,pillars.hour.kanIdx)]
      .forEach(ts => { score += strong.includes(ts) ? 10 : -5; });
    const myElem = JIKKAN[dk].element;
    const sup = {"木":["水","木"],"火":["木","火"],"土":["火","土"],"金":["土","金"],"水":["金","水"]}[myElem]||[];
    const total = Object.values(gogyouCount).reduce((a,b)=>a+b,0);
    const supR = sup.reduce((a,e)=>a+(gogyouCount[e]||0),0)/total;
    score += Math.round((supR-0.4)*50);
    const power = Math.min(100,Math.max(0,50+score));
    return score>=0
      ? { label:"身強", power, color:"#5ba87a", desc:"日干のエネルギーが強い「身強」です。月令を味方につけており、積極的に行動することで運が開けます。" }
      : { label:"身弱", power, color:"#4a7eb8", desc:"日干のエネルギーが控えめな「身弱」です。人の助けや環境の力を借りながら進むことで大きな力になります。" };
  },
};

const DaiunEngine = {
  calculate(birthYear, birthMonth, birthDay, gender, pillars) {
    const yy = JIKKAN[pillars.year.kanIdx].yin_yang;
    const isJunko = (yy==="陽"&&gender==="男")||(yy==="陰"&&gender==="女");
    const startAge = this.calcStartAge(birthYear, birthMonth, birthDay, isJunko);
    let k=pillars.month.kanIdx, s=pillars.month.shiIdx;
    const list = [];
    for(let i=0;i<8;i++){
      k=isJunko?(k+1)%10:((k-1)+10)%10;
      s=isJunko?(s+1)%12:((s-1)+12)%12;
      const age=startAge+i*10;
      const ts=getTsuhensei(pillars.day.kanIdx,k);
      list.push({ age, endAge:age+9, kan:JIKKAN[k], shi:JUNISHI[s], tsuhen:ts,
        juniun:JUNIUN[JUNIUN_TABLE[pillars.day.kanIdx]?.[s]??0],
        interp:DAIUNN_INTERPRETATIONS[ts]||"" });
    }
    return { startAge, isJunko, list };
  },
  calcStartAge(year, month, day, isJunko) {
    const base = [6,4,6,5,6,6,7,7,8,8,7,7];
    const corr = (RISSHUN_DAYS[year]||4)-4;
    let days=0, m=month, d=day, y=year;
    for(let i=0;i<60;i++){
      isJunko ? d++ : d--;
      days++;
      if(isJunko){
        const dim=new Date(y,m,0).getDate();
        if(d>dim){d=1;m++;if(m>12){m=1;y++;}}
        if(d===base[m-1]+corr) break;
      } else {
        if(d<1){m--;if(m<1){m=12;y--;}d=new Date(y,m,0).getDate();}
        if(d===base[m-1]+corr) break;
      }
    }
    return Math.max(1,Math.round(days/3));
  },
};

const FortuneEngine = {
  getDailyFortune(birthPillars, today) {
    const dp = CalendarEngine.getDayGanZhi(today.getFullYear(), today.getMonth()+1, today.getDate());
    const rel = getTsuhensei(birthPillars.day.kanIdx, dp.kanIdx);
    const mainElem = JIKKAN[dp.kanIdx].element;
    const statusMap = {
      "比肩":{action:85,judge:70,social:75,money:60},
      "劫財":{action:90,judge:60,social:65,money:55},
      "食神":{action:70,judge:75,social:80,money:70},
      "傷官":{action:65,judge:85,social:60,money:65},
      "偏財":{action:75,judge:70,social:85,money:90},
      "正財":{action:60,judge:80,social:75,money:85},
      "偏官":{action:80,judge:65,social:70,money:75},
      "正官":{action:70,judge:90,social:80,money:75},
      "偏印":{action:60,judge:90,social:65,money:60},
      "印綬":{action:65,judge:85,social:70,money:65},
    };
    const status = statusMap[rel]||{action:55,judge:55,social:55,money:55};
    const seed = today.getDate()+today.getMonth()*31;
    const ms = MISSIONS[mainElem]||MISSIONS["土"];
    const av = AVOID_ACTIONS[mainElem]||AVOID_ACTIONS["土"];
    return {
      dayPillar:dp,
      todayKan:JIKKAN[dp.kanIdx],
      todayShi:JUNISHI[dp.shiIdx],
      mainElement:mainElem,
      gogyo:GOGYO[mainElem],
      tsuhensei:rel,
      status, mission:ms[seed%ms.length],
      avoids:[av[seed%av.length],av[(seed+1)%av.length]],
      advice:this.getAdvice(rel, JUNISHI[dp.shiIdx].name, mainElem),
    };
  },
  getAdvice(ts, shiName, elem) {
    const m={
      "比肩":`今日は自分軸で動く日。${shiName}の力を借りて一歩踏み出して。`,
      "劫財":"競争心が高まる日。エネルギーをポジティブな方向へ。",
      "食神":`才能が輝く日。${elem}のエネルギーで楽しみながら動くと◎`,
      "傷官":"鋭い感性が冴える日。創造的な作業に最適。",
      "偏財":"行動がお金を引き寄せる日。動けば動くほど財運が高まる。",
      "正財":"堅実な積み重ねが報われる日。コツコツが今日の正解。",
      "偏官":"強いエネルギーが流れる日。集中して難題に挑もう。",
      "正官":"信頼と誠実さが評価される日。約束を守ることが大切。",
      "偏印":"直感力が冴える日。第一印象を大切にすると好結果。",
      "印綬":"学びと成長の日。インプットした知識がすぐに活きる。",
    };
    return m[ts]||`今日も${elem}のエネルギーとともに着実に進もう。`;
  },
};

// =============================================
// テーマ生成（今日の「一言テーマ」）
// =============================================
function getTodayTheme(fortune, strength) {
  const elem = fortune.mainElement;
  const ts   = fortune.tsuhensei;
  const themeMap = {
    "木": { theme: "育てる日", emoji: "🌿", sub: `今日は${elem}の力が満ちる日` },
    "火": { theme: "輝く日",   emoji: "🔥", sub: `今日は${elem}の情熱が高まる日` },
    "土": { theme: "整える日", emoji: "🏔️", sub: `今日は${elem}の安定が流れる日` },
    "金": { theme: "磨く日",   emoji: "⚔️", sub: `今日は${elem}の決断力が冴える日` },
    "水": { theme: "流れる日", emoji: "💧", sub: `今日は${elem}の知恵が深まる日` },
  };
  // 通変星による補正
  const tsThemes = {
    "食神":"楽しむ日","傷官":"表現する日","偏財":"動く日","正財":"積む日",
    "偏官":"挑む日","正官":"誠実な日","偏印":"感じる日","印綬":"学ぶ日",
    "比肩":"自分を生きる日","劫財":"勝負の日",
  };
  const base = themeMap[elem] || { theme:"今日も進む日", emoji:"✨", sub:"今日も命式の力を活かして" };
  if (tsThemes[ts]) base.theme = tsThemes[ts];
  return base;
}

// =============================================
// AppController
// =============================================
const AppController = {
  userData: null,
  pillars: null,
  fortune: null,
  daiunData: null,

  calculate() {
    const name   = document.getElementById('input-name').value.trim() || 'あなた';
    const dv     = document.getElementById('input-date').value;
    const tv     = document.getElementById('input-time').value;
    const gender = document.getElementById('input-gender').value;
    if (!dv) { alert('生年月日を入力してください'); return; }
    const [year,month,day] = dv.split('-').map(Number);
    const hour = tv ? parseInt(tv.split(':')[0]) : 12;

    this.pillars     = PillarsEngine.calculate(year,month,day,hour);
    const gc         = AttributesEngine.countGogyou(this.pillars);
    const gb         = AttributesEngine.getGogyouBalance(gc);
    const strength   = StrengthEngine.judge(this.pillars.day.kanIdx, this.pillars, gc);
    const tsuhensei  = StarsEngine.getTsuhensei(this.pillars.day.kanIdx, this.pillars);
    const zokanTs    = StarsEngine.getZokanTs(this.pillars.day.kanIdx, this.pillars);
    const juniun     = StarsEngine.getJuniun(this.pillars.day.kanIdx, this.pillars);
    this.fortune     = FortuneEngine.getDailyFortune(this.pillars, new Date());
    this.daiunData   = DaiunEngine.calculate(year,month,day,gender,this.pillars);
    this.userData    = {name,year,month,day,hour,gender};

    UIRenderer.render({
      name, pillars:this.pillars,
      gogyouCount:gc, gogyouBalance:gb,
      strength, tsuhensei, zokanTs, juniun,
      fortune:this.fortune,
      daiunData:this.daiunData, birthYear:year,
    });
  },
};

// =============================================
// UIRenderer v3 — 全面刷新
// =============================================
const UIRenderer = {
  render(data) {
    document.getElementById('section-input').classList.add('hidden');
    const rs = document.getElementById('section-result');
    rs.classList.remove('hidden');
    rs.classList.add('fade-in');

    this.renderHero(data);
    this.renderStatusGrid(data);
    this.renderMission(data);
    this.renderPillarsDetail(data);
    this.renderDaiunDetail(data);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // ① ヒーローエリア（今日のテーマ・干支）
  renderHero(data) {
    const f = data.fortune;
    const theme = getTodayTheme(f, data.strength);
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日（${['日','月','火','水','木','金','土'][today.getDay()]}）`;

    document.getElementById('today-date').textContent = dateStr;
    document.getElementById('today-theme').innerHTML =
      theme.theme + `<span class="today-theme-emoji">${theme.emoji}</span>`;
    document.getElementById('today-sub').textContent = theme.sub;

    // 干支バッジ
    document.getElementById('fortune-kan-hero').textContent = f.todayKan.name;
    document.getElementById('fortune-kan-hero').style.color = GOGYO[f.mainElement].color;
    document.getElementById('fortune-shi-hero').textContent = f.todayShi.name;
    document.getElementById('fortune-shi-hero').style.color = GOGYO[f.todayShi.element].color;
    document.getElementById('fortune-tsuhen-hero').textContent = f.tsuhensei;

    // ユーザー名（サブタイトルに）
    document.getElementById('result-user').textContent = data.name + ' さん';

    // 身強・身弱バッジ
    const sb = document.getElementById('strength-badge');
    sb.className = `strength-badge ${data.strength.label === '身強' ? 'strength-badge-strong' : 'strength-badge-weak'}`;
    sb.innerHTML = `<span class="strength-badge-dot"></span>${data.strength.label}：${data.strength.desc.slice(0,20)}…`;
  },

  // ② ステータスカードグリッド
  renderStatusGrid(data) {
    const s = data.fortune.status;
    const stats = [
      { icon:'⚡', name:'行動力', value:s.action },
      { icon:'🧠', name:'判断力', value:s.judge  },
      { icon:'🤝', name:'対人運', value:s.social },
      { icon:'💰', name:'金運',   value:s.money  },
    ];
    const container = document.getElementById('status-grid');
    container.innerHTML = '';
    stats.forEach((st, i) => {
      const cls = st.value >= 80 ? 'high' : st.value >= 60 ? 'mid' : 'low';
      const card = document.createElement('div');
      card.className = 'status-card';
      card.style.animationDelay = `${0.15 + i*0.1}s`;
      card.innerHTML = `
        <span class="status-icon">${st.icon}</span>
        <div class="status-name">${st.name}</div>
        <div class="status-value val-${cls}">${st.value}</div>
        <div class="status-gauge">
          <div class="status-gauge-fill fill-${cls}" style="width:0%" data-target="${st.value}"></div>
        </div>`;
      container.appendChild(card);
    });
    // ゲージアニメーション（少し遅らせて）
    setTimeout(() => {
      document.querySelectorAll('.status-gauge-fill').forEach(el => {
        el.style.width = el.dataset.target + '%';
      });
    }, 300);
  },

  // ③ ミッション・アドバイス
  renderMission(data) {
    const f = data.fortune;
    document.getElementById('mission-text').textContent = f.mission;
    document.getElementById('advice-text').textContent = f.advice;
    const avoidList = document.getElementById('avoid-list');
    avoidList.innerHTML = f.avoids.map(a => `<li>${a}</li>`).join('');
  },

  // ④ 命式詳細（展開セクション内）
  renderPillarsDetail(data) {
    const container = document.getElementById('pillars-compact');
    container.innerHTML = '';
    const labels = ['年','月','日','時'];
    ['year','month','day','hour'].forEach((key, i) => {
      const p = data.pillars[key];
      const kan = JIKKAN[p.kanIdx];
      const shi = JUNISHI[p.shiIdx];
      const z = ZOKAN[shi.name];
      let zokanStr = '';
      if (z) {
        const parts = [];
        if (z.honki  != null) parts.push(JIKKAN[z.honki].name);
        if (z.chuuki != null) parts.push(JIKKAN[z.chuuki].name);
        if (z.yoki   != null) parts.push(JIKKAN[z.yoki].name);
        zokanStr = parts.join(' ');
      }
      const div = document.createElement('div');
      div.className = 'pillar-mini';
      div.innerHTML = `
        <div class="pillar-mini-label">${labels[i]}柱</div>
        <span class="pillar-mini-kan" style="color:${GOGYO[kan.element].color}">${kan.name}</span>
        <span class="pillar-mini-shi" style="color:${GOGYO[shi.element].color}">${shi.name}</span>
        <div class="pillar-mini-zokan">${zokanStr}</div>`;
      container.appendChild(div);
    });

    // 五行バー
    const gb = data.gogyouBalance;
    const gbContainer = document.getElementById('gogyou-compact');
    gbContainer.innerHTML = '';
    ["木","火","土","金","水"].forEach(elem => {
      const pct = gb[elem] || 0;
      const g = GOGYO[elem];
      gbContainer.innerHTML += `
        <div class="gogyou-compact-row">
          <span class="gogyou-compact-name" style="color:${g.color}">${elem}</span>
          <div class="gogyou-compact-bar">
            <div class="gogyou-compact-fill" style="width:${pct}%;background:${g.color}"></div>
          </div>
          <span class="gogyou-compact-pct">${pct}%</span>
        </div>`;
    });

    // 身強・身弱（詳細テキスト）
    document.getElementById('strength-detail').textContent = data.strength.desc;
  },

  // ⑤ 大運詳細（展開セクション内）
  renderDaiunDetail(data) {
    const d = data.daiunData;
    const currentAge = new Date().getFullYear() - data.birthYear;
    document.getElementById('daiun-startage-detail').textContent =
      `起運 ${d.startAge}歳 ／ ${d.isJunko ? '順行' : '逆行'}`;

    const container = document.getElementById('daiun-compact');
    container.innerHTML = '';
    d.list.forEach(run => {
      const isCurrent = currentAge >= run.age && currentAge <= run.endAge;
      const ti = TSUHENSEI[run.tsuhen] || {};
      const div = document.createElement('div');
      div.className = `daiun-compact-item${isCurrent ? ' current' : ''}`;
      div.innerHTML = `
        <span class="daiun-compact-age">${run.age}〜${run.endAge}歳</span>
        <span class="daiun-compact-kanshi">
          <span style="color:${GOGYO[run.kan.element].color}">${run.kan.name}</span><span style="color:${GOGYO[run.shi.element].color}">${run.shi.name}</span>
        </span>
        <span class="daiun-compact-tsuhen" style="color:${ti.color||'#c9a84c'}">${run.tsuhen}</span>
        ${isCurrent ? '<span class="daiun-compact-now">▶ 現在</span>' : ''}`;
      div.title = run.interp;
      container.appendChild(div);
    });
  },
};

// =============================================
// イベントリスナー
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // 星空初期化
  StarField.init();

  // 計算ボタン
  document.getElementById('btn-calculate').addEventListener('click', () => {
    AppController.calculate();
  });

  // 入力に戻る
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('section-result').classList.add('hidden');
    document.getElementById('section-input').classList.remove('hidden');
  });

  // プレミアムボタン
  document.querySelectorAll('.btn-premium-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('premium-modal').classList.remove('hidden');
    });
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('premium-modal').classList.add('hidden');
  });
  document.getElementById('premium-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('premium-modal')) {
      document.getElementById('premium-modal').classList.add('hidden');
    }
  });

  // 展開トグル
  document.querySelectorAll('.expand-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const content = btn.nextElementSibling;
      const isOpen = content.classList.contains('open');
      btn.classList.toggle('open', !isOpen);
      content.classList.toggle('open', !isOpen);
    });
  });
});
