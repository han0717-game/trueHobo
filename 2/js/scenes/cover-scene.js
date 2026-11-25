// ----------------------------------------------------------------------------
// SCENE B: COVER SCENE（遊戲封面：土地公廟前的 C 位長椅 + 持續不斷電搖滾配樂）
// ----------------------------------------------------------------------------
class CoverScene extends Phaser.Scene {
    constructor() {
        super({ key: 'CoverScene' });
    }

    create() {
        setupView(this);
        const W = GAME_W;
        const H = GAME_H;
        const fx = ART_FX.img0;

        // 1. 封面原圖：以 C 位長椅為定點緩慢推近
        this.coverImg = addArtImage(this, 'img0');
        kenBurns(this, this.coverImg, fx.bench, 1.05, 9000, true);
        this.artFx = addNeonGlow(this, fx.lanterns, 2);

        // C 位長椅的金光、手電筒光暈
        const benchGlow = this.add.image(fx.bench.x, fx.bench.y - 10, glowKey(this, 0xffc46b))
            .setBlendMode(ADD).setDisplaySize(380, 150).setDepth(4);
        this.tweens.add({ targets: benchGlow, alpha: { from: 0.2, to: 0.5 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        const beamGlow = this.add.image(fx.beam.x - 10, fx.beam.y, glowKey(this, 0xfff4c2))
            .setBlendMode(ADD).setScale(0.5).setDepth(4);
        this.tweens.add({ targets: beamGlow, alpha: { from: 0.4, to: 0.9 }, duration: 260, yoyo: true, repeat: -1 });
        const moonGlow = this.add.image(fx.moon.x, fx.moon.y, glowKey(this, 0xfff1c2)).setBlendMode(ADD).setScale(1.1).setAlpha(0.25).setDepth(4);
        this.artFx.push(trackArt(benchGlow), trackArt(beamGlow), trackArt(moonGlow));

        addRain(this, { density: 0.6 });
        addFilmFinish(this);

        // 2. 封面影片（有放 video/video.mp4 才會有）：解出畫面後淡入，聲音用影片原聲
        this.videoImg = null;
        this.imageOnlyFx = [...this.artFx];
        if (CoverVideo.start()) {
            audioEngine.duckBGM = true;
        } else {
            audioEngine.duckBGM = false;
            audioEngine.startContinuousBGM();
        }
        this.events.once('shutdown', () => CoverVideo.stop());

        // 上下壓暗：標題放在下方，不擋住長椅
        this.add.image(W / 2, 0, shadeKey(this, '0,0,0', 0.6, 0)).setOrigin(0.5, 0).setDisplaySize(W, 90).setDepth(10);
        this.add.image(W / 2, H, shadeKey(this, '5,6,10', 0, 0.95)).setOrigin(0.5, 1).setDisplaySize(W, 470).setDepth(10);

        const tagTxt = this.add.text(W / 2, 588, '【 街友本色 二部曲 公園C位爭奪戰 】', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#fbbf24'
        }).setOrigin(0.5).setShadow(2, 2, '#000', 4).setDepth(12);

        // 遊戲名稱：街友本色 II - 公園C位爭奪戰 / True Hobo II: Bench Brawl
        const titleY = 648;
        const titleMain = this.add.text(0, titleY, '街友本色', {
            fontFamily: FONT_TITLE,
            fontSize: '80px',
            fontStyle: '900',
            color: '#f59e0b',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setAngle(-3).setShadow(6, 6, '#000000', 0, true, false).setDepth(12);
        const titleGrad = titleMain.context.createLinearGradient(0, 0, 0, titleMain.height);
        titleGrad.addColorStop(0, '#fff3b0');
        titleGrad.addColorStop(0.45, '#fbbf24');
        titleGrad.addColorStop(1, '#ea580c');
        titleMain.setFill(titleGrad);

        // 續作編號「II」用紅色襯線字蓋在主標右側
        const titleNum = this.add.text(0, titleY, 'II', {
            fontFamily: FONT_TITLE,
            fontSize: '88px',
            fontStyle: '900',
            color: '#ef4444',
            stroke: '#000000',
            strokeThickness: 10
        }).setOrigin(0.5).setAngle(-3).setShadow(6, 6, '#000000', 0, true, false).setDepth(13);
        const numGrad = titleNum.context.createLinearGradient(0, 0, 0, titleNum.height);
        numGrad.addColorStop(0, '#fecaca');
        numGrad.addColorStop(0.5, '#ef4444');
        numGrad.addColorStop(1, '#991b1b');
        titleNum.setFill(numGrad);

        const numGap = 8;
        const groupW = titleMain.width + numGap + titleNum.width;
        titleMain.x = W / 2 - groupW / 2 + titleMain.width / 2;
        const numDx = titleMain.width / 2 + numGap + titleNum.width / 2;
        titleNum.setPosition(titleMain.x + numDx, titleY - numDx * Math.tan(Phaser.Math.DegToRad(3)));

        const subTitle = addTagLabel(this, W / 2, 716, '公園C位爭奪戰', {
            fontFamily: FONT_TITLE,
            fontSize: '24px',
            fill: 0xb91c1c,
            color: '#fef2f2',
            angle: 1.5,
            padX: 20,
            padY: 3,
            depth: 12
        });

        const titleEn = this.add.text(W / 2, 760, 'True Hobo II: Bench Brawl', {
            fontFamily: FONT_TITLE,
            fontSize: '25px',
            fontStyle: '900',
            color: '#fde68a',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setShadow(3, 3, '#000000', 0, true, false).setDepth(12);

        const blurb = this.add.text(W / 2, 808, '霸佔 C 位十年的阿土伯退休了，寒流夜全公園都在搶…\n壓住攤開佔位、放開縮起來裝無辜，撐到天亮！', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            color: '#e7e5e4',
            align: 'center',
            lineSpacing: 6
        }).setOrigin(0.5).setShadow(1, 2, '#000', 3).setDepth(12);

        const btnStart = createComicButton(this, W / 2, 870, 290, 60, '點擊進入遊戲', { fontSize: '24px', depth: 13, icon: true, iconScale: 1.3 });
        this.tweens.add({
            targets: btnStart,
            scale: 1.05,
            duration: 650,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // 標題蓋章式登場，續作編號「II」隨後再蓋一次
        titleMain.setScale(1.7).setAlpha(0);
        titleNum.setScale(2.6).setAlpha(0);
        [tagTxt, subTitle, titleEn, blurb].forEach(o => o.setAlpha(0));
        this.tweens.add({
            targets: titleMain,
            scale: 1,
            alpha: 1,
            delay: 250,
            duration: 420,
            ease: 'Back.easeOut',
            onComplete: () => this.cameras.main.shake(160, 0.006)
        });
        this.tweens.add({
            targets: titleNum,
            scale: 1,
            alpha: 1,
            delay: 700,
            duration: 260,
            ease: 'Back.easeOut',
            onComplete: () => this.cameras.main.shake(120, 0.005)
        });
        this.tweens.add({ targets: [tagTxt, subTitle, titleEn, blurb], alpha: 1, delay: 900, duration: 500 });

        // 點擊畫面任意處進入劇情
        let entering = false;
        const handleStart = () => {
            if (entering) return;
            entering = true;
            audioEngine.duckBGM = false;
            audioEngine.startContinuousBGM();
            audioEngine.playCardboardFlop();

            const v = CoverVideo.el;
            if (v) {
                this.tweens.addCounter({ from: v.volume, to: 0, duration: 450, onUpdate: t => { v.volume = t.getValue(); } });
            }

            this.cameras.main.fadeOut(450, 0, 0, 0);
            this.time.delayedCall(460, () => {
                this.scene.start('StoryScene');
            });
        };

        this.input.once('pointerdown', handleStart);
        btnStart.once('pointerdown', handleStart);
    }

    update() {
        syncToArt(this.coverImg, this.artFx);
        this.updateCoverVideo();
    }

    updateCoverVideo() {
        const v = CoverVideo.el;
        if (!v) {
            // 影片載入失敗（或根本沒放）：改回合成搖滾配樂
            if (audioEngine.duckBGM) {
                audioEngine.duckBGM = false;
                audioEngine.startContinuousBGM();
            }
            return;
        }
        if (v.readyState < 2) return;

        if (!this.videoImg) {
            if (!this.textures.exists('coverVideo')) {
                this.textures.create('coverVideo', v, v.videoWidth, v.videoHeight).add('__BASE', 0, 0, 0, v.videoWidth, v.videoHeight);
            }
            this.videoImg = fitCover(this.add.image(GAME_W / 2, GAME_H / 2, 'coverVideo')).setDepth(6).setAlpha(0);
            this.tweens.add({
                targets: this.videoImg,
                alpha: 1,
                duration: 600,
                onComplete: () => this.imageOnlyFx.forEach(o => o.setVisible(false))
            });
            this.videoFrameTime = -1;
        }
        if (v.currentTime !== this.videoFrameTime) {
            this.videoFrameTime = v.currentTime;
            this.textures.get('coverVideo').source[0].update();
        }
    }
}
