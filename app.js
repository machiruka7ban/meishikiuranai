/**
 * app.js — 四柱推命 メインロジック
 * =====================================
 * 各エンジンを分離して実装しています。
 * 後から本格化する際は各エンジンだけを修正すればOK。
 *
 * ▼ エンジン一覧
 *   CalendarEngine   — 節入り・干支の日付計算
 *   PillarsEngine    — 年柱・月柱・日柱・時柱の算出
 *   AttributesEngine — 五行・陰陽・蔵干
 *   StarsEngine      — 通変星・十二運
 *   StrengthEngine   — 身強・身弱の簡易判定
 *   FortuneEngine    — 年運・月運・日運
 *   InterpretationEngine — 結果を文章に変換
 */

'use strict';

// =============================================
// CalendarEngine — 節入り・干支の日付計算
// =============================================
const CalendarEngine = {

  /**
   * 月干支の基準となる「節入り日」の概算テーブル（月日のみ）
   * ※本格実装では天文計算が必要。ここでは標準的な概算値を使用。
   * [月, 日] 形式。各月の節入りは年によって±1〜2日ずれる。
   */
  SETSUIRI_TABLE: [
    [2,  4],  // 立春 (寅月開始)
    [3,  6],  // 啓蟄
    [4,  5],  // 清明
    [5,  6],  // 立夏
    [6,  6],  // 芒種
    [7,  7],  // 小暑
    [8,  7],  // 立秋
    [9,  8],  // 白露
    [10, 8],  // 寒露
    [11, 7],  // 立冬
    [12, 7],  // 大雪
    [1,  6],  // 小寒 (翌年1月)
  ],

  /**
   * 指定した年月日が何番目の「月支」に属するかを返す
   * 四柱推命の月柱は「節入り」を基準とする（太陽暦の月ではない！）
   * @returns {number} 0〜11 (寅月=0, 卯月=1, ..., 丑月=11)
   */
  getMonthBranch(year, month, day) {
    const setsu = this.SETSUIRI_TABLE;
    // 節入りより前なら前の月支を使う
    let branchIdx = month - 2; // 2月立春=寅月(idx=2)
    const [sm, sd] = setsu[((month - 2) + 12) % 12]; // その月の節入り
    const nodeMonth = sm === 1 ? 1 : sm; // 1月は翌年処理
    if (month === sm && day < sd) branchIdx -= 1;
    if (month === 1) {
      // 1月の場合：小寒(1/6頃)前は前年の丑月、小寒以降は寅月前
      const [sm0, sd0] = setsu[11]; // 小寒
      if (day < sd0) {
        // 前の月支（丑=11）
        return 11;
      }
      return 11; // 1月は基本的に丑月(11)
    }
    return ((branchIdx % 12) + 12) % 12;
  },

  /**
   * 年干支の計算
   * 四柱推命の年干支は「立春（2月4日頃）」を基準とする。
   * 例：2024年2月3日 → 癸卯年（前年の年干支）
   * @returns {{ kanIdx: number, shiIdx: number }}
   */
  getYearGanZhi(year, month, day) {
    // 立春前は前の年の干支を使う
    let y = year;
    const [sm, sd] = this.SETSUIRI_TABLE[0]; // 立春
    if (month < sm || (month === sm && day < sd)) {
      y -= 1;
    }
    // 西暦年から干支インデックスを算出
    // 1984年 = 甲子年 (干=0, 支=0)
    const kanIdx = ((y - 4) % 10 + 10) % 10;
    const shiIdx = ((y - 4) % 12 + 12) % 12;
    return { kanIdx, shiIdx };
  },

  /**
   * 月干支の計算
   * 月干は年干によって決まる（五虎遁年法）
   * @returns {{ kanIdx: number, shiIdx: number }}
   */
  getMonthGanZhi(yearKanIdx, year, month, day) {
    // 月支のインデックス（寅月=2始まり）
    const branchMap = [2,3,4,5,6,7,8,9,10,11,0,1]; // 月→支インデックス(月1=丑=1, 月2=寅=2...)
    let monthShi;
    const [sm, sd] = this.SETSUIRI_TABLE[((month - 2) + 12) % 12];
    // 節入り前なら前月の支
    let adjustedMonth = month;
    if (day < sd && month === sm) adjustedMonth = ((month - 2 + 12) % 12) + 1;
    monthShi = ((adjustedMonth + 1) % 12); // 1月=丑(1), 2月=寅(2) ...

    // 五虎遁年法：年干から月干の開始値を決める
    // 甲己年→寅月は丙(2)  乙庚年→戊(4)  丙辛年→庚(6)  丁壬年→壬(8)  戊癸年→甲(0)
    const startKan = [2, 4, 6, 8, 0, 2, 4, 6, 8, 0][yearKanIdx];
    // 寅月(2)からのオフセット
    const offset = ((monthShi - 2) + 12) % 12;
    const kanIdx = (startKan + offset) % 10;
    const shiIdx = ((monthShi) % 12 + 12) % 12;
    return { kanIdx, shiIdx };
  },

  /**
   * 日干支の計算（60干支サイクル）
   * 基準日: 2024年1月1日 = 甲子日(0,0)から逆算
   * ※この計算は簡易版です。本格実装ではユリウス日数を使います。
   */
  getDayGanZhi(year, month, day) {
    // 基準日: 1900年1月1日 = 甲戌(0,10)
    const base = new Date(1900, 0, 1);
    const target = new Date(year, month - 1, day);
    const diffDays = Math.round((target - base) / (1000 * 60 * 60 * 24));
    const BASE_KAN = 0; // 甲
    const BASE_SHI = 10; // 戌
    const kanIdx = ((diffDays + BASE_KAN) % 10 + 10) % 10;
    const shiIdx = ((diffDays + BASE_SHI) % 12 + 12) % 12;
    return { kanIdx, shiIdx };
  },

  /**
   * 時柱の干支計算（五鼠遁日法）
   * 日干によって時干の起点が決まる
   */
  getHourGanZhi(dayKanIdx, hour) {
    // 時支インデックス（子=0, 丑=1, ... 亥=11）
    // 23:00-00:59 = 子, 01:00-02:59 = 丑 ...
    const hourBranches = [0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11];
    const shiIdx = hourBranches[hour] ?? 0;

    // 五鼠遁日法：日干から時干の起点を決める
    // 甲己日→子時は甲(0)  乙庚日→丙(2)  丙辛日→戊(4)  丁壬日→庚(6)  戊癸日→壬(8)
    const startKan = [0, 2, 4, 6, 8, 0, 2, 4, 6, 8][dayKanIdx];
    const kanIdx = (startKan + shiIdx) % 10;
    return { kanIdx, shiIdx };
  },
};

