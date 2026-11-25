// ----------------------------------------------------------------------------
// SCENE E: MAIN GAMEPLAY（60 秒 = 一整晚：壓住攤開佔位、放開縮起來裝無辜，守住 C 位撐到天亮）
// 規則說明見 data.js 開頭
// ----------------------------------------------------------------------------

// 天色：依過了幾秒，在這幾個顏色之間漸變（黃昏橘 → 深夜藍 → 清晨紫 → 天亮金）
const SKY_KEYS = [
    [0, 0xf97316, 0.2],
    [7, 0x1e3a8a, 0.18],
    [15, 0x0b1440, 0.3],
    [50, 0x0b1440, 0.3],
    [55, 0x7c3aed, 0.16],
    [60, 0xfbbf24, 0.24]
];

function approach(v, target, step) {
    return v < target ? Math.min(target, v + step) : Math.max(target, v - step);
}

function skyAt(elapsed) {
    for (let i = 1; i < SKY_KEYS.length; i++) {
        const [t1, c1, a1] = SKY_KEYS[i];
        if (elapsed <= t1) {
            const [t0, c0, a0] = SKY_KEYS[i - 1];
            const k = (elapsed - t0) / (t1 - t0);
            const A = Phaser.Display.Color.IntegerToColor(c0);
            const B = Phaser.Display.Color.IntegerToColor(c1);
            const mix = Phaser.Display.Color.Interpolate.ColorWithColor(A, B, 100, k * 100);
            return { color: Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b), alpha: a0 + (a1 - a0) * k };
        }
    }
    const last = SKY_KEYS[SKY_KEYS.length - 1];
    return { color: last[1], alpha: last[2] };
}

