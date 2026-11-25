/**
 * ============================================================================
 * 街友本色 II - 公園C位爭奪戰：遊戲資料
 * ============================================================================
 * 玩法（跟一代同一套手感）：壓住＝攤開佔位（囂張值上升）、放開＝縮起來裝無辜（囂張值下降）
 * - 驅離線（紅）：囂張值碰到就被趕走（＝一代的燙傷）。平常在 100，巡守員手電筒照過來時往下降。
 * - 擠位線（藍）：囂張值掉到線下太久，位子就被別人坐走（＝一代的菸癮發作）。有人來搶位時往上升。
 * - 理直氣壯區（金）：貼在驅離線下方，停在裡面分數最高（＝一代的黃金過癮區），會跟著驅離線一起移動。
 * 60 秒 = 一整晚（18:00 → 06:00），每 5 秒過一小時。
 * 誰會出現、什麼時候出現、一次來幾個人全部用抽籤（見 buildNightEvents、RIVAL_ODDS），每一晚都不一樣；
 * 只是不同時段比較常遇到不同的人（例如廣場舞阿姨多半在傍晚、太極團只會在 04:00 以後）。
 */

const NIGHT = { seconds: 60, startHour: 18, hours: 12 };
const SEC_PER_HOUR = NIGHT.seconds / NIGHT.hours;

/**
 * 過夜位子（越好的位子難度越高；名字諧音飯店，一代是諧音菸牌）
 * spreadRate / shrinkRate：壓住時囂張值每秒上升、放開時每秒下降多少
 * zoneWidth：理直氣壯區寬度（倍率越高越窄）
 * patrolCeil：巡邏時驅離線降到哪裡；rivalFloor：有人來搶位時擠位線升到哪裡；dawnFloor：晨運太極團來搶位時擠位線升到哪裡（比一般人兇）
 * eventGap：事件之間的平均空檔（秒，每次隨機 0.4 ~ 1.5 倍）；patrolBias：每次來的是巡邏的人的機率；pincerChance：巡邏和搶位同時來（夾擊）的機率
 * mapPos：公園地圖（img2）上那張長椅的位置（540x960 遊戲座標）
 */