// =============================================
// PillarsEngine — 年柱・月柱・日柱・時柱の算出
// =============================================
const PillarsEngine = {
  /**
   * 四柱を一括計算して返す
   * @param {number} year, month, day, hour
   * @returns {{ year, month, day, hour }} 各柱 { kanIdx, shiIdx }
   */
  calculate(year, month, day, hour) {
    const yearPillar  = CalendarEngine.getYearGanZhi(year, month, day);
    const monthPillar = CalendarEngine.getMonthGanZhi(yearPillar.kanIdx, year, month, day);
    const dayPillar   = CalendarEngine.getDayGanZhi(year, month, day);
    const hourPillar  = CalendarEngine.getHourGanZhi(dayPillar.kanIdx, hour);
    return {
      year:  yearPillar,
      month: monthPillar,
      day:   dayPillar,
      hour:  hourPillar,
    };
  },
};

// =============================================
// AttributesEngine — 五行・陰陽・蔵干
// =============================================
const AttributesEngine = {
  /**
   * 四柱全体の五行カウントを集計
   * @param {object} pillars PillarsEngineの戻り値
   * @returns {object} { 木:n, 火:n, 土:n, 金:n, 水:n }
   */
  countGogyou(pillars) {
    const count = { "木":0, "火":0, "土":0, "金":0, "水":0 };
    const allPillars = [pillars.year, pillars.month, pillars.day, pillars.hour];
    allPillars.forEach(p => {
      const kanElem = JIKKAN[p.kanIdx].element;
      const shiElem = JUNISHI[p.shiIdx].element;
      count[kanElem]++;
      count[shiElem]++;
    });
    return count;
  },

  /**
   * 五行バランスのパーセンテージを計算
   */
  getGogyouBalance(count) {
    const total = Object.values(count).reduce((a, b) => a + b, 0);
    const result = {};
    for (const k in count) {
      result[k] = Math.round((count[k] / total) * 100);
    }
    return result;
  },
};

