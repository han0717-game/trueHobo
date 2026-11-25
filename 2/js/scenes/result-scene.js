// ----------------------------------------------------------------------------
// SCENE F: SETTLEMENT SCREEN（天亮結算：守住 C 位幾小時、總分、稱號）
// ----------------------------------------------------------------------------
class ResultScene extends Phaser.Scene {
    constructor() {
        super({ key: 'ResultScene' });
    }

    create() {
        setupView(this);
        const W = GAME_W;
        const H = GAME_H;
        const res = GAME_STATE.lastResult || {
            score: 0,
            spot: PARK_SPOTS[0],
            evictCount: 0,
            squeezeCount: 0,
            maxCombo: 0,
            heldHours: '0.0',
            sleepHours: '0.0'
        };

        this.cameras.main.fadeIn(400, 0, 0, 0);

        // 背景：今晚睡的位子 + 阿睿大字躺平（有真的姿勢圖就用 img8），壓暗當結算底圖
        if (this.textures.exists('img8')) {
            addArtImage(this, 'img8');
        } else {
            addArtImage(this, ComicArtGenerator.spotBackdropKey(this, res.spot));
            this.add.image(BENCH.x, BENCH.seatY, 'pose-3').setOrigin(0.5, POSE_SPRITE.seatY / POSE_SPRITE.h).setScale(1 / ART_RES).setDepth(1);
        }
        this.add.rectangle(W / 2, H / 2, W, H, 0xfbbf24, 0.12).setDepth(2);
        addRain(this, { density: 0.3 });
        addFilmFinish(this, { vignette: 0.7 });
        this.add.rectangle(W / 2, H / 2, W, H, 0x05060a, 0.5).setDepth(10);

        const rank = rankFor(res.score);

        // 戰績圖一進結算就先在背景做好，按下按鈕直接下載
        this.shareResult = res;
        this.makeShareImage();

        drawComicPanel(this, 18, 90, W - 36, 788, { fill: 0x0b0e14, alpha: 0.92, accent: 0xd97706, accentAlpha: 0.8, shadow: 8, depth: 20 });

        this.add.text(W / 2, 128, '☀ 06:00 天亮了・公園結算', {
            fontFamily: FONT_UI,
            fontSize: '16px',
            fontStyle: 'bold',
            color: '#f59e0b'
        }).setOrigin(0.5).setDepth(21);

        const rankTxt = this.add.text(W / 2, 170, rank.title, {
            fontFamily: FONT_UI,
            fontSize: rank.title.length > 13 ? '22px' : '26px',
            fontStyle: '900',
            color: rank.color,
            stroke: '#000',
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(21).setShadow(4, 4, '#000', 0, true, false);

        this.add.text(W / 2, 214, '最終總得分', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#a8a29e'
        }).setOrigin(0.5).setDepth(21);

        const scoreNum = this.add.text(W / 2, 268, '0', {
            fontFamily: FONT_NUM,
            fontSize: '72px',
            fontStyle: '900',
            color: '#fef08a',
            stroke: '#000',
            strokeThickness: 7
        }).setOrigin(0.5).setDepth(21).setShadow(5, 5, '#000', 0, true, false);

        const spotCard = this.createSpotCard(W, 328, res);

        const statY = 446;
        const stats = [
            { label: '🛏 守住 C 位', val: `${res.heldHours} / 12 小時` },
            { label: '😴 理直氣壯好眠', val: `${res.sleepHours} 小時（最高連睡 ${res.maxCombo}）` },
            { label: '🚨 被趕走 / 💢 被擠走', val: `${res.evictCount} 次 / ${res.squeezeCount} 次` }
        ];

        const statRows = stats.map((st, i) => {
            const y = statY + i * 46;
            return [
                this.add.rectangle(W / 2, y, W - 84, 38, 0x161b26, 0.92).setStrokeStyle(2, 0x000000).setDepth(21),
                this.add.text(56, y, st.label, {
                    fontFamily: FONT_UI, fontSize: '14px', color: '#d6d3d1'
                }).setOrigin(0, 0.5).setDepth(22),
                this.add.text(W - 56, y, st.val, {
                    fontFamily: FONT_UI, fontSize: '15px', fontStyle: 'bold', color: '#fbbf24'
                }).setOrigin(1, 0.5).setDepth(22)
            ];
        });
        statRows.unshift(spotCard);

        const quoteFont = `italic bold 14px ${FONT_UI}`;
        drawComicPanel(this, 42, 575, W - 84, 70, { fill: PAPER, alpha: 0.97, shadow: 5, halftone: true, depth: 21 });
        this.add.text(W / 2, 610, wrapCJK(rank.quote, quoteFont, W - 116), {
            fontFamily: FONT_UI,
            fontSize: '14px',
            fontStyle: 'italic bold',
            color: INK,
            align: 'center',
            lineSpacing: 4
        }).setOrigin(0.5).setDepth(22);

        this.createShareButton(W, 694);

        const btnRetry = createComicButton(this, W / 2, 770, W - 84, 52, '再睡一晚 (重選過夜位子)', { fontSize: '19px', icon: true, iconScale: 1.1 });
        btnRetry.on('pointerdown', () => {
            audioEngine.playCardboardFlop();
            this.scene.start('SelectSpotScene');
        });

        const btnHome = createComicButton(this, W / 2, 834, W - 84, 44, '🎬 回到遊戲封面', {
            fill: 0x1f2937,
            color: '#e5e7eb',
            fontSize: '16px',
            shadow: 5,
            shine: 0.06
        });
        btnHome.on('pointerdown', () => {
            this.scene.start('CoverScene');
        });

        // 進場動畫：評等蓋章、分數跳動、統計逐列滑入
        rankTxt.setScale(2.2).setAlpha(0);
        this.tweens.add({
            targets: rankTxt,
            scale: 1,
            alpha: 1,
            delay: 250,
            duration: 380,
            ease: 'Back.easeOut',
            onComplete: () => this.cameras.main.shake(140, 0.006)
        });
        this.tweens.addCounter({
            from: 0,
            to: res.score,
            delay: 300,
            duration: 1200,
            ease: 'Cubic.easeOut',
            onUpdate: (tween) => scoreNum.setText(`${Math.floor(tween.getValue())}`)
        });
        statRows.forEach((row, i) => {
            row.forEach(o => {
                const targetX = o.x;
                o.setAlpha(0).setX(targetX + 40);
                this.tweens.add({ targets: o, alpha: 1, x: targetX, delay: 500 + i * 110, duration: 280, ease: 'Quad.easeOut' });
            });
        });
    }

    createShareButton(W, y) {
        const btn = createComicButton(this, W / 2, y, W - 84, 46, '📣 分享戰績', {
            fill: 0xb91c1c, color: '#ffffff', fontSize: '19px', shadow: 4, border: 2.5, shine: 0.12, depth: 25
        });
        // 手機上要等手指放開（touchend）才算使用者操作，下載才不會被擋
        btn.on('pointerup', () => this.downloadShareImage());
    }

    // shareImage：null = 產生中、false = 失敗、File = 好了
    makeShareImage() {
        this.shareImage = null;
        ShareKit.makeImage(this.shareResult)
            .then(file => { this.shareImage = file; })
            .catch(() => { this.shareImage = false; });
    }

    downloadShareImage() {
        const file = this.shareImage;
        if (file === false) {
            this.makeShareImage();
            this.showToast('戰績圖產生失敗，正在重新產生\n請稍後再按一次');
            return;
        }
        if (!file) {
            this.showToast('戰績圖還在產生中，請再按一次');
            return;
        }
        ShareKit.download(file);
        this.showToast(ShareKit.isMobile()
            ? '戰績圖已下載，想分享到哪裡都可以！\niPhone 存在「檔案」App；下載不了請改用 Safari／Chrome 開啟'
            : '戰績圖已下載，想分享到哪裡都可以！', 6000);
    }

    showToast(msg, duration = 4200) {
        if (this.toast) this.toast.destroy();
        const text = this.add.text(0, 0, msg, {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#fef3c7', align: 'center', lineSpacing: 3
        }).setOrigin(0.5);
        const bg = this.add.rectangle(0, 0, text.width + 28, text.height + 14, 0x0b0e14, 0.94).setStrokeStyle(2, 0xf59e0b, 0.9);
        this.toast = this.add.container(GAME_W / 2, 918, [bg, text]).setDepth(60).setAlpha(0);
        this.tweens.add({ targets: this.toast, alpha: 1, duration: 160 });
        this.tweens.add({ targets: this.toast, alpha: 0, delay: duration, duration: 400 });
    }

    // 今晚睡的位子（top 為卡片上緣），回傳組成的所有物件，進場動畫用
    createSpotCard(W, top, res) {
        const spot = res.spot;
        const x = 42;
        const w = W - 84;
        const h = 90;
        const color = hexColor(spot.badgeColor);
        const parts = drawComicPanel(this, x, top, w, h, {
            fill: 0x161b26, alpha: 0.95, shadow: 5, border: 2.5, accent: color, accentAlpha: 0.55, depth: 21
        });
        parts.push(this.add.rectangle(x, top + h / 2, 8, h, color, 1).setOrigin(0, 0.5).setDepth(22));

        const left = x + 18;
        const right = x + w - 18;
        const row1 = top + 18;
        const row2 = top + 46;
        const row3 = top + 74;

        const label = this.add.text(left, row1, '阿睿今晚睡在', {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#a8a29e'
        }).setOrigin(0, 0.5).setDepth(22);
        parts.push(label, ...placeIconBeforeText(this, label, left, row1, 0));

        parts.push(
            this.add.text(right, row1, `${spot.difficultyLabel} ${spot.stars}`, {
                fontFamily: FONT_UI, fontSize: '12px', fontStyle: '900', color: spot.badgeColor
            }).setOrigin(1, 0.5).setDepth(22),
            this.add.text(left, row2, `【${spot.name}】`, {
                fontFamily: FONT_UI, fontSize: '22px', fontStyle: '900', color: spot.badgeColor, stroke: '#000', strokeThickness: 4
            }).setOrigin(0, 0.5).setDepth(22),
            this.add.image(right, row2, 'icon-bench').setOrigin(1, 0.5).setScale(1.5 / BENCH_ICON.res).setDepth(22),
            this.add.text(left, row3, spot.subtitle, {
                fontFamily: FONT_UI, fontSize: '12px', color: '#d6d3d1'
            }).setOrigin(0, 0.5).setDepth(22),
            this.add.text(right, row3, `得分倍率 x${spot.scoreMultiplier.toFixed(1)}`, {
                fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#fbbf24'
            }).setOrigin(1, 0.5).setDepth(22)
        );
        return parts;
    }
}