const PARK_SPOTS = [
    {
        id: 'wen_hua',
        name: '蚊華東方',
        subtitle: '涼亭外的破長椅，蚊子吃到飽',
        stars: '★☆☆☆☆',
        difficultyLabel: '簡單',
        badgeColor: '#2ecc71',
        spreadRate: 30,
        shrinkRate: 40,
        zoneWidth: 40,
        scoreMultiplier: 1.0,
        evictPenalty: 120,
        squeezePenalty: 80,
        patrolCeil: 62,
        rivalFloor: 38,
        dawnFloor: 50,
        eventGap: 4.2,
        patrolBias: 0.45,
        pincerChance: 0,
        mapPos: { x: 118, y: 292 },
        prop: 'pavilion',
        desc: '沒人要搶、巡邏也懶得來，攤開縮起來都慢慢的，新手首選。'
    },
    {
        id: 'xi_lai',
        name: '喜來凳',
        subtitle: '溜滑梯下的板凳，清晨會被小孩踩',
        stars: '★★☆☆☆',
        difficultyLabel: '適中',
        badgeColor: '#f1c40f',
        spreadRate: 40,
        shrinkRate: 37,
        zoneWidth: 32,
        scoreMultiplier: 1.5,
        evictPenalty: 160,
        squeezePenalty: 100,
        patrolCeil: 56,
        rivalFloor: 44,
        dawnFloor: 56,
        eventGap: 3.6,
        patrolBias: 0.5,
        pincerChance: 0.1,
        mapPos: { x: 418, y: 262 },
        prop: 'slide',
        desc: '位子普通、來的人也普通，事件開始變多，適合暖身練手感。'
    },
    {
        id: 'wc',
        name: 'W.C. 飯店',
        subtitle: '公廁旁的長椅，有燈有水有插座',
        stars: '★★★☆☆',
        difficultyLabel: '困難',
        badgeColor: '#e67e22',
        spreadRate: 52,
        shrinkRate: 34,
        zoneWidth: 24,
        scoreMultiplier: 2.5,
        evictPenalty: 220,
        squeezePenalty: 140,
        patrolCeil: 50,
        rivalFloor: 50,
        dawnFloor: 62,
        eventGap: 3.0,
        patrolBias: 0.4,
        pincerChance: 0.22,
        mapPos: { x: 428, y: 478 },
        prop: 'toilet',
        desc: '人來人往一直有人想坐過來，攤開的速度也明顯加快！'
    },
    {
        id: 'han_she',
        name: '寒舍挨罵',
        subtitle: '管理室門口，最乾最亮，但天天被罵',
        stars: '★★★★☆',
        difficultyLabel: '地獄',
        badgeColor: '#e74c3c',
        spreadRate: 66,
        shrinkRate: 31,
        zoneWidth: 17,
        scoreMultiplier: 3.5,
        evictPenalty: 300,
        squeezePenalty: 180,
        patrolCeil: 44,
        rivalFloor: 54,
        dawnFloor: 66,
        eventGap: 2.5,
        patrolBias: 0.65,
        pincerChance: 0.32,
        mapPos: { x: 122, y: 508 },
        prop: 'office',
        desc: '管理員就在門內，手電筒三不五時照過來，稍微攤開就被請走！'
    },
    {
        id: 'yuan_shan',
        name: '圓山大板凳',
        subtitle: '土地公廟屋簷下，全公園的 C 位',
        stars: '★★★★★',
        difficultyLabel: '傳說',
        badgeColor: '#c084fc',
        spreadRate: 84,
        shrinkRate: 29,
        zoneWidth: 12,
        scoreMultiplier: 5.0,
        evictPenalty: 400,
        squeezePenalty: 240,
        patrolCeil: 40,
        rivalFloor: 58,
        dawnFloor: 70,
        eventGap: 2.0,
        patrolBias: 0.5,
        pincerChance: 0.45,
        mapPos: { x: 272, y: 392 },
        prop: 'temple',
        desc: '有屋頂有供品、灑水器噴不到！五倍積分，但全公園都在搶！'
    }
];

// 囂張值物理（單位：% 或秒）
const SPREAD = {
    start: 30,            // 開局的囂張值
    baseFloor: 12,        // 平常的擠位線
    idleGrace: 1.6,       // 平常縮在擠位線下多久，紙箱哥就趁機坐過來
    rivalGrace: 0.6,      // 有人來搶位時，掉到擠位線下的寬限
    scrambleGrace: 1.3,   // 灑水器停了大家衝回來搶位（大風吹）時的寬限
    lineSpeed: 45,        // 驅離線 / 擠位線每秒移動多少
    minWindow: 14,        // 驅離線和擠位線之間至少留多寬（夾擊時才不會無解）
    zoneGap: 1,           // 理直氣壯區上緣比驅離線低多少
    stunSec: 1.25         // 被趕走 / 被擠走後多久才能再攤開
};

// 事件先預告（橫幅 + 計量表上的虛線預告線）多久，線才開始移動
const EVENT_WARN = 1.4;
// 自動灑水器：先噴水（驅離線壓到很低），停了以後大家衝回來搶位（擠位線升高）
// 不是每晚都會噴：chance 的機率啟動，時間在 hours（幾點到幾點，27.5 = 03:30）之間隨機；rush：噴完衝回來搶位的人數
const SPRINKLER = { spray: 2.8, scramble: 2.6, ceil: 24, chance: 0.7, hours: [23, 27.5], rush: [1, 2] };

// 理直氣壯區的加分倍數：每 0.3 秒重抽 x1.2 ~ x2.0（同一代的黃金過癮區）
const ZONE_BONUS = { min: 1.2, max: 2.0, rerollMs: 300 };

function rollZoneBonus() {
    const steps = Math.round((ZONE_BONUS.max - ZONE_BONUS.min) * 10);
    return Math.round((ZONE_BONUS.min * 10 + Phaser.Math.Between(0, steps))) / 10;
}