// =============================================
// StarsEngine — 通変星・十二運
// =============================================
const StarsEngine = {
  /**
   * 通変星を計算（日干を自分として、他の干との関係）
   * @param {number} dayKanIdx 日干のインデックス
   * @param {object} pillars 四柱データ
   * @returns {object} { year, month, hour } それぞれの通変星名
   */
  getTsuhensei(dayKanIdx, pillars) {
    return {
      year:  getTsuhensei(dayKanIdx, pillars.year.kanIdx),
      month: getTsuhensei(dayKanIdx, pillars.month.kanIdx),
      hour:  getTsuhensei(dayKanIdx, pillars.hour.kanIdx),
    };
  },

  /**
   * 十二運を計算
   * @param {number} dayKanIdx 日干のインデックス
   * @param {object} pillars 四柱データ
   * @returns {object} { year, month, day, hour } それぞれの十二運
   */
  getJuniun(dayKanIdx, pillars) {
    const tbl = JUNIUN_TABLE[dayKanIdx] || Array(12).fill(0);
    const get = (shiIdx) => JUNIUN[tbl[shiIdx]];
    return {
      year:  get(pillars.year.shiIdx),
      month: get(pillars.month.shiIdx),
      day:   get(pillars.day.shiIdx),
      hour:  get(pillars.hour.shiIdx),
    };
  },
};

// =============================================
// StrengthEngine — 身強・身弱の簡易判定
// =============================================
const StrengthEngine = {
  /**
   * 日干の五行と、月支・時支の五行関係から身強・身弱を簡易判定
   * 本格版では蔵干・大運・流年なども考慮する
   * @returns {{ label, power, desc }}
   */
  judge(dayKanIdx, pillars, gogyouCount) {
    const myElem = JIKKAN[dayKanIdx].element;
    const myCount = gogyouCount[myElem];
    const total = Object.values(gogyouCount).reduce((a,b)=>a+b,0);
    const ratio = myCount / total;

    // 月支との相生・比和チェック
    const monthElem = JUNISHI[pillars.month.shiIdx].element;
    const supportMap = {
      "木": ["水","木"], "火": ["木","火"], "土": ["火","土"],
      "金": ["土","金"], "水": ["金","水"],
    };
    const isSupported = supportMap[myElem]?.includes(monthElem);

    let power = Math.round(ratio * 100);
    if (isSupported) power = Math.min(100, power + 15);

    if (power >= 40) {
      return { label: "身強", power, color: "#4a7c59",
        desc: "日干のエネルギーが強い「身強」です。積極的に行動することで運が開けます。自分のペースで物事を進める力があります。" };
    } else {
      return { label: "身弱", power, color: "#1a6b8a",
        desc: "日干のエネルギーが控えめな「身弱」です。人の助けを借りながら進むことで大きな力になります。感受性が豊かで直感が鋭いのも特徴。" };
    }
  },
};

