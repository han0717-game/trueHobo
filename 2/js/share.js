/**
 * ============================================================================
 * 分享戰績（結算畫面：下載一張戰績圖，玩家想分享到哪裡都可以）
 * ============================================================================
 * - 戰績圖 = 底圖 + 底部一條橫幅（今晚睡的位子、守住幾小時、最終總得分），用 canvas 合成成 JPG。
 * - 底圖：有 images/og-image.jpg（網址分享時的預覽圖，直式 1080x1350）就用它；
 *   二代還沒做這張圖，載不到時改用程式畫的封面海報（drawSharePoster）。
 * - 雙擊開檔（file://）時本機圖片畫進畫布後畫布就不能匯出，改讀 js/og-image-data.js（og-image.jpg 轉成的 data URL）。
 *   做好 og-image.jpg 之後，在遊戲資料夾執行：
 *     printf "// 由 images/og-image.jpg 產生（說明見 js/share.js）\nwindow.OG_IMAGE_DATA_URL = 'data:image/jpeg;base64,%s';\n" "$(base64 -i images/og-image.jpg)" > js/og-image-data.js
 * - 下載按鈕要用 pointerup：手機上只有放開手指（touchend）才算使用者操作，下載才不會被擋。
 */
const SHARE_BASE_IMAGE = './images/og-image.jpg';
const SHARE_BASE_DATA_SCRIPT = './js/og-image-data.js';
const SHARE_W = 1080;          // 戰績圖寬度（底圖等比例縮放到這個寬度）
const SHARE_POSTER_H = 1350;   // 沒有 og-image.jpg 時，程式畫的海報高度
const SHARE_BANNER_H = 280;    // 底部戰績橫幅高度

const ShareKit = {
    isMobile() {
        const ua = navigator.userAgent;
        return /Android|iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    },

    // 載入底圖 og-image.jpg（只載一次），回傳 Promise<Image>；失敗時 reject，下次再呼叫會重試
    loadBase() {
        if (!ShareKit.basePromise) {
            ShareKit.basePromise = ShareKit.baseSrc()
                .then(src => new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => reject(new Error('og-image load failed'));
                    img.src = src;
                }))
                .catch(err => {
                    ShareKit.basePromise = null;
                    throw err;
                });
        }
        return ShareKit.basePromise;
    },

    baseSrc() {
        if (!IS_LOCAL_FILE) return Promise.resolve(withVersion(SHARE_BASE_IMAGE));
        if (window.OG_IMAGE_DATA_URL) return Promise.resolve(window.OG_IMAGE_DATA_URL);
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = withVersion(SHARE_BASE_DATA_SCRIPT);
            script.onload = () => (window.OG_IMAGE_DATA_URL ? resolve(window.OG_IMAGE_DATA_URL) : reject(new Error('no OG_IMAGE_DATA_URL')));
            script.onerror = () => {
                script.remove();
                reject(new Error('og-image-data.js load failed'));
            };
            document.head.appendChild(script);
        });
    },

    /**
     * 產生戰績圖，回傳 Promise<File>
     * info：結算資料（score、spot、heldHours）
     */
    makeImage(info) {
        const spot = info.spot;
        const cjk = ['阿睿今晚睡在最終總得分得分倍率守住位小時【】街友本色公園爭奪戰', spot.name, spot.difficultyLabel, spot.stars].join('');
        const fontsReady = document.fonts && document.fonts.load
            ? Promise.all([700, 900].flatMap(w => [
                document.fonts.load(`${w} 30px "Noto Serif TC"`, cjk),
                document.fonts.load(`${w} 30px "Noto Serif"`, 'True Hobo II: Bench Brawl 0123456789.xC')
            ])).catch(() => { })
            : Promise.resolve();
        const base = ShareKit.loadBase().catch(() => null);
        return Promise.all([base, fontsReady]).then(([img]) => ShareKit.renderCard(img, info));
    },

    renderCard(base, info) {
        const W = SHARE_W;
        const baseH = base ? Math.round(W * base.naturalHeight / base.naturalWidth) : SHARE_POSTER_H;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = baseH + SHARE_BANNER_H;
        const ctx = canvas.getContext('2d');
        if (base) ctx.drawImage(base, 0, 0, W, baseH);
        else drawSharePoster(ctx, W, baseH);
        drawResultBanner(ctx, baseH, W, SHARE_BANNER_H, info);
        return new Promise((resolve, reject) => {
            try {
                canvas.toBlob(blob => {
                    if (blob) resolve(new File([blob], `truehobo2-score-${info.score}.jpg`, { type: 'image/jpeg' }));
                    else reject(new Error('toBlob failed'));
                }, 'image/jpeg', 0.9);
            } catch (e) {
                reject(e);
            }
        });
    },

    download(file) {
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    }
};