// 理直氣壯區再由下往上等分成幾段，越接近驅離線加分越多；畫面上不畫出來，讓玩家自己摸索
const ZONE_TIERS = [1.0, 1.2, 1.5, 2.0];

function zoneTierBonus(zoneMin, zoneMax, spread) {
    const t = (spread - zoneMin) / Math.max(1, zoneMax - zoneMin);
    const idx = Phaser.Math.Clamp(Math.floor(t * ZONE_TIERS.length), 0, ZONE_TIERS.length - 1);
    return ZONE_TIERS[idx];
}

// 好眠連擊：停在理直氣壯區每秒累積 perSec 下，每滿 hits 下阿睿打呼一次
const SLEEP_STREAK = { hits: 5, perSec: 4 };

// 每秒基本分（再乘上位子倍率、舒適度、理直氣壯區倍數、連睡 Combo）
const SCORE_RATE = 17;

// 彩蛋：下棋阿伯掉的「屁死」（一代的菸屁股），點一下撿起來加分
// 不一定會掉：chances 依序抽（第一根 65%，有掉才抽第二根 25%），時間在 window（第幾秒到第幾秒）之間隨機
const PISI_BONUS = { points: 150, life: 2.6, chances: [0.65, 0.25], window: [6, 52] };

/**
 * 公園裡的各路人馬
 * kind：ceiling = 壓低驅離線（要縮起來）、floor = 拉高擠位線（要攤開守住）
 * tex：程式畫的人物圖（comic-art.js 的 NPC_SPRITES）；warn：預告橫幅；hint：底部提示
 */
const NIGHT_CROWD = {
    patrol: {
        name: '巡守員', kind: 'ceiling', tex: 'npc-patrol', color: '#f87171',
        warn: '🔦 巡守員拿手電筒掃過來了！', hint: '🔦 手電筒在照！囂張值壓在紅線下！'
    },
    manager: {
        name: '公園管理員', kind: 'ceiling', tex: 'npc-patrol', color: '#f87171',
        warn: '📋 管理員出來巡了，快縮起來！', hint: '📋 管理員在看！囂張值壓在紅線下！'
    },
    auntie: {
        name: '廣場舞阿姨', kind: 'floor', tex: 'npc-auntie', color: '#f9a8d4',
        warn: '🔊 廣場舞阿姨拉著音響進場了！', hint: '🔊 阿姨在搶地盤！囂張值撐在藍線上！'
    },
    boxbro: {
        name: '宿敵紙箱哥', kind: 'floor', tex: 'npc-boxbro', color: '#93c5fd',
        warn: '📦 宿敵紙箱哥在旁邊繞來繞去…', hint: '📦 紙箱哥想坐過來！攤開守住！'
    },
    pigeons: {
        name: '鴿王阿伯', kind: 'floor', tex: 'npc-pigeons', color: '#93c5fd',
        warn: '🐦 鴿王阿伯撒飼料，鴿子大軍逼近！', hint: '🐦 鴿子要佔椅子了！攤開守住！'
    },
    couple: {
        name: '找暗處的情侶', kind: 'floor', tex: 'npc-couple', color: '#f9a8d4',
        warn: '💑 一對情侶在找暗一點的椅子…', hint: '💑 情侶想坐過來！攤開守住！'
    },
    drunk: {
        name: '醉漢', kind: 'floor', tex: 'npc-drunk', color: '#93c5fd',
        warn: '🍺 醉漢搖搖晃晃想躺下來！', hint: '🍺 醉漢要躺過來了！攤開守住！'
    },
    taichi: {
        name: '晨運太極團', kind: 'floor', tex: 'npc-taichi', color: '#fde68a',
        warn: '☯ 太極阿伯們來晨運，順便搶地盤！', hint: '☯ 太極團比誰都兇！囂張值撐在藍線上！'
    },
    sprinkler: {
        name: '自動灑水器', kind: 'ceiling', tex: null, color: '#7dd3fc',
        warn: '💦 喀喀喀…自動灑水器要噴了！', hint: '💦 灑水中！縮起來別被噴到！',
        scramble: '🌀 大風吹！灑水停了，大家衝回來搶位！', scrambleHint: '🌀 快攤開！搶回你的位子！'
    },
    complaint: {
        name: '路人', kind: 'ceiling', tex: null, color: '#f87171',
        warn: '📢 太囂張了，被路人檢舉！'
    }
};