// =============================================
// FortuneEngine — 年運・月運・日運
// =============================================
const FortuneEngine = {
  /**
   * 今日の日運（今日の干支 + 命式の日柱との相性）
   * @param {object} birthPillars 生年月日の四柱
   * @param {Date} today 今日の日付
   * @returns {object} 日運情報
   */
  getDailyFortune(birthPillars, today) {
    const dayPillar = CalendarEngine.getDayGanZhi(
      today.getFullYear(), today.getMonth() + 1, today.getDate()
    );
    const todayKan = JIKKAN[dayPillar.kanIdx];
    const todayShi = JUNISHI[dayPillar.shiIdx];

    // 今日の五行エネルギー
    const mainElement = todayKan.element;
    const gogyo = GOGYO[mainElement];

    // 今日のステータス計算（簡易版）
    // 日干との相生・相剋で各値が変化
    const dayKanIdx = birthPillars.day.kanIdx;
    const rel = getTsuhensei(dayKanIdx, dayPillar.kanIdx);
    const tsuhenInfo = TSUHENSEI[rel] || TSUHENSEI["比肩"];

    // ステータス値（40-100の範囲）
    const base = 55;
    const statusMap = {
      "比肩": { action: 85, judge: 70, social: 75, money: 60 },
      "劫財": { action: 90, judge: 60, social: 65, money: 55 },
      "食神": { action: 70, judge: 75, social: 80, money: 70 },
      "傷官": { action: 65, judge: 85, social: 60, money: 65 },
      "偏財": { action: 75, judge: 70, social: 85, money: 90 },
      "正財": { action: 60, judge: 80, social: 75, money: 85 },
      "偏官": { action: 80, judge: 65, social: 70, money: 75 },
      "正官": { action: 70, judge: 90, social: 80, money: 75 },
      "偏印": { action: 60, judge: 90, social: 65, money: 60 },
      "印綬": { action: 65, judge: 85, social: 70, money: 65 },
    };
    const status = statusMap[rel] || { action: base, judge: base, social: base, money: base };

    // ミッションとアドバイスをランダム選択（日付ベースで安定した選択）
    const seed = today.getDate() + today.getMonth() * 31;
    const missions = MISSIONS[mainElement] || MISSIONS["土"];
    const avoids = AVOID_ACTIONS[mainElement] || AVOID_ACTIONS["土"];
    const mission = missions[seed % missions.length];
    const avoid1 = avoids[seed % avoids.length];
    const avoid2 = avoids[(seed + 1) % avoids.length];

    // 一言アドバイス
    const advice = this.getAdvice(rel, todayShi.name, mainElement);

    return {
      dayPillar,
      todayKan,
      todayShi,
      mainElement,
      gogyo,
      tsuhensei: rel,
      tsuhenInfo,
      status,
      mission,
      avoids: [avoid1, avoid2],
      advice,
    };
  },

  /**
   * 一言アドバイスを生成
   */
  getAdvice(tsuhensei, shiName, element) {
    const adviceMap = {
      "比肩": `今日は自分軸で動く日。${shiName}の力を借りて、一歩踏み出してください。`,
      "劫財": `競争心が高まる日。エネルギーをポジティブな方向へ向けましょう。`,
      "食神": `あなたの才能が輝く日。${element}のエネルギーで楽しみながら動くと◎`,
      "傷官": `鋭い感性が冴える日。創造的な作業や表現活動に最適です。`,
      "偏財": `行動がお金を引き寄せる日。動けば動くほど財運が高まります。`,
      "正財": `堅実な積み重ねが報われる日。コツコツが今日の正解です。`,
      "偏官": `強いエネルギーが流れる日。集中力を高めて難題に挑みましょう。`,
      "正官": `信頼と誠実さが評価される日。約束は必ず守ることが大切。`,
      "偏印": `直感力が冴える日。第一印象を大切にすると好結果が出ます。`,
      "印綬": `学びと成長の日。インプットした知識がすぐに活きてきます。`,
    };
    return adviceMap[tsuhensei] || `今日も${element}のエネルギーとともに、着実に進みましょう。`;
  },
};

// =============================================
// InterpretationEngine — 結果を文章に変換
// =============================================
const InterpretationEngine = {
  /**
   * 命式全体の総合解釈文を生成
   */
  summarize(pillars, strength, gogyouBalance) {
    const dayKan = JIKKAN[pillars.day.kanIdx];
    const dayShi = JUNISHI[pillars.day.shiIdx];
    const dominantElem = Object.entries(gogyouBalance).sort((a,b) => b[1]-a[1])[0][0];
    const weakElem = Object.entries(gogyouBalance).sort((a,b) => a[1]-b[1])[0][0];

    return `あなたの日干は「${dayKan.name}（${dayKan.reading}）」。${dayKan.desc}` +
      `日支は「${dayShi.name}（${dayShi.reading}）」で、${dayShi.desc}` +
      `五行バランスでは「${dominantElem}」が最も強く、${GOGYO[dominantElem].desc}の性質が際立っています。` +
      `「${weakElem}」はやや少なめなので、意識的に${GOGYO[weakElem].keywords.slice(0,2).join('・')}を取り入れると好バランスになります。`;
  },
};