function clockText(elapsed) {
    const totalMin = Math.floor((elapsed / SEC_PER_HOUR) * 6) * 10;
    const h = (NIGHT.startHour + Math.floor(totalMin / 60)) % 24;
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

class PlayScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PlayScene' });
    }

    create() {
        setupView(this);
        const spot = this.spot = GAME_STATE.selectedSpot;
        this.cameras.main.fadeIn(300, 0, 0, 0);

        this.timeLeft = NIGHT.seconds;
        this.score = 0;
        this.spread = SPREAD.start;       // 囂張值 0 ~ 100
        this.isSpreading = false;
        this.stunned = false;             // 被趕走 / 被擠走後的硬直
        this.stunTarget = 0;
        this.lastPenalty = null;
        this.ceiling = 100;               // 驅離線（動畫中的實際位置）
        this.floor = SPREAD.baseFloor;    // 擠位線
        this.squeezeTime = 0;             // 縮在擠位線下多久了
        this.squeezeGrace = SPREAD.idleGrace;
        this.lineInfo = null;
        this.evictCount = 0;
        this.squeezeCount = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.sleepStreak = 0;
        this.sleepStreakNext = SLEEP_STREAK.hits;
        this.zoneTime = 0;
        this.heldTime = 0;
        this.isGameOver = false;
        this.holdRingColor = null;
        this.poseIdx = -1;
        this.nextBreath = 0;
        this.nextZ = 0;
        // 注意：Phaser 場景本身有 this.events，事件表不能取這個名字
        this.nightEvents = buildNightEvents(spot);
        this.banner = null;
        this.beamActor = null;
        this.beamSweep = { v: 0 };
        // 屁死彩蛋：這一晚會不會掉、掉幾根、什麼時候掉，開局先抽好
        this.pisi = null;
        this.pisiTimes = [];
        for (const chance of PISI_BONUS.chances) {
            if (Math.random() >= chance) break;
            this.pisiTimes.push(Phaser.Math.FloatBetween(PISI_BONUS.window[0], PISI_BONUS.window[1]));
        }
        this.pisiTimes.sort((a, b) => a - b);

        this.createStage();
        this.createHoldZone();
        this.createHUD();
        this.createGauge();
        this.createBurst();

        this.rerollZoneBonus();
        this.time.addEvent({ delay: ZONE_BONUS.rerollMs, loop: true, callback: () => this.rerollZoneBonus() });

        // 開場教學
        this.time.delayedCall(250, () => {
            if (this.isGameOver) return;
            const tag = this.showBanner('👆 壓住圈圈＝攤開佔位，放開＝縮起來！', 'info');
            this.time.delayedCall(2500, () => this.hideBanner(tag));
        });
    }

    // ------------------------------------------------------------------
    // 場景：背景、阿睿的姿勢、天色、燈光、特效
    // ------------------------------------------------------------------
    createStage() {
        const W = GAME_W;
        const H = GAME_H;
        const realPoses = [5, 6, 7, 8].every(n => this.textures.exists(`img${n}`));
        if (realPoses) {
            // 有真的四張姿勢全版圖：交叉淡入（頭的位置要依真圖重新量，先放在長椅左側）
            this.poseImgs = [5, 6, 7, 8].map((n, i) => addArtImage(this, `img${n}`, 1 + i * 0.01).setAlpha(0));
            this.poseBaseScale = this.poseImgs.map(img => img.baseScale);
            this.headPos = () => ({ x: BENCH.x - 110, y: BENCH.seatY - 100 });
        } else {
            addArtImage(this, ComicArtGenerator.spotBackdropKey(this, this.spot), 0);
            const ox = POSE_SPRITE.w / 2;
            const oy = POSE_SPRITE.seatY;
            this.poseImgs = [0, 1, 2, 3].map(i => this.add.image(BENCH.x, BENCH.seatY, `pose-${i}`)
                .setOrigin(0.5, oy / POSE_SPRITE.h)
                .setScale(1 / ART_RES)
                .setDepth(1 + i * 0.01)
                .setAlpha(0));
            this.poseBaseScale = this.poseImgs.map(() => 1 / ART_RES);
            this.headPos = i => ({
                x: BENCH.x + POSE_SPRITE.heads[i].x - ox,
                y: BENCH.seatY + POSE_SPRITE.heads[i].y - oy
            });
        }
        // 被趕走時的反應圖、打呼爽臉（選填）
        this.imgHit = this.textures.exists('img9') ? addArtImage(this, 'img9', 1.5).setAlpha(0) : null;
        this.imgJoy = this.textures.exists('img10') ? addArtImage(this, 'img10', 1.4).setAlpha(0) : null;

        // 路燈、月亮
        addLampGlow(this, ART_FX.stage.lamp, 7);
        const moon = this.add.image(ART_FX.stage.moon.x, ART_FX.stage.moon.y, glowKey(this, 0xfff1c2)).setBlendMode(ADD).setScale(0.8).setAlpha(0.3).setDepth(7);
        this.tweens.add({ targets: moon, alpha: 0.18, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        // 天色（隨時間變化）
        this.skyTint = this.add.rectangle(W / 2, H / 2, W, H, 0xf97316, 0.2).setDepth(6);

        // 寒流的白霧、打呼的 Z
        this.breath = this.add.particles(0, 0, 'fx-smoke', {
            speedX: { min: 10, max: 26 },
            speedY: { min: -26, max: -12 },
            scale: { start: 0.05, end: 0.3 },
            alpha: { start: 0.4, end: 0 },
            rotate: { min: 0, max: 360 },
            lifespan: 1500,
            emitting: false,
            tint: 0xe6edf3
        }).setDepth(5);

        // 自動灑水器（不一定會噴）
        this.sprinklerHeads = [];
        this.sprinklers = [110, 270, 430].map(x => {
            const head = this.add.rectangle(x, 712, 12, 14, 0x6b7280, 1).setStrokeStyle(2, 0x000000).setDepth(5).setAlpha(0);
            this.sprinklerHeads.push(head);
            return this.add.particles(x, 704, 'fx-drop', {
                angle: { min: -155, max: -25 },
                speed: { min: 260, max: 440 },
                gravityY: 900,
                lifespan: 950,
                scale: { start: 0.5, end: 0.2 },
                alpha: { start: 0.9, end: 0 },
                frequency: 16,
                quantity: 2,
                emitting: false
            }).setDepth(7);
        });

        // 手電筒光束
        this.beam = this.add.image(0, 0, 'fx-beam').setOrigin(0, 0.5).setBlendMode(ADD).setAlpha(0).setDepth(7);
        this.beamSpot = this.add.image(0, 0, glowKey(this, 0xfff4c2)).setBlendMode(ADD).setScale(0.9).setAlpha(0).setDepth(7);

        addRain(this, { density: 0.35 });
        addFilmFinish(this, { vignette: 0.5 });

        this.damageFlash = this.add.rectangle(W / 2, H / 2, W, H, 0xff0000, 1).setAlpha(0).setDepth(30);
        this.redVignette = this.add.image(W / 2, H / 2, 'fx-vignette-red').setDisplaySize(W, H).setAlpha(0).setDepth(30);
    }

    createHoldZone() {
        this.holdCenterX = BENCH.x;
        this.holdCenterY = BENCH.seatY - 10;
        this.holdRadius = Math.min(GAME_W, GAME_H) * 0.19;

        this.holdZone = this.add.container(this.holdCenterX, this.holdCenterY).setDepth(15);
        this.holdRing = this.add.graphics();
        this.holdCore = this.add.image(0, 0, glowKey(this, 0xffb347)).setBlendMode(ADD).setScale(0.55).setAlpha(0.45);
        const holdDot = this.add.circle(0, 0, 9, 0xfff3c4, 0.95).setStrokeStyle(3, 0x000000, 0.9);
        this.holdZone.add([this.add.circle(0, 0, this.holdRadius, 0xffffff, 0.05), this.holdRing, this.holdCore, holdDot]);
        this.drawHoldRing(0xfbbf24);
        this.tweens.add({ targets: this.holdRing, angle: 360, duration: 9000, repeat: -1 });
        this.tweens.add({ targets: this.holdCore, scale: 0.8, alpha: 0.25, duration: 650, yoyo: true, repeat: -1 });

        this.holdLabel = this.add.text(this.holdCenterX, this.holdCenterY + this.holdRadius + 24, '👆 壓住＝攤開佔位\n放開＝縮起來裝無辜', {
            fontFamily: FONT_UI,
            fontSize: '14px',
            fontStyle: '900',
            color: '#fef08a',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(16);

        // 滑鼠、手指共用
        this.input.on('pointerdown', (pointer) => {
            if (this.tryPickPisi(pointer)) return;
            this.checkPointerHold(pointer, true);
        });
        this.input.on('pointermove', (pointer) => {
            if (pointer.isDown) this.checkPointerHold(pointer, false);
        });
        this.input.on('pointerup', () => this.stopSpreading());
        this.input.on('pointerupoutside', () => this.stopSpreading());
    }

    drawHoldRing(color) {
        const g = this.holdRing;
        const r = this.holdRadius;
        const seg = 16;
        g.clear();
        for (let i = 0; i < seg; i++) {
            const a0 = (i / seg) * Math.PI * 2;
            const a1 = a0 + (Math.PI * 2 / seg) * 0.6;
            g.lineStyle(8, 0x000000, 0.7);
            g.beginPath();
            g.arc(0, 0, r, a0, a1);
            g.strokePath();
            g.lineStyle(4, color, 0.95);
            g.beginPath();
            g.arc(0, 0, r, a0, a1);
            g.strokePath();
        }
        this.holdRingColor = color;
    }

    createHUD() {
        const W = GAME_W;
        const spot = this.spot;
        const top = 44;
        drawComicPanel(this, 10, top, W - 20, 116, { fill: 0x0b0e14, alpha: 0.88, accent: 0x818cf8, accentAlpha: 0.45, shadow: 5, depth: 20 });

        this.add.text(26, top + 12, '⏰ 現在時間', {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#9ca3af'
        }).setDepth(21);
        this.clockTxt = this.add.text(24, top + 26, '18:00', {
            fontFamily: FONT_NUM, fontSize: '38px', fontStyle: '900', color: '#fbbf24', stroke: '#000000', strokeThickness: 5
        }).setDepth(21);

        this.add.text(W - 26, top + 12, `🏆 總分 (${spot.name} x${spot.scoreMultiplier})`, {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#9ca3af'
        }).setOrigin(1, 0).setDepth(21);
        this.scoreTxt = this.add.text(W - 24, top + 23, '0', {
            fontFamily: FONT_NUM, fontSize: '42px', fontStyle: '900', color: '#4ade80', stroke: '#000000', strokeThickness: 5
        }).setOrigin(1, 0).setDepth(21);
        this.comboTxt = this.add.text(W - 26, top + 78, '', {
            fontFamily: FONT_UI, fontSize: '13px', fontStyle: '900', color: '#c4b5fd', stroke: '#000000', strokeThickness: 3
        }).setOrigin(1, 0).setDepth(21);

        // 天亮倒數：月亮從 18:00 走到 06:00
        const barY = top + 91;
        this.add.text(26, top + 82, '天亮倒數', {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: 'bold', color: '#d6d3d1'
        }).setDepth(21);
        this.nightBar = { x: 90, y: barY, w: 176 };
        this.add.rectangle(this.nightBar.x, barY, this.nightBar.w, 8, 0x1e293b, 1).setOrigin(0, 0.5).setStrokeStyle(2, 0x000000).setDepth(21);
        this.nightFill = this.add.rectangle(this.nightBar.x, barY, 0, 8, 0x818cf8, 1).setOrigin(0, 0.5).setDepth(21);
        this.nightMarker = this.add.text(this.nightBar.x, barY, '☾', {
            fontFamily: FONT_UI, fontSize: '16px', fontStyle: '900', color: '#fde68a', stroke: '#000', strokeThickness: 3
        }).setOrigin(0.5).setDepth(22);
        this.add.text(this.nightBar.x + this.nightBar.w + 8, barY, '06:00 ☀', {
            fontFamily: FONT_UI, fontSize: '11px', fontStyle: 'bold', color: '#fbbf24'
        }).setOrigin(0, 0.5).setDepth(21);
    }

    // 右邊的囂張值計量表：驅離線（紅）、擠位線（藍）、理直氣壯區（金）都會移動，每格重畫
    createGauge() {
        const W = GAME_W;
        const H = GAME_H;
        const gx = W - 36;
        const gy = H * 0.55;
        const gh = 300;
        const gw = 22;
        const top = gy - gh / 2;
        const bottom = gy + gh / 2;
        this.gauge = { x: gx, top, bottom, h: gh, w: gw, left: gx - gw / 2 };

        this.gaugeDanger = this.add.image(gx, gy, glowKey(this, 0xff2200)).setBlendMode(ADD).setDisplaySize(gw * 5, gh * 1.3).setAlpha(0).setDepth(19);
        this.gaugeSqueeze = this.add.image(gx, gy, glowKey(this, 0x3b82f6)).setBlendMode(ADD).setDisplaySize(gw * 5, gh * 1.3).setAlpha(0).setDepth(19);

        const frame = this.add.graphics().setDepth(20);
        frame.fillStyle(0x000000, 0.85);
        frame.fillRoundedRect(gx - gw / 2 - 6 + 4, top - 6 + 4, gw + 12, gh + 12, 10);
        frame.fillStyle(0x0b0e14, 0.94);
        frame.fillRoundedRect(gx - gw / 2 - 6, top - 6, gw + 12, gh + 12, 10);
        frame.lineStyle(3, 0x000000, 1);
        frame.strokeRoundedRect(gx - gw / 2 - 6, top - 6, gw + 12, gh + 12, 10);

        this.gaugeGfx = this.add.graphics().setDepth(21);

        const ticks = this.add.graphics().setDepth(22);
        ticks.lineStyle(1, 0xffffff, 0.14);
        for (let i = 1; i < 10; i++) {
            const ty = bottom - (gh * i) / 10;
            ticks.lineBetween(gx - gw / 2, ty, gx + gw / 2, ty);
        }

        this.spreadMarker = this.add.rectangle(gx, bottom, gw + 10, 4, 0xffffff, 1).setStrokeStyle(1.5, 0x000000).setDepth(23);

        const labelStyle = (color, size = '11px') => ({
            fontFamily: FONT_UI, fontSize: size, fontStyle: '900', color, stroke: '#000', strokeThickness: 3
        });
        this.zoneLabel = this.add.text(0, 0, '理直氣壯', labelStyle('#fde047', '10px')).setOrigin(1, 0.5).setDepth(22);
        this.zoneBonusTxt = this.add.text(0, 0, '', { ...labelStyle('#fde047', '16px'), strokeThickness: 4 }).setOrigin(1, 0.5).setDepth(22);
        this.ceilLabel = this.add.text(0, 0, '驅離線', labelStyle('#fca5a5')).setOrigin(1, 1).setDepth(22);
        this.floorLabel = this.add.text(0, 0, '擠位線', labelStyle('#93c5fd')).setOrigin(1, 0).setDepth(22);

        this.add.text(gx, top - 24, '😤 囂張值', {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: '900', color: '#fbbf24', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(22);
        this.spreadPctTxt = this.add.text(gx, bottom + 22, '', {
            fontFamily: FONT_NUM, fontSize: '18px', fontStyle: '900', color: '#ffffff', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(22);

        // 底部狀態列：縮太久的危險條（藍）+ 提示文字
        drawComicPanel(this, 18, H - 58, W - 36, 40, { fill: 0x0b0e14, alpha: 0.9, shadow: 4, depth: 20 });
        this.squeezeBar = this.add.rectangle(22, H - 38, 0, 32, 0x3b82f6, 0.55).setOrigin(0, 0.5).setDepth(21);
        this.statusTxt = this.add.text(W / 2, H - 38, '', {
            fontFamily: FONT_UI,
            fontSize: '13px',
            fontStyle: 'bold',
            color: '#e7e5e4'
        }).setOrigin(0.5).setDepth(22);
    }

    gaugeY(v) {
        return this.gauge.bottom - (Phaser.Math.Clamp(v, 0, 100) / 100) * this.gauge.h;
    }

    // 被趕 / 被擠時的漫畫爆炸對話框，尾巴指向阿睿
    createBurst() {
        const bx = 330;
        const by = 330;
        const head = this.headPos(1);
        this.burst = this.add.container(bx, by).setDepth(40).setAlpha(0);
        const g = this.add.graphics();
        drawShoutBurst(g, 280, 190, { baseX: -60, baseY: 75, x: head.x - bx, y: head.y - 30 - by });
        this.sbText = this.add.text(0, -16, '', {
            fontFamily: FONT_UI, fontSize: '19px', fontStyle: '900', color: '#c81e1e', align: 'center', lineSpacing: 2
        }).setOrigin(0.5);
        this.sbSub = this.add.text(0, 36, '', {
            fontFamily: FONT_UI, fontSize: '14px', fontStyle: '900', color: INK
        }).setOrigin(0.5);
        this.burst.add([g, this.sbText, this.sbSub]);
    }

    rerollZoneBonus() {
        if (this.isGameOver) return;
        const m = rollZoneBonus();
        this.zoneBonus = m;
        this.zoneBonusTxt
            .setText(`x${m.toFixed(1)}`)
            .setColor(m >= 1.8 ? '#fb923c' : (m >= 1.5 ? '#facc15' : '#fef3c7'));
        this.tweens.killTweensOf(this.zoneBonusTxt);
        this.zoneBonusTxt.setScale(1.25);
        this.tweens.add({ targets: this.zoneBonusTxt, scale: 1, duration: 140, ease: 'Quad.easeOut' });
    }

    // ------------------------------------------------------------------
    // 操作
    // ------------------------------------------------------------------
    checkPointerHold(pointer, isInitialDown) {
        if (this.isGameOver || this.stunned) return;
        const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const dist = Phaser.Math.Distance.Between(p.x, p.y, this.holdCenterX, this.holdCenterY);
        if (dist <= this.holdRadius * 1.15) {
            if (!this.isSpreading) {
                this.isSpreading = true;
                if (isInitialDown) audioEngine.init();
            }
        } else {
            this.stopSpreading();
        }
    }

    stopSpreading() {
        this.isSpreading = false;
        audioEngine.setSpreadSound(false);
    }

    // ------------------------------------------------------------------
    // 一整晚的事件
    // ------------------------------------------------------------------
    showBanner(text, kind) {
        const fill = { ceiling: 0x991b1b, floor: 0x1e3a8a, dawn: 0x92400e, info: 0x111827 }[kind] ?? 0x111827;
        if (this.banner) this.hideBanner(this.banner);
        const tag = addTagLabel(this, GAME_W / 2, 196, text, {
            fontSize: '16px', fill, color: '#ffffff', angle: -1.5, padX: 14, padY: 6, depth: 26
        });
        tag.setScale(0.5).setAlpha(0);
        this.tweens.add({ targets: tag, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
        this.banner = tag;
        return tag;
    }

    hideBanner(tag) {
        if (!tag || !tag.active || tag.hiding) return;
        tag.hiding = true;
        if (this.banner === tag) this.banner = null;
        this.tweens.add({ targets: tag, alpha: 0, y: tag.y - 14, duration: 260, onComplete: () => tag.destroy() });
    }

    updateNight(elapsed) {
        for (const ev of this.nightEvents) {
            if (ev.state === 'pending' && elapsed >= ev.at) this.warnEvent(ev);
            if (ev.state === 'warn' && elapsed >= ev.at + EVENT_WARN) this.startEvent(ev);
            if (ev.state === 'active') {
                if (ev.type === 'sprinkler' && ev.phase === 'spray' && elapsed >= ev.at + EVENT_WARN + SPRINKLER.spray) this.startScramble(ev);
                if (elapsed >= ev.at + EVENT_WARN + ev.dur) this.endEvent(ev);
            }
        }
        if (!this.pisi && this.pisiTimes.length && elapsed >= this.pisiTimes[0]) {
            this.pisiTimes.shift();
            this.spawnPisi();
        }
    }

    warnEvent(ev) {
        ev.state = 'warn';
        const def = NIGHT_CROWD[ev.who];
        audioEngine.playWarnChime(def.kind);
        ev.banner = this.showBanner(def.warn, ev.who === 'taichi' ? 'dawn' : def.kind);
        if (ev.type === 'sprinkler') {
            this.sprinklerHeads.forEach(h => this.tweens.add({ targets: h, alpha: 1, y: 706, duration: 300 }));
            ev.actors = [];
        } else {
            ev.actors = this.spawnGroup(ev.who, ev.count || 1);
        }
    }

    // 一次來好幾個人：每個人隨機從左邊或右邊進來，同一邊的第二個人站得更靠近長椅
    spawnGroup(who, count, speed = 1) {
        const perSide = { '-1': 0, '1': 0 };
        const actors = [];
        for (let i = 0; i < count; i++) {
            const side = Math.random() < 0.5 ? -1 : 1;
            actors.push(this.spawnActor(who, side, i * Phaser.Math.FloatBetween(0.15, 0.4), perSide[side] * 52, speed));
            perSide[side]++;
        }
        return actors;
    }

    startEvent(ev) {
        ev.state = 'active';
        if (ev.type === 'patrol') {
            this.beamOn(ev.actors[0]);
        } else if (ev.type === 'sprinkler') {
            ev.phase = 'spray';
            this.sprinklers.forEach(e => e.start());
            audioEngine.playSprinkler(SPRINKLER.spray);
            this.cameras.main.shake(200, 0.004);
        } else {
            // 搶位的人往長椅湊過去試探
            ev.actors.forEach((a, i) => {
                if (!a.active) return;
                this.tweens.add({ targets: a, x: a.standX - a.side * 26, duration: 420, delay: 300 + i * 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            });
        }
    }

    // 灑水停了：大風吹，大家衝回來搶位
    startScramble(ev) {
        ev.phase = 'scramble';
        this.sprinklers.forEach(e => e.stop());
        this.sprinklerHeads.forEach(h => this.tweens.add({ targets: h, alpha: 0, y: 712, duration: 300 }));
        const def = NIGHT_CROWD.sprinkler;
        audioEngine.playWarnChime('floor');
        this.hideBanner(ev.banner);
        ev.banner = this.showBanner(def.scramble, 'floor');
        // 衝回來的是誰、幾個人，也是依時段抽
        const hour = hourAt(NIGHT.seconds - this.timeLeft);
        ev.actors = [];
        for (let i = randomCount(SPRINKLER.rush); i > 0; i--) {
            ev.actors.push(...this.spawnGroup(pickRival(hour).who, 1, 2.2));
        }
    }

    endEvent(ev) {
        if (ev.state === 'done') return;
        ev.state = 'done';
        this.hideBanner(ev.banner);
        if (ev.type === 'patrol' && this.beamActor === ev.actors[0]) this.beamOff();
        if (ev.type === 'sprinkler') {
            this.sprinklers.forEach(e => e.stop());
            this.sprinklerHeads.forEach(h => this.tweens.add({ targets: h, alpha: 0, duration: 300 }));
        }
        (ev.actors || []).forEach((a, i) => this.dismissActor(a, i * 120));
    }

    // 事件讓驅離線降到哪裡（沒影響回傳 null）
    eventCeil(ev) {
        if (ev.type === 'patrol') return this.spot.patrolCeil;
        if (ev.type === 'sprinkler' && ev.phase !== 'scramble') return SPRINKLER.ceil;
        return null;
    }

    // 事件讓擠位線升到哪裡（晨運太極團比一般人兇）
    eventFloor(ev) {
        if (ev.type === 'rival') return ev.who === 'taichi' ? this.spot.dawnFloor : this.spot.rivalFloor;
        if (ev.type === 'sprinkler') return ev.phase === 'scramble' ? this.spot.rivalFloor : null;
        return null;
    }

    // 現在的驅離線 / 擠位線目標，以及預告中的虛線
    lineTargets(elapsed) {
        const out = {
            ceiling: 100, floor: SPREAD.baseFloor, grace: SPREAD.idleGrace,
            ceilCause: null, floorCause: null, ghostCeil: null, ghostFloor: null, hint: null
        };
        for (const ev of this.nightEvents) {
            if (ev.state !== 'warn' && ev.state !== 'active') continue;
            const c = this.eventCeil(ev);
            const f = this.eventFloor(ev, elapsed);
            if (ev.state === 'warn') {
                if (c !== null) out.ghostCeil = Math.min(out.ghostCeil ?? 100, c);
                if (f !== null) out.ghostFloor = Math.max(out.ghostFloor ?? 0, f);
                continue;
            }
            const def = NIGHT_CROWD[ev.who];
            const hint = ev.type === 'sprinkler' && ev.phase === 'scramble' ? def.scrambleHint : def.hint;
            if (c !== null && c < out.ceiling) {
                out.ceiling = c;
                out.ceilCause = ev;
                out.hint = { text: hint, kind: 'ceiling' };
            }
            if (f !== null && f > out.floor) {
                out.floor = f;
                out.floorCause = ev;
                out.grace = ev.type === 'sprinkler' ? SPREAD.scrambleGrace : SPREAD.rivalGrace;
                if (!out.hint) out.hint = { text: hint, kind: 'floor' };
            }
        }
        out.floor = Math.min(out.floor, out.ceiling - SPREAD.minWindow);
        return out;
    }

    // 路人從畫面左（side = -1）或右（side = 1）走進來，站在長椅旁
    spawnActor(who, side, delay = 0, offset = 0, speed = 1) {
        const def = NIGHT_CROWD[who];
        const standX = side < 0 ? 76 + offset : 424 - offset;
        const startX = side < 0 ? -90 : GAME_W + 90;
        const img = this.add.image(0, 0, def.tex).setOrigin(0.5, 1).setScale(1 / ART_RES).setFlipX(side > 0);
        const tagFill = def.kind === 'ceiling' ? 0x991b1b : (who === 'taichi' ? 0x92400e : 0x1e3a8a);
        const tag = addTagLabel(this, 0, -214, def.name, {
            fontSize: '12px', fill: tagFill, color: '#ffffff', padX: 7, padY: 2, shadow: 3, border: 2
        });
        const box = this.add.container(startX, GROUND_Y, [img, tag]).setDepth(4);
        box.side = side;
        box.who = who;
        box.standX = standX;
        box.img = img;
        const walkMs = (EVENT_WARN * 900) / speed;
        this.tweens.add({ targets: box, x: standX, duration: walkMs, delay: delay * 1000, ease: 'Sine.easeOut' });
        this.tweens.add({ targets: img, y: -6, duration: 150, yoyo: true, repeat: Math.max(1, Math.round(walkMs / 300)), delay: delay * 1000 });
        return box;
    }

    dismissActor(box, delay = 0) {
        if (!box || !box.active || box.leaving) return;
        box.leaving = true;
        this.tweens.killTweensOf(box);
        box.img.setFlipX(box.side < 0);
        const exitX = box.side < 0 ? -100 : GAME_W + 100;
        this.tweens.add({ targets: box, x: exitX, y: GROUND_Y, scale: 1, duration: 900, delay, ease: 'Sine.easeIn', onComplete: () => box.destroy() });
        this.tweens.add({ targets: box.img, y: -6, duration: 150, yoyo: true, repeat: 3, delay });
    }

    // 位子被坐走：搶位的人一屁股坐上長椅
    sitActor(box) {
        if (!box || !box.active) return;
        this.tweens.killTweensOf(box);
        this.tweens.add({ targets: box, x: BENCH.x + box.side * 118, y: BENCH.seatY + 96, scale: 0.92, duration: 260, ease: 'Back.easeOut' });
    }

    beamOn(actor) {
        if (!actor) return;
        this.beamActor = actor;
        this.tweens.killTweensOf(this.beamSweep);
        this.beamSweep.v = -0.22;
        this.tweens.add({ targets: this.beamSweep, v: 0.22, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.tweens.add({ targets: [this.beam, this.beamSpot], alpha: 0.85, duration: 200 });
    }

    beamOff() {
        this.beamActor = null;
        this.tweens.killTweensOf(this.beamSweep);
        this.tweens.add({ targets: [this.beam, this.beamSpot], alpha: 0, duration: 250 });
    }

    // 光束跟著巡守員的手，對著阿睿左右掃
    updateBeam() {
        const a = this.beamActor;
        if (!a || !a.active) return;
        const hand = NPC_SPRITES.patrol.beam;
        const s = a.scale;
        const hx = a.x + (hand.x - NPC_SIZE.w / 2) * -a.side * s;
        const hy = a.y - (NPC_SIZE.h - hand.y) * s;
        const head = this.headPos(Math.max(0, this.poseIdx));
        const sweep = this.stunned ? 0 : this.beamSweep.v;
        const angle = Math.atan2(head.y - hy, head.x - hx) + sweep;
        const dist = Phaser.Math.Distance.Between(hx, hy, head.x, head.y);
        this.beam.setPosition(hx, hy).setRotation(angle).setDisplaySize(dist * 1.35, 150);
        this.beamSpot.setPosition(hx + Math.cos(angle) * dist, hy + Math.sin(angle) * dist);
    }

    // ------------------------------------------------------------------
    // 彩蛋：下棋阿伯掉的屁死
    // ------------------------------------------------------------------
    spawnPisi() {
        const x = Phaser.Math.Between(80, 210);
        const y = Phaser.Math.Between(262, 352);
        const glow = this.add.image(0, 0, glowKey(this, 0xffc46b)).setBlendMode(ADD).setScale(0.6).setAlpha(0.7);
        const ring = this.add.circle(0, 0, 26).setStrokeStyle(3, 0xfde047, 1);
        const icon = this.add.image(0, 0, 'icon-butt').setScale(2.2 / BUTT_ICON.res).setAngle(-20);
        const label = this.add.text(0, 32, '下棋阿伯掉的屁死！\n點我撿', {
            fontFamily: FONT_UI, fontSize: '12px', fontStyle: '900', color: '#fde68a', align: 'center', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5, 0);
        const box = this.add.container(x, y, [glow, ring, icon, label]).setDepth(24).setScale(0);
        this.tweens.add({ targets: box, scale: 1, duration: 260, ease: 'Back.easeOut' });
        this.tweens.add({ targets: ring, scale: 1.35, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
        const timer = this.time.delayedCall(PISI_BONUS.life * 1000, () => this.removePisi());
        this.pisi = { box, x, y, timer };
    }

    removePisi() {
        if (!this.pisi) return;
        const { box, timer } = this.pisi;
        timer.remove();
        this.pisi = null;
        this.tweens.add({ targets: box, alpha: 0, scale: 0.6, duration: 200, onComplete: () => box.destroy() });
    }

    tryPickPisi(pointer) {
        if (!this.pisi || this.isGameOver) return false;
        const p = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        if (Phaser.Math.Distance.Between(p.x, p.y, this.pisi.x, this.pisi.y) > 44) return false;
        const pts = Math.round(PISI_BONUS.points * this.spot.scoreMultiplier);
        this.score += pts;
        audioEngine.playPickup();
        this.spawnFloatingText(this.pisi.x + 40, this.pisi.y - 10, `撿到屁死 +${pts}`, '#fde68a');
        this.removePisi();
        this.stopSpreading();
        return true;
    }

    // ------------------------------------------------------------------
    // 被趕走 / 被擠走
    // ------------------------------------------------------------------
    triggerEvict(cause) {
        const wet = !!cause && cause.type === 'sprinkler';
        const amount = this.spot.evictPenalty;
        this.evictCount++;
        this.penalize(wet ? 'wet' : 'evict', amount, wet ? `（被灑水器噴濕 -${amount} 分）` : `（被趕走 -${amount} 分）`, wet ? 0x38bdf8 : 0xff0000);
        if (!cause) {
            const tag = this.showBanner(NIGHT_CROWD[this.ceiling < 99 ? 'patrol' : 'complaint'].warn, 'ceiling');
            this.time.delayedCall(1500, () => this.hideBanner(tag));
        } else if (cause.type === 'patrol') {
            // 手電筒直接照臉，等阿睿走開巡守員才離開
            this.cameras.main.flash(180, 255, 250, 220);
            this.time.delayedCall(SPREAD.stunSec * 1000, () => this.endEvent(cause));
        }
    }

    triggerSqueeze(cause) {
        const amount = this.spot.squeezePenalty;
        this.squeezeCount++;
        this.penalize('squeeze', amount, `（位子被坐走 -${amount} 分）`, 0x2563eb);
        let actor = cause && cause.actors ? cause.actors.find(a => a.active && !a.leaving) : null;
        if (!actor) {
            // 平常縮太久：剛好路過的人趁機衝過來坐（是誰也是依時段抽）
            const who = pickRival(hourAt(NIGHT.seconds - this.timeLeft)).who;
            actor = this.spawnActor(who, Math.random() < 0.5 ? -1 : 1, 0, 0, 3);
        }
        this.time.delayedCall(cause ? 0 : 420, () => this.sitActor(actor));
        this.time.delayedCall(SPREAD.stunSec * 1000, () => {
            if (cause) this.endEvent(cause);
            else this.dismissActor(actor);
        });
    }

    penalize(group, amount, subText, flashColor) {
        this.stunned = true;
        this.stopSpreading();
        this.combo = 0;
        this.sleepStreak = 0;
        this.sleepStreakNext = SLEEP_STREAK.hits;
        this.score = Math.max(0, this.score - amount);
        this.stunTarget = group === 'squeeze' ? 4 : 6;
        this.lastPenalty = group;
        if (this.imgJoy) {
            this.tweens.killTweensOf(this.imgJoy);
            this.imgJoy.setAlpha(0);
        }

        const line = audioEngine.playShout(group);

        this.cameras.main.shake(380, 0.02);
        this.damageFlash.setFillStyle(flashColor, 1).setAlpha(0.3);
        this.tweens.add({ targets: this.damageFlash, alpha: 0, duration: 380 });
        if (group === 'evict') {
            this.redVignette.setAlpha(1);
            this.tweens.add({ targets: this.redVignette, alpha: 0, duration: 900, ease: 'Quad.easeIn' });
        }

        if (this.imgHit) {
            const s = this.imgHit.baseScale;
            this.tweens.killTweensOf(this.imgHit);
            this.imgHit.setAlpha(1).setScale(s * 1.06);
            this.tweens.add({ targets: this.imgHit, scale: s, duration: 260, ease: 'Back.easeOut' });
            this.time.delayedCall(980, () => this.tweens.add({ targets: this.imgHit, alpha: 0, duration: 240 }));
        }

        this.sbText.setText(`${group === 'squeeze' ? '💢' : (group === 'wet' ? '💦' : '🚨')} ${splitShout(line)}`);
        this.sbSub.setText(subText);
        this.tweens.killTweensOf(this.burst);
        this.burst.setAlpha(1).setScale(0.5).setAngle(-8);
        this.tweens.add({
            targets: this.burst,
            scale: 1,
            angle: 0,
            duration: 220,
            ease: 'Back.easeOut',
            onComplete: () => this.tweens.add({ targets: this.burst, alpha: 0, delay: 1150, duration: 300 })
        });

        const head = this.headPos(Math.max(0, this.poseIdx));
        this.spawnFloatingText(head.x + 60, head.y - 30, `-${amount}`, group === 'squeeze' ? '#93c5fd' : '#ef4444');

        this.time.delayedCall(SPREAD.stunSec * 1000, () => {
            this.stunned = false;
            this.squeezeTime = -0.6;   // 回來的時候多給一點寬限，不會一回來馬上又被擠走
        });
    }

    // 理直氣壯區每滿五連擊：打呼 + 爽臉
    triggerSnore() {
        const line = audioEngine.pickSnoreLine();
        if (this.imgJoy) {
            const s = this.imgJoy.baseScale;
            this.tweens.killTweensOf(this.imgJoy);
            this.imgJoy.setAlpha(1).setScale(s * 1.05);
            this.tweens.add({ targets: this.imgJoy, scale: s, duration: 240, ease: 'Back.easeOut' });
            this.tweens.add({ targets: this.imgJoy, alpha: 0, delay: 950, duration: 260 });
        }
        const head = this.headPos(Math.max(0, this.poseIdx));
        for (let i = 0; i < 3; i++) this.time.delayedCall(i * 140, () => this.spawnZ(head, 1.3));
        this.spawnFloatingText(head.x + 70, head.y - 70, `😴 ${line}`, '#c4b5fd');
    }

    spawnZ(head, big = 1) {
        const z = this.add.text(head.x + 14, head.y - 18, 'Z', {
            fontFamily: FONT_TITLE, fontSize: `${Math.round(16 * big)}px`, fontStyle: '900', color: '#e0e7ff', stroke: '#1e1b4b', strokeThickness: 4
        }).setOrigin(0.5).setDepth(14).setAngle(-12);
        this.tweens.add({
            targets: z,
            x: z.x + Phaser.Math.Between(26, 46),
            y: z.y - Phaser.Math.Between(46, 70),
            scale: 1.4,
            alpha: 0,
            duration: 1300,
            ease: 'Sine.easeOut',
            onComplete: () => z.destroy()
        });
    }

    spawnFloatingText(x, y, msg, color = '#fde047') {
        const txt = this.add.text(x, y, msg, {
            fontFamily: FONT_UI,
            fontSize: '19px',
            fontStyle: '900',
            color,
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setDepth(35).setScale(0.7);
        this.tweens.add({ targets: txt, scale: 1, duration: 120, ease: 'Back.easeOut' });
        this.tweens.add({
            targets: txt,
            y: y - 55,
            alpha: 0,
            duration: 750,
            onComplete: () => txt.destroy()
        });
    }

    // ------------------------------------------------------------------
    // 每格更新
    // ------------------------------------------------------------------
    update(time, delta) {
        if (this.isGameOver) return;
        const dt = Math.min(delta, 100) / 1000;
        const spot = this.spot;

        // 1. 時鐘、天色
        this.timeLeft = Math.max(0, this.timeLeft - dt);
        const elapsed = NIGHT.seconds - this.timeLeft;
        this.clockTxt.setText(clockText(elapsed));
        if (this.timeLeft <= 10) this.clockTxt.setColor('#fb923c');
        const k = elapsed / NIGHT.seconds;
        this.nightFill.width = this.nightBar.w * k;
        this.nightMarker.x = this.nightBar.x + this.nightBar.w * k;
        const sky = skyAt(elapsed);
        this.skyTint.setFillStyle(sky.color, sky.alpha);

        if (this.timeLeft <= 0) {
            this.finishGame();
            return;
        }

        // 2. 事件 → 驅離線 / 擠位線
        this.updateNight(elapsed);
        const lines = this.lineTargets(elapsed);
        this.lineInfo = lines;
        this.ceiling = approach(this.ceiling, lines.ceiling, SPREAD.lineSpeed * dt);
        this.floor = approach(this.floor, lines.floor, SPREAD.lineSpeed * dt);
        this.floor = Math.min(this.floor, this.ceiling - SPREAD.minWindow);
        this.squeezeGrace = lines.grace;

        // 3. 囂張值：壓住攤開、放開縮起來；被趕 / 被擠時快速縮成一團
        const spreadingNow = this.isSpreading && !this.stunned;
        if (this.stunned) {
            this.spread = approach(this.spread, this.stunTarget, 140 * dt);
        } else if (spreadingNow) {
            const jitter = 1 + Math.sin(time * 0.013) * 0.12;
            this.spread = Math.min(100, this.spread + spot.spreadRate * jitter * dt);
        } else {
            this.spread = Math.max(0, this.spread - spot.shrinkRate * dt);
        }
        audioEngine.setSpreadSound(spreadingNow, this.spread / 100);

        // 4. 碰到驅離線 → 被趕走；縮在擠位線下太久 → 被擠走
        if (!this.stunned) {
            if (this.spread >= this.ceiling) {
                this.triggerEvict(lines.ceilCause);
            } else if (this.spread < this.floor) {
                this.squeezeTime += dt;
                if (this.squeezeTime >= this.squeezeGrace) this.triggerSqueeze(lines.floorCause);
            } else {
                this.squeezeTime = Math.max(Math.min(0, this.squeezeTime), this.squeezeTime - dt * 2);
            }
        }

        // 5. 計分
        const zoneMax = this.ceiling - SPREAD.zoneGap;
        const zoneMin = Math.max(zoneMax - spot.zoneWidth, this.floor + 1);
        const inZone = !this.stunned && this.spread >= zoneMin && this.spread <= zoneMax;
        const holding = !this.stunned && this.spread >= this.floor;
        if (holding) {
            this.heldTime += dt;
            this.combo += dt * 4;
            if (Math.floor(this.combo) > this.maxCombo) this.maxCombo = Math.floor(this.combo);
            const comfort = 0.35 + 0.65 * (this.spread / 100);
            const zoneMult = inZone ? this.zoneBonus * zoneTierBonus(zoneMin, zoneMax, this.spread) : 1;
            const comboMult = 1 + Math.min(2, Math.floor(this.combo) * 0.05);
            const pts = SCORE_RATE * spot.scoreMultiplier * comfort * zoneMult * comboMult * dt;
            this.score += pts;
            if (inZone && Math.random() < 0.035) {
                const head = this.headPos(Math.max(0, this.poseIdx));
                this.spawnFloatingText(head.x + Phaser.Math.Between(20, 90), head.y - 40, `好眠！+${Math.round(pts * 8)}`, '#fbbf24');
            }
        }
        if (inZone) {
            this.zoneTime += dt;
            this.sleepStreak += dt * SLEEP_STREAK.perSec;
            if (this.sleepStreak >= this.sleepStreakNext) {
                this.sleepStreakNext += SLEEP_STREAK.hits;
                this.triggerSnore();
            }
        } else {
            this.sleepStreak = 0;
            this.sleepStreakNext = SLEEP_STREAK.hits;
        }

        // 6. 畫面
        this.updatePose(time, inZone);
        this.updateBeam();
        this.updateGauge(time, zoneMin, zoneMax, inZone);
        this.updateHoldRing(spreadingNow, zoneMin, zoneMax);
        this.updateStatus(time, inZone);
        this.scoreTxt.setText(`${Math.floor(this.score)}`);
        this.comboTxt.setText(this.combo >= 2 ? `😴 連睡 Combo x${Math.floor(this.combo)}` : '');
    }

    // 依囂張值切換姿勢：0~25 縮成一團、25~50 坐著、50~75 半躺、75~100 大字躺平
    updatePose(time, inZone) {
        const idx = Math.min(3, Math.floor(this.spread / 25));
        if (idx !== this.poseIdx) {
            const img = this.poseImgs[idx];
            const s = this.poseBaseScale[idx];
            this.tweens.killTweensOf(img);
            img.setScale(s * 1.04);
            this.tweens.add({ targets: img, scale: s, duration: 160, ease: 'Quad.easeOut' });
            this.poseIdx = idx;
        }
        this.poseImgs.forEach((img, i) => img.setAlpha(Phaser.Math.Linear(img.alpha, i === idx ? 1 : 0, 0.35)));

        const head = this.headPos(idx);
        if (time > this.nextBreath) {
            this.nextBreath = time + 1700;
            this.breath.explode(4, head.x + 18, head.y + 6);
        }
        if (inZone && time > this.nextZ) {
            this.nextZ = time + 750;
            this.spawnZ(head);
        }
    }

    updateGauge(time, zoneMin, zoneMax, inZone) {
        const G = this.gaugeGfx;
        const { left: L, w, top, bottom } = this.gauge;
        const cy = this.gaugeY(this.ceiling);
        const fy = this.gaugeY(this.floor);
        const sy = this.gaugeY(this.spread);
        const zt = this.gaugeY(zoneMax);
        const zb = this.gaugeY(zoneMin);
        const below = this.spread < this.floor;
        const nearCeil = this.spread > zoneMax;
        G.clear();
        G.fillStyle(0x1d4ed8, 0.35).fillRect(L, fy, w, bottom - fy);
        G.fillStyle(0x7f1d1d, 0.6).fillRect(L, top, w, Math.max(0, cy - top));
        const fill = this.stunned ? 0x6b7280 : (below ? 0x60a5fa : (inZone ? 0xfacc15 : (nearCeil ? 0xf97316 : 0x4ade80)));
        G.fillStyle(fill, 0.95).fillRect(L + 3, sy, w - 6, bottom - sy);
        G.fillStyle(0xfde047, 0.14).fillRect(L, zt, w, zb - zt);
        G.lineStyle(2, 0xfde047, 0.95).lineBetween(L, zt, L + w, zt).lineBetween(L, zb, L + w, zb);
        const bx = L - 8;
        G.lineStyle(5, 0x000000, 0.8).strokePoints([{ x: bx + 5, y: zt }, { x: bx, y: zt }, { x: bx, y: zb }, { x: bx + 5, y: zb }]);
        G.lineStyle(2.5, 0xfde047, 1).strokePoints([{ x: bx + 5, y: zt }, { x: bx, y: zt }, { x: bx, y: zb }, { x: bx + 5, y: zb }]);

        const line = (y, color) => {
            G.lineStyle(7, 0x000000, 0.9).lineBetween(L - 6, y, L + w + 6, y);
            G.lineStyle(4, color, 1).lineBetween(L - 6, y, L + w + 6, y);
        };
        line(cy, 0xef4444);
        line(fy, 0x60a5fa);

        // 預告中的虛線：線等一下會移到這裡
        const blink = 0.55 + Math.sin(time * 0.02) * 0.45;
        const dashed = (y, color) => {
            G.lineStyle(3, color, blink);
            for (let x = L - 8; x < L + w + 8; x += 7) G.lineBetween(x, y, Math.min(x + 4, L + w + 8), y);
        };
        const info = this.lineInfo;
        const ghostCeil = info && info.ghostCeil !== null && info.ghostCeil < this.ceiling - 1 ? info.ghostCeil : null;
        const ghostFloor = info && info.ghostFloor !== null && info.ghostFloor > this.floor + 1 ? info.ghostFloor : null;
        if (ghostCeil !== null) dashed(this.gaugeY(ghostCeil), 0xfca5a5);
        if (ghostFloor !== null) dashed(this.gaugeY(ghostFloor), 0x93c5fd);

        const zoneMid = (zt + zb) / 2;
        this.zoneLabel.setPosition(bx - 4, zoneMid);
        this.zoneBonusTxt.setPosition(bx - 8 - this.zoneLabel.width, zoneMid);
        this.ceilLabel.setPosition(bx - 2, cy - 3).setText(ghostCeil !== null ? '驅離線▼' : '驅離線');
        this.floorLabel.setPosition(bx - 2, fy + 3).setText(ghostFloor !== null ? '擠位線▲' : '擠位線');
        this.floorLabel.setAlpha(fy > bottom - 14 && ghostFloor === null ? 0.5 : 1);

        this.spreadMarker.y = sy;
        this.spreadPctTxt.setText(`${Math.round(this.spread)}%`).setColor(nearCeil ? '#f87171' : (below ? '#93c5fd' : '#ffffff'));
        const pulse = 0.4 + Math.sin(time * 0.025) * 0.25;
        this.gaugeDanger.setAlpha(!this.stunned && this.spread > this.ceiling - 8 ? pulse : 0);
        this.gaugeSqueeze.setAlpha(!this.stunned && below ? pulse : 0);
    }

    // 壓按圈顏色：藍 = 縮太小、綠 = 還沒到、黃 = 理直氣壯區、紅 = 快碰到驅離線
    updateHoldRing(spreadingNow, zoneMin, zoneMax) {
        let ringColor = 0xfbbf24;
        if (this.stunned) ringColor = 0xef4444;
        else if (this.spread < this.floor) ringColor = 0x60a5fa;
        else if (spreadingNow) {
            if (this.spread > zoneMax) ringColor = 0xef4444;
            else if (this.spread >= zoneMin) ringColor = 0xfde047;
            else ringColor = 0x4ade80;
        }
        if (ringColor !== this.holdRingColor) this.drawHoldRing(ringColor);
        this.holdZone.setScale(Phaser.Math.Linear(this.holdZone.scaleX, spreadingNow ? 0.93 : 1, 0.2));
        this.holdLabel.setAlpha(Phaser.Math.Linear(this.holdLabel.alpha, spreadingNow ? 0.3 : 1, 0.15));
    }

    updateStatus(time, inZone) {
        const W = GAME_W;
        const info = this.lineInfo;
        let text;
        let color = '#e7e5e4';
        const below = !this.stunned && this.spread < this.floor;
        if (this.stunned) {
            text = {
                evict: '🚨 被趕走了…縮著等一下再回來',
                wet: '💦 全身濕透…先縮著別動',
                squeeze: '💢 位子被坐走了！等一下趕快攤開搶回來'
            }[this.lastPenalty];
            color = '#f87171';
        } else if (below) {
            text = '⚠️ 縮太小了！有人要坐過來了，快壓住攤開！';
            color = '#93c5fd';
        } else if (info && info.hint) {
            text = info.hint.text;
            color = info.hint.kind === 'ceiling' ? '#fca5a5' : '#93c5fd';
        } else if (inZone) {
            text = `😤 理直氣壯區！分數 x${this.zoneBonus.toFixed(1)} 狂飆中！（別碰紅線）`;
            color = '#fde047';
        } else {
            text = '👆 壓住攤開、放開縮起來，停在金色區最好睡';
        }
        this.statusTxt.setText(text).setColor(color);
        const ratio = below ? Phaser.Math.Clamp(this.squeezeTime / this.squeezeGrace, 0, 1) : 0;
        this.squeezeBar.width = Phaser.Math.Linear(this.squeezeBar.width, ratio * (W - 44), 0.4);
        this.squeezeBar.setAlpha(below ? 0.45 + Math.sin(time * 0.02) * 0.15 : 0.55);
    }

    finishGame() {
        this.isGameOver = true;
        this.stopSpreading();
        this.beamOff();
        this.sprinklers.forEach(e => e.stop());
        if (this.pisi) this.removePisi();
        this.nightEvents.forEach(ev => this.endEvent(ev));

        GAME_STATE.lastResult = {
            score: Math.floor(this.score),
            spot: this.spot,
            evictCount: this.evictCount,
            squeezeCount: this.squeezeCount,
            maxCombo: this.maxCombo,
            heldHours: (this.heldTime / SEC_PER_HOUR).toFixed(1),
            sleepHours: (this.zoneTime / SEC_PER_HOUR).toFixed(1)
        };

        // 天亮了
        this.cameras.main.flash(500, 255, 214, 140);
        this.showBanner('☀ 06:00 天亮了！撐過一晚！', 'dawn');
        this.time.delayedCall(1300, () => {
            this.cameras.main.fadeOut(500, 0, 0, 0);
            this.time.delayedCall(520, () => this.scene.start('ResultScene'));
        });
    }
}