/**
 * 誰會出現：全部用抽籤，每一晚都不一樣
 * - 每次輪到有人來，先依位子的 patrolBias 抽「巡邏的人」還是「搶位的人」，再從下面的名單依權重抽一個
 * - peak：比較常出現的時段（幾點到幾點；24 以上是隔天凌晨，例如 27 = 03:00）；
 *   在時段內用 weight、時段外用 off（0 = 時段外不會出現）。權重越高越容易抽到
 * - count：一次來幾個人（在範圍內隨機，沒寫就是 1 個）
 */
const PATROL_ODDS = [
    { who: 'patrol', weight: 1.0, officeWeight: 0.6 },    // officeWeight：在「寒舍挨罵」（管理室門口）時改用這個權重
    { who: 'manager', weight: 0.3, officeWeight: 1.4 }
];
const RIVAL_ODDS = [
    { who: 'auntie', peak: [18, 21.5], weight: 1.6, off: 0.1, count: [1, 2] },   // 跳完廣場舞
    { who: 'couple', peak: [20, 25], weight: 1.0, off: 0.15 },                    // 約會時段
    { who: 'drunk', peak: [22, 28], weight: 1.0, off: 0.2 },                      // 喝完酒
    { who: 'boxbro', peak: [18, 30], weight: 0.8, off: 0.8 },                     // 宿敵整晚都可能出現
    { who: 'pigeons', peak: [26, 30], weight: 1.0, off: 0.3 },                    // 清晨餵鴿子
    { who: 'taichi', peak: [28, 30], weight: 2.2, off: 0, count: [1, 3] }         // 04:00 以後才會來晨運
];

// 第幾秒是幾點（18 ~ 30，30 = 隔天 06:00），以及反過來
function hourAt(elapsed) {
    return NIGHT.startHour + elapsed / SEC_PER_HOUR;
}

function secondsAt(hour) {
    return (hour - NIGHT.startHour) * SEC_PER_HOUR;
}

function pickWeighted(items, weightOf) {
    const total = items.reduce((sum, it) => sum + weightOf(it), 0);
    let r = Math.random() * total;
    for (const it of items) {
        r -= weightOf(it);
        if (r < 0) return it;
    }
    return items[items.length - 1];
}

function randomCount(range) {
    return range ? Phaser.Math.Between(range[0], range[1]) : 1;
}

// 依時段抽一個搶位的人：{ who, count }
function pickRival(hour) {
    const r = pickWeighted(RIVAL_ODDS, o => (hour >= o.peak[0] && hour < o.peak[1] ? o.weight : o.off));
    return { who: r.who, count: randomCount(r.count) };
}

function pickPatrol(spot) {
    return pickWeighted(PATROL_ODDS, o => (spot.prop === 'office' ? o.officeWeight : o.weight)).who;
}

/**
 * 排出一整晚的事件（每一晚重新抽）
 * at：開始預告的時間（第幾秒），預告 EVENT_WARN 秒後才真的發生，持續 dur 秒；count：一次來幾個人
 */
