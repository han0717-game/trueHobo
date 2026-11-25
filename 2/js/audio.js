/**
 * ============================================================================
 * 音效引擎：合成配樂 + 台語語音 + 各種音效（沿用一代的架構）
 * ============================================================================
 * 配樂從封面開始播，換場景不中斷。台語台詞有真人配音檔就播檔案，沒有就用瀏覽器語音念。
 */
class StreetAudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlayingBGM = false;
        // 封面影片（有放 video/video.mp4 的話）自帶聲音，封面期間先讓合成配樂停下，離開封面再接手
        this.duckBGM = false;
        this.bgmStep = 0;
        this.bgmTimer = null;
        this.spreadNode = null;
        this.spreadGain = null;
        this.rainGain = null;

        // 台語台詞（念的內容要跟 text 一樣；text 是畫面上的字幕）
        // audio：真人配音檔（放在 audio/ 資料夾）。有任何一個音檔載得到，就只從有音檔的台詞裡挑；
        // 全部沒有才用瀏覽器男聲念 tts（華語諧音）
        // 被巡守員 / 管理員趕走
        this.evictLines = [
            { text: '好啦好啦，我走…', tts: '好啦好啦，我走', pitch: 0, rate: 1, audio: './audio/audio01.mp3' },
            { text: '阮坐遮是礙著你喔？', tts: '阮坐這是礙到你喔', pitch: 0, rate: 1, audio: './audio/audio02.mp3' },
            { text: '照啥小！', tts: '照啥小', pitch: 0, rate: 1, audio: './audio/audio03.mp3' },
            { text: '幹！眼睛脫窗', tts: '幹！眼睛脫窗', pitch: 0, rate: 1, audio: './audio/audio04.mp3' },
            { text: '哭爸！我嘛是納稅人', tts: '哭爸！我嘛是納稅人', pitch: 0, rate: 1, audio: './audio/audio05.mp3' }
        ];
        // 位子被別人坐走
        this.squeezeLines = [
            { text: '這恁爸的位啦！', tts: '這恁爸的位啦', pitch: 0, rate: 1, audio: './audio/audio06.mp3' },
            { text: '先來後到敢毋知？', tts: '先來後到敢不知', pitch: 0, rate: 1, audio: './audio/audio07.mp3' },
            { text: '閃啦！', tts: '閃啦', pitch: 0, rate: 1, audio: './audio/audio08.mp3' },
            { text: '擠啥小！', tts: '擠啥小', pitch: 0, rate: 1, audio: './audio/audio09.mp3' },
            { text: '恁老師咧', tts: '恁老師咧', pitch: 0, rate: 1, audio: './audio/audio10.mp3' }
        ];
        // 被灑水器噴到
        this.wetLines = [
            { text: '哭爸！淋甲澹糊糊！', tts: '哭爸！淋得濕糊糊', pitch: 0, rate: 1, audio: './audio/audio11.mp3' },
            { text: '啊娘喂！寒死！', tts: '啊娘喂！冷死', pitch: 0, rate: 1, audio: './audio/audio12.mp3' }
        ];
        // 好眠連擊的打呼：只顯示字幕（搭配打呼音效），不念
        this.snoreLines = [
            { text: '呼～嚕～' },
            { text: 'Zzz…' },
            { text: '夢到十柒猩球～' },
            { text: '爽躺～' },
            { text: '奇摩子～' }
        ];

        // 洗牌袋：每一組台詞各自記「還沒抽到的」和「上一句」（見 drawLine）
        this.lineBags = {};
    }

    lineGroup(group) {
        return { evict: this.evictLines, squeeze: this.squeezeLines, wet: this.wetLines }[group] || this.evictLines;
    }

    // 所有真人配音檔的路徑（開場預先下載用）
    voiceClipSrcs() {
        return [...this.evictLines, ...this.squeezeLines, ...this.wetLines].filter(l => l.audio).map(l => l.audio);
    }

    // 畫面上會出現的台詞（預載字型用）
    allLineTexts() {
        return [...this.evictLines, ...this.squeezeLines, ...this.wetLines, ...this.snoreLines].map(l => l.text);
    }

    // 台詞用「洗牌袋」抽：整副洗亂後依序抽，抽完才重洗，每一輪每句剛好出現一次，
    // 重洗時也避開上一句，不會連續兩次同一句。
    drawLine(group, pool) {
        const state = this.lineBags[group] || (this.lineBags[group] = { bag: [], last: null });
        while (state.bag.length) {
            const line = state.bag.pop();
            if (pool.includes(line)) return (state.last = line);
        }
        const bag = pool.slice();
        for (let i = bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && bag[bag.length - 1] === state.last) {
            [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
        }
        state.bag = bag;
        return (state.last = state.bag.pop());
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            // 配音檔要有 AudioContext 才能解碼
            VoiceClips.decodeAll();
            // 先叫一次讓 Chrome 開始載入語音清單（第一次常回空陣列）
            if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // 台詞的瀏覽器語音：男聲由低沉到一般排序，Apple 的 Rocko → Grandpa → Reed → Eddy（Mac、iPhone），
    // 微軟的 YunJhe、Zhiwei（Windows）；都沒有才退回其他台灣中文語音
    pickVoice() {
        const voices = window.speechSynthesis.getVoices();
        const twVoices = voices.filter(v => /^zh[-_]TW$/i.test(v.lang));
        for (const name of ['Rocko', 'Grandpa', 'Reed', 'Eddy', 'YunJhe', 'Zhiwei']) {
            const male = twVoices.find(v => v.name.includes(name));
            if (male) return male;
        }
        return voices.find(v => v.lang.includes('TW') || v.name.includes('Taiwan') || v.name.includes('Meijia') || v.name.includes('Hsiao')) || null;
    }

    startContinuousBGM() {
        this.init();
        if (this.isPlayingBGM) return;
        this.isPlayingBGM = true;
        this.startRainAmbience();

        // 深夜公園版的搖滾 riff（A 小調，比一代慢一點、懶一點）
        const riffNotes = [
            { freq: 110.00, dur: 0.26, accent: true },  // A2
            { freq: 110.00, dur: 0.18, accent: false },
            { freq: 130.81, dur: 0.26, accent: true },  // C3
            { freq: 146.83, dur: 0.24, accent: true },  // D3
            { freq: 110.00, dur: 0.22, accent: false },
            { freq: 98.00, dur: 0.26, accent: true },   // G2
            { freq: 110.00, dur: 0.34, accent: true },
            { freq: 110.00, dur: 0.18, accent: false },
            { freq: 164.81, dur: 0.24, accent: true },  // E3
            { freq: 146.83, dur: 0.24, accent: true },
            { freq: 130.81, dur: 0.22, accent: false },
            { freq: 110.00, dur: 0.24, accent: true },
            { freq: 98.00, dur: 0.22, accent: true },
            { freq: 82.41, dur: 0.26, accent: true },   // E2
            { freq: 98.00, dur: 0.22, accent: false },
            { freq: 110.00, dur: 0.38, accent: true }
        ];

        const stepIntervalMs = 270;
        this.bgmTimer = setInterval(() => {
            if (!this.ctx || this.duckBGM) return;
            const masterVol = 0.15;
            const step = riffNotes[this.bgmStep % riffNotes.length];
            this.playGrungeGuitarNote(step.freq, step.dur, step.accent, masterVol);
            if (this.bgmStep % 2 === 0) {
                this.playDrumKickOrSnare((this.bgmStep % 4 === 2) ? 'snare' : 'kick', masterVol * 1.1);
            }
            this.bgmStep++;
        }, stepIntervalMs);
    }

    noiseBuffer(seconds, shape) {
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * seconds));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (shape ? shape(i / len) : 1);
        return buf;
    }

    startRainAmbience() {
        if (!this.ctx) return;
        try {
            const whiteNoise = this.ctx.createBufferSource();
            whiteNoise.buffer = this.noiseBuffer(2);
            whiteNoise.loop = true;
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 950;
            filter.Q.value = 0.7;
            this.rainGain = this.ctx.createGain();
            this.rainGain.gain.value = 0.018;
            whiteNoise.connect(filter);
            filter.connect(this.rainGain);
            this.rainGain.connect(this.ctx.destination);
            whiteNoise.start(0);
        } catch (e) { }
    }

    playGrungeGuitarNote(freq, duration, accent, maxGain = 0.18) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        osc1.type = 'sawtooth';
        osc2.type = 'square';
        osc1.frequency.setValueAtTime(freq, now);
        osc2.frequency.setValueAtTime(freq * 1.498, now);
        const shaper = this.ctx.createWaveShaper();
        const curve = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const x = (i * 2) / 256 - 1;
            curve[i] = Math.tanh(x * (accent ? 6.5 : 4.0));
        }
        shaper.curve = curve;
        const cabFilter = this.ctx.createBiquadFilter();
        cabFilter.type = 'lowpass';
        cabFilter.frequency.setValueAtTime(accent ? 1700 : 1200, now);
        const gain = this.ctx.createGain();
        const peak = accent ? maxGain : maxGain * 0.7;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(peak, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc1.connect(shaper);
        osc2.connect(shaper);
        shaper.connect(cabFilter);
        cabFilter.connect(gain);
        gain.connect(this.ctx.destination);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + duration + 0.02);
        osc2.stop(now + duration + 0.02);
    }

    playDrumKickOrSnare(type, vol = 0.18) {
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        if (type === 'kick') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.exponentialRampToValueAtTime(36, now + 0.12);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + 0.16);
        } else {
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer(0.1, t => Math.exp(-t / 0.4));
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 400;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol * 0.65, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(now);
        }
    }

    // 一段濾波過的雜訊（各種「刷、噗、嘶」的音效共用）
    playNoise({ dur, type = 'bandpass', freq = 1000, freqEnd, q = 1, vol = 0.2, delay = 0, shape }) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime + delay;
            const src = this.ctx.createBufferSource();
            src.buffer = this.noiseBuffer(dur, shape);
            const filter = this.ctx.createBiquadFilter();
            filter.type = type;
            filter.Q.value = q;
            filter.frequency.setValueAtTime(freq, now);
            if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            src.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            src.start(now);
        } catch (e) { }
    }

    playTone({ freq, freqEnd, dur, type = 'sine', vol = 0.15, delay = 0 }) {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime + delay;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, now);
            if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + dur);
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(vol, now + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            osc.stop(now + dur + 0.02);
        } catch (e) { }
    }

    // 紙箱「啪」一聲攤開（點按鈕、選位子）
    playCardboardFlop() {
        this.init();
        this.playNoise({ dur: 0.22, type: 'lowpass', freq: 900, freqEnd: 200, vol: 0.45, shape: t => Math.exp(-t * 7) });
        this.playTone({ freq: 140, freqEnd: 60, dur: 0.16, type: 'triangle', vol: 0.2 });
    }

    // 壓住攤開時的紙箱、塑膠袋窸窣聲（越攤越大聲）
    setSpreadSound(isSpreading, ratio = 0.5) {
        this.init();
        if (!this.ctx) return;
        if (isSpreading) {
            if (!this.spreadNode) {
                const buf = this.noiseBuffer(1.5);
                const data = buf.getChannelData(0);
                for (let i = 0; i < data.length; i++) {
                    data[i] = Math.random() > 0.93 ? (Math.random() * 2 - 1) * 2 : data[i] * 0.3;
                }
                this.spreadNode = this.ctx.createBufferSource();
                this.spreadNode.buffer = buf;
                this.spreadNode.loop = true;
                this.spreadFilter = this.ctx.createBiquadFilter();
                this.spreadFilter.type = 'bandpass';
                this.spreadFilter.frequency.value = 700;
                this.spreadGain = this.ctx.createGain();
                this.spreadGain.gain.value = 0;
                this.spreadNode.connect(this.spreadFilter);
                this.spreadFilter.connect(this.spreadGain);
                this.spreadGain.connect(this.ctx.destination);
                this.spreadNode.start(0);
            }
            this.spreadFilter.frequency.setTargetAtTime(500 + ratio * 1400, this.ctx.currentTime, 0.05);
            this.spreadGain.gain.setTargetAtTime(0.06 + ratio * 0.1, this.ctx.currentTime, 0.05);
        } else if (this.spreadGain) {
            this.spreadGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
        }
    }

    // 事件預告：「叮咚」兩聲
    playWarnChime(kind) {
        this.init();
        const [a, b] = kind === 'ceiling' ? [988, 740] : [660, 880];
        this.playTone({ freq: a, dur: 0.18, type: 'triangle', vol: 0.14 });
        this.playTone({ freq: b, dur: 0.24, type: 'triangle', vol: 0.14, delay: 0.16 });
    }

    // 巡守員吹哨子
    playWhistle() {
        if (!this.ctx) return;
        [0, 0.2].forEach(d => {
            this.playTone({ freq: 2900, freqEnd: 2700, dur: 0.16, type: 'square', vol: 0.06, delay: d });
            this.playNoise({ dur: 0.16, type: 'bandpass', freq: 2800, q: 6, vol: 0.12, delay: d });
        });
    }

    // 被擠下椅子：「碰」一聲屁股著地
    playThud() {
        if (!this.ctx) return;
        this.playTone({ freq: 160, freqEnd: 45, dur: 0.25, type: 'sine', vol: 0.35 });
        this.playNoise({ dur: 0.18, type: 'lowpass', freq: 600, vol: 0.3, shape: t => Math.exp(-t * 8) });
    }

    // 灑水器噴水的嘶嘶聲
    playSprinkler(seconds) {
        this.init();
        this.playNoise({ dur: seconds, type: 'highpass', freq: 3000, vol: 0.12, shape: t => (t < 0.05 ? t / 0.05 : 1) * (0.7 + Math.random() * 0.3) });
        for (let i = 0; i < 5; i++) this.playNoise({ dur: 0.05, type: 'bandpass', freq: 1800, q: 4, vol: 0.2, delay: i * 0.09 });
    }

    // 打呼：低沉的鋸齒波，吸氣時音高往上、吐氣時鬆掉
    playSnore() {
        if (!this.ctx) return;
        try {
            const now = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(70, now);
            osc.frequency.linearRampToValueAtTime(95, now + 0.45);
            osc.frequency.linearRampToValueAtTime(55, now + 0.9);
            const lfo = this.ctx.createOscillator();
            const lfoGain = this.ctx.createGain();
            lfo.frequency.value = 28;
            lfoGain.gain.value = 12;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 500;
            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.001, now);
            gain.gain.linearRampToValueAtTime(0.16, now + 0.3);
            gain.gain.linearRampToValueAtTime(0.05, now + 0.5);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now);
            lfo.start(now);
            osc.stop(now + 1);
            lfo.stop(now + 1);
        } catch (e) { }
    }

    // 撿到東西的「叮叮」
    playPickup() {
        this.init();
        [1318.5, 1975.5].forEach((f, i) => this.playTone({ freq: f, dur: 0.22, type: 'sine', vol: 0.13, delay: i * 0.08 }));
    }

    // 被趕走 / 被擠走 / 被噴濕：音效 + 台語台詞，回傳字幕
    playShout(group) {
        this.init();
        const all = this.lineGroup(group);
        // 有真人配音就只挑有音檔的台詞，免得一下真人一下機器聲
        const recorded = all.filter(l => l.audio && VoiceClips.has(l.audio));
        const pool = recorded.length ? recorded : all;
        const line = this.drawLine(group, pool);
        const playedClip = !!line.audio && VoiceClips.play(line.audio);

        if (group === 'evict') this.playWhistle();
        else if (group === 'squeeze') this.playThud();
        else this.playNoise({ dur: 0.5, type: 'highpass', freq: 2500, vol: 0.3 });

        if (!playedClip) this.speakLine(line);
        return line.text;
    }

    // 用瀏覽器語音念台詞（沒有真人配音時的備援）
    speakLine(line) {
        if (!('speechSynthesis' in window)) return;
        try {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(line.tts);
            utter.lang = 'zh-TW';
            utter.pitch = line.pitch;
            utter.rate = line.rate;
            utter.volume = 1.0;
            const voice = this.pickVoice();
            if (voice) utter.voice = voice;
            window.speechSynthesis.speak(utter);
        } catch (e) { }
    }

    // 好眠連擊：抽一句打呼字幕 + 打呼聲
    pickSnoreLine() {
        this.playSnore();
        return this.drawLine('snore', this.snoreLines).text;
    }
}