// =============================================
// AppController — UIとロジックをつなぐ制御層
// =============================================
const AppController = {
  userData: null,
  pillars: null,
  fortune: null,

  /**
   * メイン処理：フォーム送信時に呼ばれる
   */
  calculate() {
    // 入力値を取得
    const name  = document.getElementById('input-name').value.trim() || 'あなた';
    const dateVal = document.getElementById('input-date').value;
    const timeVal = document.getElementById('input-time').value;

    if (!dateVal) {
      alert('生年月日を入力してください');
      return;
    }

    const [year, month, day] = dateVal.split('-').map(Number);
    const hour = timeVal ? parseInt(timeVal.split(':')[0]) : 12; // 未入力は正午

    // 各エンジンで計算
    this.pillars = PillarsEngine.calculate(year, month, day, hour);
    const gogyouCount   = AttributesEngine.countGogyou(this.pillars);
    const gogyouBalance = AttributesEngine.getGogyouBalance(gogyouCount);
    const strength      = StrengthEngine.judge(this.pillars.day.kanIdx, this.pillars, gogyouCount);
    const tsuhensei     = StarsEngine.getTsuhensei(this.pillars.day.kanIdx, this.pillars);
    const juniun        = StarsEngine.getJuniun(this.pillars.day.kanIdx, this.pillars);
    const summary       = InterpretationEngine.summarize(this.pillars, strength, gogyouBalance);
    this.fortune        = FortuneEngine.getDailyFortune(this.pillars, new Date());

    this.userData = { name, year, month, day, hour };

    // 画面に表示
    UIRenderer.render({
      name, pillars: this.pillars,
      gogyouCount, gogyouBalance,
      strength, tsuhensei, juniun,
      summary, fortune: this.fortune,
    });
  },
};