function buildNightEvents(spot) {
    const list = [];
    const rand = (a, b) => Phaser.Math.FloatBetween(a, b);
    const crowdEvent = (isPatrol, at, dur) => {
        if (isPatrol) return { type: 'patrol', who: pickPatrol(spot), count: 1, at, dur, state: 'pending' };
        const r = pickRival(hourAt(at + EVENT_WARN));
        return { type: 'rival', who: r.who, count: r.count, at, dur, state: 'pending' };
    };

    // 灑水器（不一定會噴，時間也不一定）；噴水前後空出來，不排別的事件
    let quiet = null;
    if (Math.random() < SPRINKLER.chance) {
        const at = rand(secondsAt(SPRINKLER.hours[0]), secondsAt(SPRINKLER.hours[1]));
        const dur = SPRINKLER.spray + SPRINKLER.scramble;
        list.push({ type: 'sprinkler', who: 'sprinkler', count: 0, at, dur, state: 'pending' });
        quiet = [at - 1, at + EVENT_WARN + dur + 1];
    }
    const hitsQuiet = (from, to) => !!quiet && from < quiet[1] && to > quiet[0];

    let t = rand(2.5, 5);
    while (t < NIGHT.seconds - EVENT_WARN - 1.5) {
        const dur = rand(2.4, 3.4);
        if (hitsQuiet(t, t + EVENT_WARN + dur)) {
            t = quiet[1] + rand(0, 1.5);
            continue;
        }
        const isPatrol = Math.random() < spot.patrolBias;
        list.push(crowdEvent(isPatrol, t, dur));
        // 夾擊：另一種人緊接著疊上來
        if (Math.random() < spot.pincerChance) {
            const t2 = t + rand(0.9, 1.8);
            const d2 = Math.min(dur, NIGHT.seconds - t2 - EVENT_WARN);
            if (d2 > 1.6 && !hitsQuiet(t2, t2 + EVENT_WARN + d2)) list.push(crowdEvent(!isPatrol, t2, d2));
        }
        t += EVENT_WARN + dur + spot.eventGap * rand(0.4, 1.5);
    }
    return list.sort((a, b) => a.at - b.at);
}

// 結算稱號（分數由高到低）
const RANKS = [
    {
        min: 8500, color: '#fbbf24',
        title: '【公園C位之王・街友本色】',
        quote: '「從黃昏睡到天亮，太極阿伯都要繞路，全公園尊稱阿睿一聲哥！」'
    },
    {
        min: 4500, color: '#4ade80',
        title: '【涼亭資深房客】',
        quote: '「攤得剛好、縮得及時，巡守員照了一整晚都抓不到把柄！」'
    },
    {
        min: 1800, color: '#38bdf8',
        title: '【長椅游擊隊】',
        quote: '「雖然被趕了幾次、罵了幾句台語，總算睡到一點覺。」'
    },
    {
        min: 0, color: '#9ca3af',
        title: '【被太極阿伯掃地出門的菜鳥】',
        quote: '「天還沒亮就被擠下椅子，阿睿在溜滑梯底下縮了一整晚…」'
    }
];

function rankFor(score) {
    return RANKS.find(r => score >= r.min) || RANKS[RANKS.length - 1];
}

// 開場劇情：公園的規矩 → 坐了十年 C 位的阿土伯被女兒接回家 → 寒流夜全公園都盯著空椅子 → 阿睿暖身準備躺平
// focus：鏡頭慢慢推近的定點（換成真的美術圖後要重新量）
const STORY_SLIDES = [
    {
        img: 'img2',
        focus: { x: 272, y: 392 },
        title: '第一章：公園的規矩',
        text: '這座公園有一條不成文的規矩：\n土地公廟前那張長椅，誰睡到天亮就是誰的。'
    },
    {
        img: 'img1',
        focus: { x: 250, y: 560 },
        title: '第二章：C 位空出來了',
        text: '霸佔 C 位十年的阿土伯，昨天被女兒接回家了。\n他在椅子上留了一張紙箱：「給撐到天亮的人」'
    },
    {
        img: 'img3',
        focus: { x: 270, y: 600 },
        title: '第三章：寒流來襲',
        text: '偏偏今晚寒流來襲，全公園都盯著那張空椅子，\n巡守員的手電筒，也比平常多照了好幾圈…'
    },
    {
        img: 'img4',
        focus: { x: 250, y: 520 },
        title: '第四章：躺平是一門技術',
        text: '攤太開會被趕走，縮太小會被擠走。\n阿睿拉了拉筋──躺平，也是需要技術的。'
    }
];

// Shared Game State
const GAME_STATE = {
    selectedSpot: PARK_SPOTS[1],
    lastResult: null
};