// 文字（可描邊、錯位黑影）；超過 maxW 會自動縮小字級
function cardText(ctx, str, x, y, opts) {
    let size = opts.size;
    const font = s => `${opts.weight ?? 900} ${s}px ${FONT_SERIF}`;
    ctx.font = font(size);
    if (opts.maxW) {
        while (size > 10 && ctx.measureText(str).width > opts.maxW) ctx.font = font(--size);
    }
    ctx.textAlign = opts.align ?? 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    if (opts.shadow) {
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = opts.stroke || 0.01;
        if (opts.stroke) ctx.strokeText(str, x + opts.shadow, y + opts.shadow);
        ctx.fillText(str, x + opts.shadow, y + opts.shadow);
    }
    if (opts.stroke) {
        ctx.lineWidth = opts.stroke;
        ctx.strokeStyle = opts.strokeColor ?? '#000';
        ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = opts.color ?? '#fff';
    ctx.fillText(str, x, y);
}

// 沒有 og-image.jpg 時的海報：程式畫的封面（取上半部）+ 標題
function drawSharePoster(ctx, W, H) {
    const s = W / GAME_W;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    ctx.scale(s, s);
    ComicArtGenerator.drawCover(ctx, GAME_W, GAME_H);
    ctx.restore();

    const fade = ctx.createLinearGradient(0, H * 0.6, 0, H);
    fade.addColorStop(0, 'rgba(5,6,10,0)');
    fade.addColorStop(1, 'rgba(5,6,10,0.95)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);

    cardText(ctx, '街友本色 II', W / 2, H - 230, { size: 120, color: '#fbbf24', stroke: 16, shadow: 10 });
    ctx.save();
    ctx.translate(W / 2, H - 120);
    ctx.rotate(0.02);
    ctx.fillStyle = '#000';
    ctx.fillRect(-250 + 10, -42 + 10, 500, 84);
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(-250, -42, 500, 84);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#000';
    ctx.strokeRect(-250, -42, 500, 84);
    cardText(ctx, '公園C位爭奪戰', 0, 2, { size: 56, color: '#fef2f2' });
    ctx.restore();
    cardText(ctx, 'True Hobo II: Bench Brawl', W / 2, H - 40, { size: 40, color: '#fde68a', stroke: 8 });
}

// 底部戰績橫幅：左邊今晚睡的位子（名稱、難度、守住幾小時），右邊最終總得分
function drawResultBanner(ctx, top, W, h, info) {
    const spot = info.spot;
    const color = spot.badgeColor;

    const bg = ctx.createLinearGradient(0, top, 0, top + h);
    bg.addColorStop(0, '#161c27');
    bg.addColorStop(1, '#07090d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, top, W, h);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, top, W, 10);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, top + 10, W, 6);

    const divX = 650;
    ctx.fillStyle = 'rgba(245,158,11,0.35)';
    ctx.fillRect(divX - 1, top + 52, 3, h - 92);

    const left = 64;
    const right = divX - 40;
    const row1 = top + 70;
    const row2 = top + 142;
    const row3 = top + 222;
    cardText(ctx, '阿睿今晚睡在', left, row1, { size: 28, weight: 700, color: '#a8a29e', align: 'left' });
    cardText(ctx, `${spot.difficultyLabel} ${spot.stars}`, right, row1, { size: 28, color, align: 'right' });
    cardText(ctx, `【${spot.name}】`, left - 14, row2, { size: 56, color, stroke: 9, shadow: 5, align: 'left', maxW: right - left + 28 });
    const s = 2.6;
    ctx.save();
    ctx.translate(left, row3 - (BENCH_ICON.h / 2) * s);
    ctx.scale(s, s);
    drawBenchShape(ctx, BENCH_ICON.w, BENCH_ICON.h);
    ctx.restore();
    cardText(ctx, `守住 C 位 ${info.heldHours} 小時`, left + BENCH_ICON.w * s + 16, row3, { size: 30, color: '#fbbf24', align: 'left' });
    cardText(ctx, `x${spot.scoreMultiplier.toFixed(1)}`, right, row3, { size: 28, weight: 700, color: '#a8a29e', align: 'right' });

    const cx = (divX + W) / 2;
    cardText(ctx, '最終總得分', cx, top + 72, { size: 30, weight: 700, color: '#a8a29e' });
    cardText(ctx, `${info.score}`, cx, top + 172, { size: 128, color: '#fef08a', stroke: 12, shadow: 7, maxW: W - divX - 70 });
}
