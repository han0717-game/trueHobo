// ----------------------------------------------------------------------------
// SCENE C: STORY CUTSCENE（公園的規矩 → C 位空出來了 → 寒流來襲 → 躺平是一門技術）
// 劇情文字在 data.js 的 STORY_SLIDES；第一次一定要看完，看完一次之後才出現「跳過劇情」
// ----------------------------------------------------------------------------

// 有沒有看完過劇情：記在玩家自己的瀏覽器（localStorage）；無痕模式等讀寫失敗時，至少在這次開啟期間記得
const StoryProgress = {
    KEY: 'trueHobo2.storySeen',   // han0717-game.github.io 底下所有頁面共用 localStorage，名稱要帶遊戲代號
    seenThisSession: false,

    isSeen() {
        if (this.seenThisSession) return true;
        try {
            return localStorage.getItem(this.KEY) === '1';
        } catch (e) {
            return false;
        }
    },

    markSeen() {
        this.seenThisSession = true;
        try {
            localStorage.setItem(this.KEY, '1');
        } catch (e) { }
    }
};

class StoryScene extends Phaser.Scene {
    constructor() {
        super({ key: 'StoryScene' });
    }

    create() {
        setupView(this);
        const W = GAME_W;
        const H = GAME_H;
        this.cameras.main.fadeIn(400, 0, 0, 0);

        this.slides = STORY_SLIDES;
        this.currentSlideIndex = 0;
        this.typing = false;
        this.typeTimer = null;
        this.slideFx = [];
        this.chapterTag = null;

        // 兩層背景輪流交叉淡入
        this.bgFront = addArtImage(this, this.slides[0].img, 1);
        this.bgBack = addArtImage(this, this.slides[0].img, 0);

        addRain(this, { density: 0.8 });
        addFilmFinish(this);

        // 漫畫旁白框
        this.boxX = 16;
        this.boxY = H - 182;
        this.boxW = W - 32;
        this.boxH = 160;
        drawComicPanel(this, this.boxX, this.boxY, this.boxW, this.boxH, {
            fill: PAPER,
            alpha: 0.97,
            shadow: 7,
            border: 3.5,
            halftone: true,
            depth: 20
        });

        this.storyTxt = this.add.text(this.boxX + 22, this.boxY + 34, '', {
            fontFamily: FONT_UI,
            fontSize: '17px',
            fontStyle: 'bold',
            color: INK,
            lineSpacing: 9
        }).setDepth(22);

        this.nextPrompt = this.add.text(this.boxX + this.boxW - 18, this.boxY + this.boxH - 20, '點擊繼續 ▶', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            fontStyle: '900',
            color: '#b91c1c'
        }).setOrigin(1, 0.5).setDepth(22);

        this.tweens.add({
            targets: this.nextPrompt,
            alpha: 0.35,
            duration: 550,
            yoyo: true,
            repeat: -1
        });

        this.progressDots = this.slides.map((_, i) =>
            this.add.circle(this.boxX + 26 + i * 18, this.boxY + this.boxH - 20, 5, 0xb91c1c, 1)
                .setStrokeStyle(2, 0x000000)
                .setDepth(22)
        );

        // 跳過劇情（左上）：看完過一次劇情才有
        if (StoryProgress.isSeen()) {
            const skipBtn = createComicButton(this, 72, 56, 112, 34, '跳過劇情 ⏭', {
                fill: 0x111827,
                color: '#e5e7eb',
                fontSize: '13px',
                shadow: 4,
                border: 2.5,
                shine: 0.06,
                depth: 30
            });

            skipBtn.on('pointerdown', (pointer, x, y, event) => {
                event.stopPropagation();
                this.scene.start('SelectSpotScene');
            });
        }

        this.showSlide(0);