const audioEngine = new StreetAudioEngine();

// 雙擊開檔（file://）時瀏覽器不准 WebGL 讀本機的圖檔和影片，改用 Canvas 繪圖 + <img> 載入（上線後照常用 WebGL）
const IS_LOCAL_FILE = location.protocol === 'file:';

/**
 * 封面影片 video/video.mp4（選填）：自己建 <video> 再交給 Phaser 當貼圖，播放、切場景都由這裡控制。
 * 二代目前還沒有影片，載不到時封面直接用圖 + 合成配樂。
 */
const CoverVideo = {
    el: null,

    load() {
        if (this.el) return;
        const v = document.createElement('video');
        v.loop = true;
        v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.preload = 'auto';
        v.addEventListener('error', () => { if (this.el === v) this.el = null; });
        v.src = withVersion('./video/video.mp4');
        this.el = v;
        v.muted = true;
        v.play().catch(() => { });
    },

    // 從頭有聲播放；必須在玩家點擊的當下呼叫才能有聲音（被瀏覽器擋下時改成靜音播放）
    start() {
        const v = this.el;
        if (!v) return false;
        v.currentTime = 0;
        v.volume = 1;
        v.muted = false;
        v.play().catch(() => {
            v.muted = true;
            v.play().catch(() => { });
        });
        return true;
    },

    stop() {
        if (this.el) this.el.pause();
    }
};