/**
 * ============================================================================
 * RENDER SETTINGS & ART CALIBRATION
 * ============================================================================
 * 遊戲邏輯座標固定為 540x960；畫布實際以 RENDER_SCALE 倍像素渲染（攝影機放大），
 * 讓漫畫線稿與文字在手機 / Retina 螢幕上維持銳利。
 */
const GAME_W = 540;
const GAME_H = 960;
const RENDER_SCALE = 2;
const ADD = Phaser.BlendModes.ADD;

// 全站字型：英文字母取 Noto Serif，中文 Noto Serif 沒有字形會自動落到 Noto Serif TC
const FONT_SERIF = '"Noto Serif", "Noto Serif TC", "Songti TC", "PMingLiU", serif';
const FONT_UI = FONT_SERIF;
const FONT_TITLE = FONT_SERIF;
const FONT_NUM = FONT_SERIF;
const INK = '#1c1917';
const PAPER = 0xf2e8cf;

// 所有 Text 都以 RENDER_SCALE 解析度繪製，配合攝影機放大後才不會糊
// 要在建立時就帶進 style：事後 setResolution() 不會更新貼圖的解析度，Canvas 模式（本機開檔）會把字畫成兩倍大
(function patchTextResolution() {
    const factory = Phaser.GameObjects.GameObjectFactory.prototype;
    const createText = factory.text;
    factory.text = function (x, y, text, style) {
        return createText.call(this, x, y, text, { ...style, resolution: RENDER_SCALE });
    };
})();

// 程式畫的人物、姿勢圖以兩倍解析度繪製，顯示時再縮回來
const ART_RES = 2;

// 遊戲畫面的長椅：椅面中心 x、椅面高度 y、長度（各位子的背景圖 bg-<id> 和阿睿的姿勢圖都對齊這裡）
const BENCH = { x: 250, seatY: 610, len: 360 };
const GROUND_Y = 742;   // 路人站的位置（腳底）

// 阿睿姿勢圖（pose-0 ~ pose-3）：透明底，椅面在圖中 y = seatY，長椅中心在 x = w / 2
// heads：每個姿勢頭的位置（吐白霧、打呼的 Z 從這裡冒出來）
const POSE_SPRITE = {
    w: 460,
    h: 300,
    seatY: 200,
    heads: [{ x: 140, y: 100 }, { x: 152, y: 82 }, { x: 78, y: 132 }, { x: 78, y: 166 }]
};
const POSE_NAMES = ['縮成一團', '坐著', '半躺', '大字躺平'];

// 原圖上的關鍵位置（540x960 遊戲座標；換成真的美術圖後要重新量）
const ART_FX = {
    img0: {
        lanterns: [{ x: 176, y: 318, w: 22, h: 30, color: 0xff3326 }, { x: 364, y: 318, w: 22, h: 30, color: 0xff3326 }],
        moon: { x: 430, y: 150 },
        bench: { x: 270, y: 462 },
        beam: { x: 540, y: 372 }
    },
    // 劇情二：廟前燈籠、機車尾燈
    img1: {
        lanterns: [{ x: 104, y: 338, w: 20, h: 28, color: 0xff3326 }, { x: 276, y: 338, w: 20, h: 28, color: 0xff3326 }],
        taillight: { x: 368, y: 656 }
    },
    // 劇情一 + 選位子：路燈、地圖正中間的 C 位
    img2: {
        lamps: [{ x: 196, y: 330 }, { x: 350, y: 330 }, { x: 200, y: 470 }, { x: 352, y: 470 }, { x: 272, y: 560 }],
        spotlight: { x: 272, y: 392 }
    },
    // 劇情三：燈籠、空著的 C 位、從右邊掃過來的手電筒
    img3: {
        lanterns: [{ x: 150, y: 332, w: 30, h: 40, color: 0xff3326 }, { x: 390, y: 332, w: 30, h: 40, color: 0xff3326 }],
        treasure: { x: 270, y: 612 },
        beam: { x: 560, y: 450 }
    },
    // 劇情四：路燈
    img4: {
        lamp: { x: 470, y: 330 }
    },
    stage: {
        lamp: { x: 38, y: 318 },
        moon: { x: 420, y: 250 }
    }
};