        this.input.on('pointerdown', () => {
            if (this.typing) {
                this.finishTyping();
                return;
            }
            this.currentSlideIndex++;
            if (this.currentSlideIndex < this.slides.length) {
                this.showSlide(this.currentSlideIndex);
            } else {
                StoryProgress.markSeen();
                this.scene.start('SelectSpotScene');
            }
        });
    }

    showSlide(idx) {
        const s = this.slides[idx];

        const incoming = this.bgBack;
        this.bgBack = this.bgFront;
        this.bgFront = incoming;
        incoming.setTexture(s.img);
        fitCover(incoming);
        incoming.setDepth(1).setAlpha(idx === 0 ? 1 : 0);
        this.bgBack.setDepth(0);
        kenBurns(this, incoming, s.focus, 1.07, 7000);
        if (idx > 0) {
            this.tweens.add({ targets: incoming, alpha: 1, duration: 450 });
        }

        this.slideFx.forEach(o => o.destroy());
        this.slideFx = this.addSlideFx(ART_FX[s.img] || {}, s.focus);

        if (this.chapterTag) this.chapterTag.destroy();
        this.chapterTag = addTagLabel(this, 0, this.boxY, s.title, { fontSize: '15px', angle: -2, depth: 23 });
        this.chapterTag.x = this.boxX + 14 + this.chapterTag.boxW / 2;

        this.progressDots.forEach((dot, i) => dot.setFillStyle(i === idx ? 0xb91c1c : 0xd6cdb4, 1));
        this.nextPrompt.setText(idx === this.slides.length - 1 ? '點擊挑選過夜位子 ▶' : '點擊繼續 ▶');
        this.typeText(s.text);
    }

    // 每張圖的燈光：燈籠、路燈、地圖上的 C 位光圈、機車尾燈、空長椅的金光、掃來掃去的手電筒
    addSlideFx(fx, focus) {
        const objs = [...addNeonGlow(this, fx.lanterns, 3), ...addLampGlow(this, fx.lamp, 3)];
        (fx.lamps || []).forEach(l => {
            const glow = this.add.image(l.x, l.y, glowKey(this, 0xffe9a8)).setBlendMode(ADD).setScale(0.45).setAlpha(0.4).setDepth(3);
            this.tweens.add({ targets: glow, alpha: 0.2, duration: 1400 + Math.random() * 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            objs.push(trackArt(glow));
        });
        if (fx.spotlight) {
            // 光圈放在鏡頭推近的定點上，不用跟著圖移動，才能自己放大縮小
            const { x, y } = fx.spotlight;
            const glow = this.add.image(x, y, glowKey(this, 0xffc46b)).setBlendMode(ADD).setScale(1.3).setAlpha(0.3).setDepth(4);
            this.tweens.add({ targets: glow, alpha: 0.6, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            const ring = this.add.circle(x, y, 44).setStrokeStyle(4, 0xfde047, 1).setDepth(4);
            this.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 1200, repeat: -1, ease: 'Sine.easeOut' });
            const tag = addTagLabel(this, x, y - 104, 'C 位', { fontSize: '16px', fill: 0xb91c1c, angle: -4, depth: 5 });
            this.tweens.add({ targets: tag, y: y - 112, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            objs.push(glow, ring, tag);
        }
        if (fx.taillight) {
            const glow = this.add.image(fx.taillight.x, fx.taillight.y, glowKey(this, 0xff2a1a)).setBlendMode(ADD).setScale(0.35).setDepth(4);
            this.tweens.add({ targets: glow, alpha: { from: 0.9, to: 0.3 }, duration: 380, yoyo: true, repeat: -1 });
            objs.push(trackArt(glow));
        }
        if (fx.treasure) {
            const glow = this.add.image(fx.treasure.x, fx.treasure.y, glowKey(this, 0xffc46b))
                .setBlendMode(ADD).setDisplaySize(420, 120).setAlpha(0.15).setDepth(4);
            this.tweens.add({ targets: glow, alpha: 0.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            objs.push(trackArt(glow));
        }
        if (fx.beam && fx.treasure) {
            const target = fx.treasure;
            const dist = Phaser.Math.Distance.Between(fx.beam.x, fx.beam.y, target.x, target.y);
            const base = Math.atan2(target.y - fx.beam.y, target.x - fx.beam.x);
            const beam = this.add.image(fx.beam.x, fx.beam.y, 'fx-beam').setOrigin(0, 0.5).setBlendMode(ADD)
                .setDisplaySize(dist * 1.3, 170).setAlpha(0.6).setRotation(base - 0.28).setDepth(4);
            this.tweens.add({ targets: beam, rotation: base + 0.22, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            objs.push(trackArt(beam));
        }
        return objs;
    }

    typeText(fullText) {
        if (this.typeTimer) this.typeTimer.remove();
        this.fullText = fullText;
        this.typedLen = 0;
        this.typing = true;
        this.storyTxt.setText('');
        this.nextPrompt.setVisible(false);
        this.typeTimer = this.time.addEvent({
            delay: 32,
            loop: true,
            callback: () => {
                this.typedLen++;
                this.storyTxt.setText(this.fullText.slice(0, this.typedLen));
                if (this.typedLen >= this.fullText.length) this.finishTyping();
            }
        });
    }

    finishTyping() {
        if (this.typeTimer) {
            this.typeTimer.remove();
            this.typeTimer = null;
        }
        this.storyTxt.setText(this.fullText);
        this.typing = false;
        this.nextPrompt.setVisible(true);
    }

    update() {
        syncToArt(this.bgFront, this.slideFx.filter(o => o.artX !== undefined));
    }
}