// =============================================
// UIRenderer — 画面描画担当
// =============================================
const UIRenderer = {
  render(data) {
    // 入力セクションを隠して結果を表示
    document.getElementById('section-input').classList.add('hidden');
    document.getElementById('section-result').classList.remove('hidden');
    document.getElementById('section-result').classList.add('fade-in');

    this.renderHeader(data);
    this.renderPillars(data);
    this.renderGogyou(data);
    this.renderStars(data);
    this.renderStrength(data);
    this.renderFortune(data);
    this.renderMission(data);

    // スクロールをトップへ
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  renderHeader(data) {
    document.getElementById('result-name').textContent = data.name + ' さんの命式';
    const dayKan = JIKKAN[data.pillars.day.kanIdx];
    document.getElementById('result-subtitle').textContent =
      `日干：${dayKan.name}（${dayKan.reading}） ／ ${data.strength.label}`;
  },

  renderPillars(data) {
    const pillars = data.pillars;
    const labels = ['year','month','day','hour'];
    const jpLabels = ['年柱','月柱','日柱','時柱'];
    const container = document.getElementById('pillars-grid');
    container.innerHTML = '';

    labels.forEach((key, i) => {
      const p = pillars[key];
      const kan = JIKKAN[p.kanIdx];
      const shi = JUNISHI[p.shiIdx];
      const div = document.createElement('div');
      div.className = 'pillar-card';
      div.innerHTML = `
        <div class="pillar-label">${jpLabels[i]}</div>
        <div class="pillar-kanji">
          <span class="pillar-kan" style="color:${GOGYO[kan.element].color}">${kan.name}</span>
          <span class="pillar-shi" style="color:${GOGYO[shi.element].color}">${shi.name}</span>
        </div>
        <div class="pillar-reading">${kan.reading} / ${shi.reading}</div>
        <div class="pillar-elem">
          <span class="badge" style="background:${GOGYO[kan.element].color}20;color:${GOGYO[kan.element].color}">${kan.element}・${kan.yin_yang}</span>
          <span class="badge" style="background:${GOGYO[shi.element].color}20;color:${GOGYO[shi.element].color}">${shi.element}・${shi.yin_yang}</span>
        </div>
      `;
      container.appendChild(div);
    });
  },

  renderGogyou(data) {
    const balance = data.gogyouBalance;
    const container = document.getElementById('gogyou-bars');
    container.innerHTML = '';
    const order = ["木","火","土","金","水"];
    order.forEach(elem => {
      const pct = balance[elem] || 0;
      const g = GOGYO[elem];
      container.innerHTML += `
        <div class="gogyou-row">
          <div class="gogyou-label">
            <span class="gogyou-emoji">${g.emoji}</span>
            <span class="gogyou-name">${elem}</span>
            <span class="gogyou-sub">${g.desc}</span>
          </div>
          <div class="gogyou-bar-wrap">
            <div class="gogyou-bar" style="width:${pct}%;background:${g.color}"></div>
          </div>
          <span class="gogyou-pct">${pct}%</span>
        </div>
      `;
    });
  },

  renderStars(data) {
    const container = document.getElementById('stars-grid');
    container.innerHTML = '';
    const entries = [
      { label: '年柱', ts: data.tsuhensei.year, ju: data.juniun.year },
      { label: '月柱', ts: data.tsuhensei.month, ju: data.juniun.month },
      { label: '日柱', ts: '（日主）', ju: data.juniun.day },
      { label: '時柱', ts: data.tsuhensei.hour, ju: data.juniun.hour },
    ];
    entries.forEach(e => {
      const tsInfo = e.ts !== '（日主）' ? TSUHENSEI[e.ts] : null;
      const div = document.createElement('div');
      div.className = 'star-card';
      div.innerHTML = `
        <div class="star-pillar-label">${e.label}</div>
        <div class="star-tsuhen">
          ${tsInfo
            ? `<span class="star-name" style="color:${tsInfo.color}">${e.ts}</span><span class="star-short">${tsInfo.short}</span>`
            : `<span class="star-self">日主</span>`}
        </div>
        <div class="star-juniun">
          <span class="juniun-name">${e.ju.name}</span>
          <div class="juniun-bar-wrap">
            <div class="juniun-bar" style="width:${e.ju.power}%"></div>
          </div>
        </div>
      `;
      container.appendChild(div);
    });
  },

  renderStrength(data) {
    const s = data.strength;
    document.getElementById('strength-label').textContent = s.label;
    document.getElementById('strength-label').style.color = s.color;
    document.getElementById('strength-bar').style.width = s.power + '%';
    document.getElementById('strength-bar').style.background = s.color;
    document.getElementById('strength-desc').textContent = s.desc;
  },

  renderFortune(data) {
    const f = data.fortune;
    const today = new Date();
    const dateStr = `${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日`;

    document.getElementById('fortune-date').textContent = dateStr + ' の日運';
    document.getElementById('fortune-kan').textContent = f.todayKan.name;
    document.getElementById('fortune-kan').style.color = GOGYO[f.mainElement].color;
    document.getElementById('fortune-shi').textContent = f.todayShi.name;
    document.getElementById('fortune-shi').style.color = GOGYO[f.todayShi.element].color;
    document.getElementById('fortune-elem').textContent = `本日の主五行：${f.mainElement} ${f.gogyo.emoji}`;
    document.getElementById('fortune-tsuhen').textContent = `今日の通変星：${f.tsuhensei}（${f.tsuhenInfo?.short || ''}）`;

    // ステータスゲージ
    const statContainer = document.getElementById('status-gauges');
    statContainer.innerHTML = '';
    const stats = [
      { label: '⚡ 行動力', value: f.status.action },
      { label: '🧠 判断力', value: f.status.judge },
      { label: '🤝 対人運', value: f.status.social },
      { label: '💰 金運',   value: f.status.money },
    ];
    stats.forEach(st => {
      const level = st.value >= 80 ? 'high' : st.value >= 60 ? 'mid' : 'low';
      statContainer.innerHTML += `
        <div class="stat-row">
          <div class="stat-label">${st.label}</div>
          <div class="stat-bar-wrap">
            <div class="stat-bar stat-${level}" style="width:${st.value}%"></div>
          </div>
          <span class="stat-value">${st.value}</span>
        </div>
      `;
    });

    document.getElementById('fortune-advice').textContent = f.advice;
  },

  renderMission(data) {
    const f = data.fortune;
    document.getElementById('mission-text').textContent = f.mission;
    document.getElementById('avoid-list').innerHTML = f.avoids
      .map(a => `<li>✗ ${a}</li>`).join('');
  },
};

// =============================================
// イベントリスナー設定
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  // 計算ボタン
  document.getElementById('btn-calculate').addEventListener('click', () => {
    AppController.calculate();
  });

  // 入力し直すボタン
  document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('section-input').classList.remove('hidden');
    document.getElementById('section-result').classList.add('hidden');
  });

  // プレミアムボタン
  document.getElementById('btn-premium').addEventListener('click', () => {
    document.getElementById('premium-modal').classList.remove('hidden');
  });
  document.getElementById('modal-close').addEventListener('click', () => {
    document.getElementById('premium-modal').classList.add('hidden');
  });
  document.getElementById('premium-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('premium-modal')) {
      document.getElementById('premium-modal').classList.add('hidden');
    }
  });

  // 今日の日付を入力欄のデフォルトに
  const today = new Date();
  // デフォルト生年月日は空のまま（ユーザーが入力）
  // 今日の年-30歳をデフォルトにする例
  // document.getElementById('input-date').value = `${today.getFullYear()-30}-01-01`;
});