/**
 * 真人配音（audio/ 資料夾裡的 audioXX.mp3，對照上面的台詞表）：放了就播，沒放就退回瀏覽器語音。
 * 上線時下載後交給 Web Audio 播（台詞發生在遊戲中途，不是點擊當下，手機上 <audio> 會被擋）；
 * 雙擊開檔（file://）讀不到檔案內容，改用 <audio> 播。
 */
const VoiceClips = {
    clips: {},

    load(srcs) {
        srcs.forEach(src => {
            if (this.clips[src]) return;
            const clip = this.clips[src] = { ready: false };
            if (IS_LOCAL_FILE) {
                const a = new Audio();
                a.preload = 'auto';
                a.addEventListener('canplaythrough', () => { clip.ready = true; }, { once: true });
                a.src = withVersion(src);
                clip.el = a;
            } else {
                fetch(withVersion(src))
                    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
                    .then(data => { clip.data = data; this.decode(clip); })
                    .catch(() => { });
            }
        });
    },

    decode(clip) {
        const ctx = audioEngine.ctx;
        if (!ctx || !clip.data) return;
        const data = clip.data;
        clip.data = null;
        ctx.decodeAudioData(data, buf => { clip.buffer = buf; clip.ready = true; }, () => { });
    },

    decodeAll() {
        Object.values(this.clips).forEach(clip => this.decode(clip));
    },

    has(src) {
        return !!(this.clips[src] && this.clips[src].ready);
    },

    play(src) {
        const clip = this.clips[src];
        if (!clip || !clip.ready) return false;
        if (clip.el) {
            clip.el.currentTime = 0;
            clip.el.play().catch(() => { });
        } else {
            const node = audioEngine.ctx.createBufferSource();
            node.buffer = clip.buffer;
            node.connect(audioEngine.ctx.destination);
            node.start();
        }
        return true;
    }
};
