/**
 * ============================================================================
 * 程式繪製的備援美術（原型階段用；放了真的圖就自動改用真的圖）
 * ============================================================================
 * 跟一代一樣：BootScene 先試著載入 images/<編號>.webp，載不到的才用這裡畫的圖代替。
 *
 *   img0   封面：土地公廟前的 C 位長椅，阿睿大字躺平，紙箱哥躲在樹後、手電筒從右邊照過來
 *   img1   劇情二「C 位空出來了」：阿土伯坐女兒的機車離開，長椅上留一張「給撐到天亮的人」紙箱，阿睿背影揮手
 *   img2   劇情一「公園的規矩」+ 選位子：公園鳥瞰地圖，五個過夜位子（座標見 data.js 的 PARK_SPOTS.mapPos）
 *   img3   劇情三「寒流來襲」：電視寒流特報畫面，空著的 C 位長椅，紙箱哥、廣場舞阿姨躲在柱子後、石窗裡有眼睛
 *   img4   劇情四「躺平是一門技術」：阿睿側彎拉筋暖身，遠處的紙箱哥也在暖身
 *   img5~8 （選填）遊戲中四種姿勢的全版圖：縮成一團 / 坐著 / 半躺 / 大字躺平。
 *          四張都有才會用；沒有的話改用「各位子的背景 bg-<id>」+「阿睿姿勢圖 pose-0~3」疊起來
 *   img9   （選填）被趕走 / 被擠走的反應圖
 *   img10  （選填）好眠打呼的爽臉
 * 劇情的文字和每張圖的燈光位置在 data.js（STORY_SLIDES、ART_FX）
 */

// 程式畫的圖裡面寫的字（預載字型用）
const ART_TEXT_SAMPLE = '給撐到天亮的人寒流特報快訊今晚報到平地低溫度各地公園長椅一位難求喀啦哼台灣香蕉福德正神管理室禁止躺臥乖乖有人LIVE';

const ART_COLORS = {
    ink: '#0a0c0e',
    skin: '#cfa082',
    hair: '#141619',
    beanie: '#434d46',
    beanieRim: '#353d38',
    parka: '#3f5138',
    jeans: '#2d4c68',
    boot: '#5c4332',
    sock: '#9ca3af',
    card: '#a47c4a',
    cardDark: '#7a5a33',
    wood: '#7a5233',
    woodLight: '#93653f',
    iron: '#1f2328'
};

// 在畫布上建立一張貼圖（已存在就跳過：真的圖片優先）
function makeArtTexture(scene, key, w, h, res, draw) {
    if (scene.textures.exists(key)) return key;
    const canvasTex = scene.textures.createCanvas(key, Math.round(w * res), Math.round(h * res));
    const ctx = canvasTex.getContext();
    ctx.save();
    ctx.scale(res, res);
    draw(ctx, w, h);
    ctx.restore();
    canvasTex.refresh();
    return key;
}

class ComicArtGenerator {
    static generateAllTextures(scene) {
        const W = GAME_W, H = GAME_H;
        makeArtTexture(scene, 'img0', W, H, 1, ctx => ComicArtGenerator.drawCover(ctx, W, H));
        makeArtTexture(scene, 'img1', W, H, 1, ctx => ComicArtGenerator.drawFarewell(ctx, W, H));
        makeArtTexture(scene, 'img2', W, H, 1, ctx => ComicArtGenerator.drawParkMap(ctx, W, H));
        makeArtTexture(scene, 'img3', W, H, 1, ctx => ComicArtGenerator.drawColdNight(ctx, W, H));
        makeArtTexture(scene, 'img4', W, H, 1, ctx => ComicArtGenerator.drawWarmup(ctx, W, H));

        for (let i = 0; i < 4; i++) {
            makeArtTexture(scene, `pose-${i}`, POSE_SPRITE.w, POSE_SPRITE.h, ART_RES, ctx => ComicArtGenerator.drawPose(ctx, i));
        }
        Object.keys(NPC_SPRITES).forEach(name => {
            makeArtTexture(scene, `npc-${name}`, NPC_SIZE.w, NPC_SIZE.h, ART_RES, ctx => NPC_SPRITES[name].draw(ctx));
        });

        // 手電筒光束（ADD 疊加；尖端在左邊中間）
        makeArtTexture(scene, 'fx-beam', 400, 180, 1, (ctx, w, h) => {
            for (let i = 0; i < 6; i++) {
                const spread = (h / 2) * (1 - i * 0.14);
                const g = ctx.createLinearGradient(0, 0, w, 0);
                g.addColorStop(0, 'rgba(255,248,210,0.22)');
                g.addColorStop(0.7, 'rgba(255,240,190,0.08)');
                g.addColorStop(1, 'rgba(255,240,190,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.moveTo(0, h / 2 - 3);
                ctx.lineTo(w, h / 2 - spread);
                ctx.lineTo(w, h / 2 + spread);
                ctx.lineTo(0, h / 2 + 3);
                ctx.closePath();
                ctx.fill();
            }
        });

        // 灑水器的水滴
        makeArtTexture(scene, 'fx-drop', 6, 16, 2, (ctx, w, h) => {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, 'rgba(186,230,253,0)');
            g.addColorStop(1, 'rgba(224,242,254,0.95)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 各位子的遊戲背景（夜空 + 那個位子的地標 + 長椅），選了才畫
    static spotBackdropKey(scene, spot) {
        return makeArtTexture(scene, `bg-${spot.id}`, GAME_W, GAME_H, 1, (ctx, W, H) => ComicArtGenerator.drawSpotBackdrop(ctx, W, H, spot));
    }

    // ------------------------------------------------------------------
    // 共用小零件
    // ------------------------------------------------------------------
    static rng(seed) {
        let s = seed;
        return () => (s = (s * 16807) % 2147483647) / 2147483647;
    }

    static nightSky(ctx, W, h, seed = 7) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#060912');
        g.addColorStop(0.6, '#111b31');
        g.addColorStop(1, '#22304a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, h);
        const r = ComicArtGenerator.rng(seed);
        for (let i = 0; i < 70; i++) {
            ctx.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.6})`;
            ctx.fillRect(r() * W, r() * h * 0.75, 1.4, 1.4);
        }
    }

    static moon(ctx, x, y, r) {
        const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 3);
        glow.addColorStop(0, 'rgba(255,244,200,0.35)');
        glow.addColorStop(1, 'rgba(255,244,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
        ctx.fillStyle = '#fdf3c4';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(200,190,150,0.45)';
        ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + r * 0.25, y + r * 0.3, r * 0.12, 0, Math.PI * 2); ctx.fill();
    }

    static city(ctx, W, baseY, seed = 3) {
        const r = ComicArtGenerator.rng(seed);
        let x = -10;
        while (x < W) {
            const w = 30 + r() * 50;
            const h = 40 + r() * 120;
            ctx.fillStyle = r() < 0.5 ? '#0c1222' : '#101a2c';
            ctx.fillRect(x, baseY - h, w, h);
            for (let wy = baseY - h + 8; wy < baseY - 6; wy += 12) {
                for (let wx = x + 5; wx < x + w - 6; wx += 10) {
                    if (r() < 0.22) {
                        ctx.fillStyle = r() < 0.7 ? 'rgba(253,224,140,0.75)' : 'rgba(147,197,253,0.6)';
                        ctx.fillRect(wx, wy, 4, 5);
                    }
                }
            }
            x += w + 2;
        }
    }

    static tree(ctx, x, y, r) {
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#1d140e';
        ctx.fillRect(x - r * 0.1, y, r * 0.2, r * 1.2);
        [[0, 0, 1, '#0d2219'], [-0.45, 0.2, 0.7, '#123024'], [0.45, 0.25, 0.68, '#0f281d'], [0, -0.35, 0.65, '#16392a']].forEach(([dx, dy, s, c]) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(x + dx * r, y + dy * r, r * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    static lampPost(ctx, x, topY, groundY) {
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(x - 4, topY, 8, groundY - topY);
        ctx.strokeRect(x - 4, topY, 8, groundY - topY);
        ctx.beginPath();
        ctx.moveTo(x - 16, topY + 2);
        ctx.lineTo(x + 16, topY + 2);
        ctx.lineTo(x + 10, topY - 16);
        ctx.lineTo(x - 10, topY - 16);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        const g = ctx.createRadialGradient(x, topY + 6, 2, x, topY + 6, 70);
        g.addColorStop(0, 'rgba(255,236,170,0.9)');
        g.addColorStop(0.2, 'rgba(255,220,140,0.35)');
        g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x - 70, topY - 64, 140, 140);
    }

    static ground(ctx, W, H, y, tint = '#1a2230') {
        const g = ctx.createLinearGradient(0, y, 0, H);
        g.addColorStop(0, tint);
        g.addColorStop(1, '#0b0e14');
        ctx.fillStyle = g;
        ctx.fillRect(0, y, W, H - y);
        // 石板路
        ctx.fillStyle = 'rgba(120,130,150,0.12)';
        ctx.beginPath();
        ctx.moveTo(0, y + 150);
        ctx.lineTo(W, y + 120);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
            const yy = y + 160 + i * 30;
            ctx.beginPath();
            ctx.moveTo(0, yy);
            ctx.lineTo(W, yy - 20);
            ctx.stroke();
        }
    }

    // 公園長椅（正面）：椅背兩條、椅面、兩組鐵椅腳；seatY = 椅面上緣
    static bench(ctx, cx, seatY, len) {
        const L = cx - len / 2;
        const R = cx + len / 2;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3.5;
        ctx.lineJoin = 'round';
        // 椅腳（鐵）
        ctx.fillStyle = ART_COLORS.iron;
        [L + len * 0.1, R - len * 0.1].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x - 10, seatY - 78);
            ctx.lineTo(x + 2, seatY - 78);
            ctx.lineTo(x + 6, seatY + 80);
            ctx.lineTo(x - 6, seatY + 80);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillRect(x - 22, seatY + 2, 40, 10);
            ctx.strokeRect(x - 22, seatY + 2, 40, 10);
        });
        // 椅背
        [seatY - 74, seatY - 46].forEach(y => {
            ctx.fillStyle = ART_COLORS.wood;
            ctx.fillRect(L, y, len, 18);
            ctx.strokeRect(L, y, len, 18);
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(L + 4, y + 3, len - 8, 4);
        });
        // 椅面（上表面 + 前緣）
        ctx.fillStyle = ART_COLORS.woodLight;
        ctx.beginPath();
        ctx.moveTo(L + 8, seatY - 12);
        ctx.lineTo(R - 8, seatY - 12);
        ctx.lineTo(R, seatY);
        ctx.lineTo(L, seatY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ART_COLORS.wood;
        ctx.fillRect(L, seatY, len, 12);
        ctx.strokeRect(L, seatY, len, 12);
    }

    static limb(ctx, pts, w, color) {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = w + 5;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = w;
        ctx.stroke();
        ctx.restore();
    }

    static hand(ctx, x, y, r = 6, color = ART_COLORS.skin) {
        ctx.fillStyle = color;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    // 阿睿的頭：臉朝 +x（rot 旋轉），mood = open / closed / smile
    static ruiHead(ctx, x, y, r, rot, mood) {
        const C = ART_COLORS;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.lineJoin = 'round';
        ctx.fillStyle = C.hair;
        ctx.beginPath();
        ctx.moveTo(-r * 0.9, -r * 0.3);
        ctx.quadraticCurveTo(-r * 1.35, r * 0.9, -r * 0.55, r * 1.3);
        ctx.lineTo(-r * 0.05, r * 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = C.skin;
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        // 鼻子
        ctx.beginPath();
        ctx.moveTo(r * 0.82, -r * 0.12);
        ctx.lineTo(r * 1.18, r * 0.22);
        ctx.lineTo(r * 0.84, r * 0.32);
        ctx.fill();
        ctx.stroke();
        // 鬍渣
        ctx.fillStyle = 'rgba(25,25,28,0.5)';
        ctx.beginPath();
        ctx.arc(r * 0.1, r * 0.15, r * 0.85, 0.02 * Math.PI, 0.7 * Math.PI);
        ctx.lineTo(r * 0.15, r * 0.35);
        ctx.closePath();
        ctx.fill();
        // 眉毛、眼睛
        ctx.fillStyle = C.hair;
        ctx.fillRect(r * 0.2, -r * 0.48, r * 0.52, r * 0.13);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2;
        if (mood === 'open') {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(r * 0.48, -r * 0.16, r * 0.2, r * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = C.ink;
            ctx.beginPath(); ctx.arc(r * 0.55, -r * 0.16, r * 0.08, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.beginPath();
            ctx.arc(r * 0.48, -r * 0.22, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI);
            ctx.stroke();
        }
        if (mood === 'smile') {
            ctx.beginPath();
            ctx.arc(r * 0.55, r * 0.42, r * 0.22, 0.1 * Math.PI, 0.9 * Math.PI);
            ctx.stroke();
        }
        // 毛帽
        ctx.fillStyle = C.beanie;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(-r * 0.05, -r * 0.25, r * 1.02, Math.PI * 0.98, Math.PI * 2.02);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = C.beanieRim;
        ctx.fillRect(-r * 1.08, -r * 0.44, r * 2.12, r * 0.3);
        ctx.strokeRect(-r * 1.08, -r * 0.44, r * 2.12, r * 0.3);
        ctx.restore();
    }

    static boot(ctx, x, y, rot = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = ART_COLORS.boot;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(-10, -9, 28, 16, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2b1f17';
        ctx.fillRect(-10, 4, 28, 3);
        ctx.restore();
    }

    // 穿破襪子的腳（大字躺平時脫了鞋）
    static sockFoot(ctx, x, y, rot = 0) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);
        ctx.fillStyle = ART_COLORS.sock;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(4, 0, 13, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = ART_COLORS.skin;
        ctx.beginPath();
        ctx.arc(13, -1, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // 茄芷袋（紅白藍條紋尼龍袋）；x, y 為左上角
    static bag(ctx, x, y, w, h) {
        const colors = ['#b91c1c', '#f5f5f4', '#1d4ed8', '#f5f5f4'];
        ctx.save();
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(x + w * 0.3, y + 2, w * 0.16, h * 0.32, 0, Math.PI, Math.PI * 2);
        ctx.ellipse(x + w * 0.7, y + 2, w * 0.16, h * 0.32, 0, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.save();
        ctx.clip();
        const sw = w / 8;
        for (let i = 0; i < 9; i++) {
            ctx.fillStyle = colors[i % 4];
            ctx.fillRect(x + i * sw, y, sw, h);
        }
        ctx.restore();
        ctx.stroke();
        ctx.restore();
    }

    // 撿來的香蕉紙箱；cx, cy 為中心
    static cardboard(ctx, cx, cy, w, h, rot = 0, label = true) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = ART_COLORS.card;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.fillRect(-w / 2, -h / 2, w, h);
        ctx.strokeRect(-w / 2, -h / 2, w, h);
        ctx.strokeStyle = ART_COLORS.cardDark;
        ctx.lineWidth = 1.5;
        if (w > h) {
            [-0.2, 0.25].forEach(t => {
                ctx.beginPath(); ctx.moveTo(w * t, -h / 2 + 1); ctx.lineTo(w * t, h / 2 - 1); ctx.stroke();
            });
        } else {
            ctx.beginPath(); ctx.moveTo(-w / 2 + 1, h * 0.1); ctx.lineTo(w / 2 - 1, h * 0.1); ctx.stroke();
        }
        if (label && Math.max(w, h) > 60 && Math.min(w, h) > 24) {
            ctx.fillStyle = 'rgba(60,40,20,0.7)';
            ctx.font = `900 ${Math.round(Math.min(w, h) * 0.24)}px ${FONT_SERIF}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('台灣香蕉', 0, 0);
        }
        ctx.restore();
    }

    // ------------------------------------------------------------------
    // 阿睿的四種姿勢（透明底；椅面在 y = 200，長椅 x 50 ~ 410）
    // ------------------------------------------------------------------
    static drawPose(ctx, pose) {
        const C = ART_COLORS;
        const A = ComicArtGenerator;
        if (pose === 0) {
            // 縮成一團：坐在椅子最左邊抱著膝蓋，家當都收好
            A.cardboard(ctx, 300, 150, 40, 96, -0.14);
            A.bag(ctx, 196, 166, 48, 34);
            A.limb(ctx, [[118, 126], [150, 134], [160, 150]], 15, C.parka);
            A.limb(ctx, [[106, 186], [118, 124]], 42, C.parka);
            A.limb(ctx, [[110, 184], [156, 142]], 22, C.jeans);
            A.limb(ctx, [[156, 142], [150, 190]], 20, C.jeans);
            A.boot(ctx, 150, 194, 0);
            A.limb(ctx, [[124, 128], [162, 142], [166, 160]], 15, C.parka);
            A.hand(ctx, 166, 162);
            A.ruiHead(ctx, 140, 100, 19, 0.55, 'closed');
        } else if (pose === 1) {
            // 坐著：紙箱墊在屁股下，茄芷袋放旁邊佔位
            A.cardboard(ctx, 170, 196, 170, 8);
            A.bag(ctx, 266, 160, 52, 40);
            A.limb(ctx, [[148, 118], [166, 152], [198, 172]], 15, C.parka);
            A.limb(ctx, [[150, 188], [148, 112]], 42, C.parka);
            A.limb(ctx, [[150, 190], [212, 192]], 22, C.jeans);
            A.limb(ctx, [[212, 192], [216, 266]], 20, C.jeans);
            A.boot(ctx, 220, 272, 0);
            A.limb(ctx, [[150, 118], [176, 156], [208, 178]], 15, C.parka);
            A.hand(ctx, 210, 180);
            A.ruiHead(ctx, 152, 82, 19, 0, 'open');
        } else if (pose === 2) {
            // 半躺：靠著椅子扶手、腳伸直，紙箱鋪了大半張椅子
            A.cardboard(ctx, 210, 197, 310, 9);
            A.bag(ctx, 370, 252, 46, 36);
            A.limb(ctx, [[110, 150], [86, 112], [66, 124]], 15, C.parka);
            A.limb(ctx, [[190, 186], [106, 152]], 40, C.parka);
            A.limb(ctx, [[190, 188], [268, 180]], 22, C.jeans);
            A.limb(ctx, [[268, 180], [344, 186]], 20, C.jeans);
            A.boot(ctx, 352, 178, -Math.PI / 2);
            A.limb(ctx, [[112, 156], [144, 176], [176, 182]], 15, C.parka);
            A.hand(ctx, 178, 182);
            A.ruiHead(ctx, 78, 132, 19, -1.0, 'closed');
        } else {
            // 大字躺平：紙箱鋪滿整張椅子還超出去、鞋子脫了、茄芷袋當枕頭、插一塊「有人」的牌子
            A.cardboard(ctx, 236, 286, 440, 8);
            A.cardboard(ctx, 230, 198, 430, 10);
            A.boot(ctx, 316, 274, 0);
            A.boot(ctx, 350, 278, 0.12);
            ctx.strokeStyle = C.ink;
            ctx.lineWidth = 4;
            ctx.beginPath(); ctx.moveTo(440, 196); ctx.lineTo(440, 128); ctx.stroke();
            A.cardboard(ctx, 440, 112, 42, 34, 0.08);
            ctx.fillStyle = '#7f1d1d';
            ctx.font = `900 15px ${FONT_SERIF}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('有人', 440, 113);
            A.bag(ctx, 22, 168, 58, 32);
            A.limb(ctx, [[110, 176], [92, 140], [64, 136]], 15, C.parka);
            A.limb(ctx, [[240, 186], [112, 180]], 40, C.parka);
            A.limb(ctx, [[240, 186], [322, 178]], 22, C.jeans);
            A.limb(ctx, [[322, 178], [398, 186]], 20, C.jeans);
            A.sockFoot(ctx, 404, 180, -Math.PI / 2);
            A.limb(ctx, [[124, 184], [130, 228], [120, 264]], 15, C.parka);
            A.hand(ctx, 120, 268);
            A.ruiHead(ctx, 76, 166, 19, -Math.PI / 2 + 0.1, 'smile');
        }
    }

    // ------------------------------------------------------------------
    // 公園的地標
    // ------------------------------------------------------------------
    static pavilion(ctx, x, y, w) {
        // 涼亭：綠瓦屋頂 + 紅柱；(x, y) = 屋簷左下角
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#7f1d1d';
        [0.12, 0.88].forEach(t => {
            ctx.fillRect(x + w * t - 7, y, 14, 130);
            ctx.strokeRect(x + w * t - 7, y, 14, 130);
        });
        ctx.fillStyle = '#14532d';
        ctx.beginPath();
        ctx.moveTo(x - 20, y + 4);
        ctx.quadraticCurveTo(x + w * 0.2, y - 14, x + w * 0.5, y - 70);
        ctx.quadraticCurveTo(x + w * 0.8, y - 14, x + w + 20, y + 4);
        ctx.quadraticCurveTo(x + w * 0.5, y - 8, x - 20, y + 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        for (let i = 1; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(x + w * 0.5, y - 66);
            ctx.lineTo(x - 10 + (w + 20) * i / 8, y);
            ctx.stroke();
        }
    }

    static slide(ctx, x, y) {
        // 溜滑梯：(x, y) = 平台左下角
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(x, y - 10, 70, 12);
        ctx.strokeRect(x, y - 10, 70, 12);
        ctx.fillStyle = '#374151';
        [x + 4, x + 60].forEach(px => { ctx.fillRect(px, y, 8, 120); ctx.strokeRect(px, y, 8, 120); });
        ctx.fillStyle = '#d97706';
        ctx.beginPath();
        ctx.moveTo(x + 66, y - 6);
        ctx.quadraticCurveTo(x + 140, y + 40, x + 170, y + 116);
        ctx.lineTo(x + 150, y + 122);
        ctx.quadraticCurveTo(x + 124, y + 56, x + 64, y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 6; i++) {
            const yy = y + 12 + i * 18;
            ctx.beginPath(); ctx.moveTo(x - 30 + i * 4, yy); ctx.lineTo(x + 4, yy); ctx.stroke();
        }
        ctx.beginPath(); ctx.moveTo(x - 6, y - 4); ctx.lineTo(x - 34, y + 118); ctx.stroke();
    }

    static building(ctx, x, y, w, h, wall) {
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = wall;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = '#111827';
        ctx.fillRect(x - 8, y - 12, w + 16, 14);
        ctx.strokeRect(x - 8, y - 12, w + 16, 14);
    }

    static signBoard(ctx, x, y, w, h, text, bg, fg, size) {
        ctx.fillStyle = bg;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.fillRect(x, y, w, h);
        ctx.strokeRect(x, y, w, h);
        ctx.fillStyle = fg;
        ctx.font = `900 ${size}px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w / 2, y + h / 2 + 1);
    }

    static warmGlow(ctx, x, y, r, rgb, a) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }

    // 土地公廟（正面）：cx = 中心，y = 屋脊高度，w = 寬
    static temple(ctx, cx, y, w) {
        const L = cx - w / 2;
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        // 牆
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(L + w * 0.12, y + 60, w * 0.76, 120);
        ctx.strokeRect(L + w * 0.12, y + 60, w * 0.76, 120);
        // 門內神龕的暖光
        ComicArtGenerator.warmGlow(ctx, cx, y + 130, 70, '255,190,90', 0.55);
        ctx.fillStyle = '#3b0a0a';
        ctx.fillRect(cx - w * 0.13, y + 92, w * 0.26, 88);
        ctx.strokeRect(cx - w * 0.13, y + 92, w * 0.26, 88);
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(cx, y + 138, 9, 0, Math.PI * 2); ctx.fill();
        // 台階
        ctx.fillStyle = '#4b5563';
        ctx.fillRect(L, y + 180, w, 16);
        ctx.strokeRect(L, y + 180, w, 16);
        // 燕尾屋頂
        ctx.fillStyle = '#9a3412';
        ctx.beginPath();
        ctx.moveTo(L - 10, y + 64);
        ctx.lineTo(L + w * 0.08, y + 22);
        ctx.lineTo(L + w * 0.92, y + 22);
        ctx.lineTo(L + w + 10, y + 64);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#7c2d12';
        ctx.beginPath();
        ctx.moveTo(L + w * 0.04, y + 22);
        ctx.quadraticCurveTo(L - w * 0.02, y - 14, L - w * 0.06, y - 30);
        ctx.quadraticCurveTo(L + w * 0.1, y + 4, L + w * 0.2, y + 4);
        ctx.lineTo(L + w * 0.8, y + 4);
        ctx.quadraticCurveTo(L + w * 0.9, y + 4, L + w * 1.06, y - 30);
        ctx.quadraticCurveTo(L + w * 1.02, y - 14, L + w * 0.96, y + 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // 匾額
        ComicArtGenerator.signBoard(ctx, cx - 46, y + 66, 92, 22, '福德正神', '#111827', '#fbbf24', 14);
    }

    // 燈籠；(x, y) = 中心
    static lantern(ctx, x, y, w, h) {
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(x, y - h / 2 - 40); ctx.lineTo(x, y - h / 2); ctx.stroke();
        ComicArtGenerator.warmGlow(ctx, x, y, w * 1.6, '255,90,60', 0.4);
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.fillRect(x - w * 0.32, y - h / 2 - 2, w * 0.64, 6);
        ctx.fillRect(x - w * 0.32, y + h / 2 - 4, w * 0.64, 6);
        ctx.fillStyle = '#fde68a';
        ctx.font = `900 ${Math.round(w * 0.45)}px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('福', x, y + 1);
    }

    // 供品桌：橘子、罐頭、綠色乖乖
    static offerings(ctx, x, y, w) {
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 2.5;
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(x, y, w, 14);
        ctx.strokeRect(x, y, w, 14);
        ctx.fillRect(x + 8, y + 14, 8, 46);
        ctx.fillRect(x + w - 16, y + 14, 8, 46);
        [[0.15, '#f97316'], [0.27, '#fb923c'], [0.21, '#f97316']].forEach(([t, c], i) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(x + w * t, y - 8 - (i === 2 ? 12 : 0), 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        });
        ctx.fillStyle = '#cbd5e1';
        ctx.fillRect(x + w * 0.45, y - 22, 14, 22);
        ctx.strokeRect(x + w * 0.45, y - 22, 14, 22);
        ctx.fillStyle = '#16a34a';
        ctx.beginPath();
        ctx.roundRect(x + w * 0.65, y - 30, 26, 30, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#facc15';
        ctx.font = `900 9px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.fillText('乖乖', x + w * 0.65 + 13, y - 14);
    }

    // ------------------------------------------------------------------
    // 各位子的遊戲背景
    // ------------------------------------------------------------------
    static drawSpotBackdrop(ctx, W, H, spot) {
        const A = ComicArtGenerator;
        const horizon = 540;
        A.nightSky(ctx, W, horizon, 11);
        A.moon(ctx, ART_FX.stage.moon.x, ART_FX.stage.moon.y, 24);
        A.city(ctx, W, horizon, 5);
        A.tree(ctx, 150, 470, 56);
        A.tree(ctx, 500, 486, 64);
        A.ground(ctx, W, H, horizon, spot.prop === 'pavilion' ? '#15261c' : '#1a2230');

        if (spot.prop === 'pavilion') {
            A.pavilion(ctx, 320, 440, 180);
            ctx.fillStyle = 'rgba(0,0,0,0.75)';
            const r = A.rng(4);
            for (let i = 0; i < 26; i++) ctx.fillRect(110 + r() * 300, 470 + r() * 120, 2, 2);  // 蚊子
        } else if (spot.prop === 'slide') {
            A.slide(ctx, 330, 440);
        } else if (spot.prop === 'toilet') {
            A.building(ctx, 330, 392, 210, 178, '#334155');
            A.warmGlow(ctx, 430, 510, 90, '254,249,195', 0.35);
            ctx.fillStyle = '#fef9c3';
            ctx.fillRect(404, 470, 52, 100);
            ctx.strokeRect(404, 470, 52, 100);
            A.signBoard(ctx, 396, 412, 70, 30, 'W.C.', '#1d4ed8', '#ffffff', 18);
            A.signBoard(ctx, 480, 470, 40, 40, '🔌', '#e5e7eb', '#111', 22);
        } else if (spot.prop === 'office') {
            A.building(ctx, 290, 372, 250, 198, '#3f3f46');
            A.warmGlow(ctx, 340, 450, 90, '254,240,170', 0.4);
            ctx.fillStyle = '#fde68a';
            ctx.fillRect(306, 420, 70, 56);
            ctx.strokeRect(306, 420, 70, 56);
            ctx.beginPath(); ctx.moveTo(341, 420); ctx.lineTo(341, 476); ctx.stroke();
            A.signBoard(ctx, 404, 392, 96, 30, '管理室', '#f5f5f4', '#111827', 17);
            ctx.fillStyle = '#4b5563';
            ctx.fillRect(126, 486, 6, 80);
            A.signBoard(ctx, 92, 452, 76, 36, '禁止躺臥', '#fef2f2', '#b91c1c', 15);
        } else if (spot.prop === 'temple') {
            // 屋簷在頭頂、兩根紅柱夾著長椅、後面是廟牆和供品桌
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(40, 380, 420, 190);
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 3;
            ctx.strokeRect(40, 380, 420, 190);
            A.warmGlow(ctx, 250, 470, 160, '255,190,90', 0.35);
            A.offerings(ctx, 330, 520, 110);
            ctx.fillStyle = '#991b1b';
            [[8, 330], [472, 330]].forEach(([x, y]) => {
                ctx.fillRect(x, y, 30, 420);
                ctx.strokeRect(x, y, 30, 420);
            });
            ctx.fillStyle = '#431407';
            ctx.beginPath();
            ctx.moveTo(-10, 290);
            ctx.lineTo(W + 10, 290);
            ctx.lineTo(W + 10, 345);
            ctx.quadraticCurveTo(W / 2, 330, -10, 345);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            for (let x = 0; x < W; x += 22) {
                ctx.beginPath(); ctx.moveTo(x, 292); ctx.lineTo(x + 6, 338); ctx.stroke();
            }
            A.lantern(ctx, 128, 404, 34, 44);
            A.lantern(ctx, 372, 404, 34, 44);
        }

        A.lampPost(ctx, ART_FX.stage.lamp.x, ART_FX.stage.lamp.y, 740);
        A.bench(ctx, BENCH.x, BENCH.seatY, BENCH.len);
        ComicArtGenerator.applyComicFinish(ctx, W, H);
    }

    // ------------------------------------------------------------------
    // 封面 / 劇情 / 地圖
    // ------------------------------------------------------------------
    static drawCover(ctx, W, H) {
        const A = ComicArtGenerator;
        A.nightSky(ctx, W, 470, 21);
        A.moon(ctx, ART_FX.img0.moon.x, ART_FX.img0.moon.y, 32);
        A.city(ctx, W, 440, 9);
        A.tree(ctx, 60, 360, 70);
        A.tree(ctx, 490, 380, 70);
        A.ground(ctx, W, H, 440, '#1a2230');
        A.temple(ctx, 270, 230, 300);
        A.lantern(ctx, ART_FX.img0.lanterns[0].x, ART_FX.img0.lanterns[0].y, 24, 32);
        A.lantern(ctx, ART_FX.img0.lanterns[1].x, ART_FX.img0.lanterns[1].y, 24, 32);
        // C 位的金光
        A.warmGlow(ctx, 270, 450, 190, '255,200,90', 0.4);
        // 紙箱哥躲在樹後偷看
        ctx.save();
        ctx.translate(16, 330);
        ctx.scale(0.9, 0.9);
        NPC_SPRITES.boxbro.draw(ctx);
        ctx.restore();
        A.tree(ctx, 40, 520, 52);
        // 長椅 + 大字躺平的阿睿
        const s = 300 / BENCH.len;
        A.bench(ctx, 270, ART_FX.img0.bench.y, 300);
        ctx.save();
        ctx.translate(270 - (POSE_SPRITE.w / 2) * s, ART_FX.img0.bench.y - POSE_SPRITE.seatY * s);
        ctx.scale(s, s);
        A.drawPose(ctx, 3);
        ctx.restore();
        // 右邊照過來的手電筒
        const b = ART_FX.img0.beam;
        const g = ctx.createLinearGradient(b.x, b.y, 280, 450);
        g.addColorStop(0, 'rgba(255,248,210,0.55)');
        g.addColorStop(1, 'rgba(255,248,210,0.05)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 4);
        ctx.lineTo(220, 400);
        ctx.lineTo(300, 540);
        ctx.lineTo(b.x, b.y + 6);
        ctx.closePath();
        ctx.fill();
        ComicArtGenerator.applyComicFinish(ctx, W, H);
    }

    // 阿土伯留在 C 位長椅上的紙箱：「給撐到天亮的人」；cx, cy 為中心
    static farewellNote(ctx, cx, cy, rot = 0) {
        ComicArtGenerator.cardboard(ctx, cx, cy, 116, 62, rot, false);
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.fillStyle = 'rgba(40,24,10,0.92)';
        ctx.font = `900 17px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('給撐到', -6, -12);
        ctx.fillText('天亮的人', 4, 13);
        ctx.restore();
    }

    // 女兒騎機車載阿土伯離開（往右騎）；x = 車子中心，y = 地面
    static scooter(ctx, x, y) {
        const A = ComicArtGenerator;
        ctx.save();
        ctx.translate(x, y);
        ctx.lineJoin = 'round';
        // 速度線
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
            ctx.beginPath();
            ctx.moveTo(-160 - i * 10, -70 + i * 16);
            ctx.lineTo(-104 - i * 6, -70 + i * 16);
            ctx.stroke();
        }
        ctx.strokeStyle = ART_COLORS.ink;
        // 輪子
        [-48, 46].forEach(wx => {
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(wx, -16, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#6b7280';
            ctx.beginPath(); ctx.arc(wx, -16, 6, 0, Math.PI * 2); ctx.fill();
        });
        // 車身、座墊、車頭
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath();
        ctx.moveTo(-70, -30); ctx.lineTo(-20, -30); ctx.lineTo(10, -22); ctx.lineTo(30, -60);
        ctx.lineTo(44, -60); ctx.lineTo(56, -20); ctx.lineTo(60, -14); ctx.lineTo(-62, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1f2937';
        ctx.beginPath(); ctx.roundRect(-74, -44, 72, 14, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e5e7eb';
        ctx.beginPath(); ctx.roundRect(34, -84, 16, 28, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(-80, -42, 8, 9);
        ctx.strokeRect(-80, -42, 8, 9);
        // 後座的阿土伯：白汗衫、白髮，回頭揮手，茄芷袋掛在另一隻手上
        A.bag(ctx, -98, -74, 28, 24);
        A.limb(ctx, [[-58, -46], [-30, -44], [-28, -20]], 12, '#4b5563');
        A.limb(ctx, [[-58, -44], [-54, -96]], 26, '#e5e7eb');
        A.limb(ctx, [[-62, -88], [-78, -70], [-86, -66]], 9, '#e5e7eb');
        A.limb(ctx, [[-60, -92], [-86, -118], [-84, -146]], 9, '#e5e7eb');
        A.hand(ctx, -84, -150, 5, '#d4a07c');
        ctx.fillStyle = '#d4a07c';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(-54, -112, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f5f5f4';
        ctx.beginPath(); ctx.arc(-58, -116, 9, Math.PI * 0.6, Math.PI * 1.5); ctx.fill();
        ctx.beginPath(); ctx.arc(-58, -110, 5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
        // 騎車的女兒：紫外套、粉紅安全帽
        A.limb(ctx, [[-22, -46], [8, -44], [14, -18]], 12, '#1f2937');
        A.limb(ctx, [[-22, -44], [-12, -98]], 24, '#7c3aed');
        A.limb(ctx, [[-12, -92], [14, -82], [30, -90]], 9, '#7c3aed');
        A.hand(ctx, 31, -91, 4, '#d8a888');
        ctx.fillStyle = '#d8a888';
        ctx.beginPath(); ctx.arc(-8, -114, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#f472b6';
        ctx.beginPath(); ctx.arc(-9, -117, 14, Math.PI * 0.92, Math.PI * 2.08); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
    }

    // 阿睿的背影（舉手道別）；(x, y) = 頭的中心
    static ruiBack(ctx, x, y) {
        const A = ComicArtGenerator;
        const C = ART_COLORS;
        A.limb(ctx, [[x - 30, y + 72], [x - 52, y + 140], [x - 54, y + 190]], 20, C.parka);
        A.bag(ctx, x - 92, y + 118, 60, 46);
        A.limb(ctx, [[x, y + 220], [x, y + 66]], 84, C.parka);
        A.limb(ctx, [[x + 28, y + 70], [x + 70, y + 30], [x + 84, y - 18]], 20, C.parka);
        A.hand(ctx, x + 85, y - 24, 9);
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = C.hair;
        ctx.beginPath();
        ctx.moveTo(x - 30, y);
        ctx.lineTo(x - 26, y + 52);
        ctx.quadraticCurveTo(x, y + 62, x + 26, y + 52);
        ctx.lineTo(x + 30, y);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.beanie;
        ctx.beginPath(); ctx.arc(x, y - 8, 31, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = C.beanieRim;
        ctx.fillRect(x - 33, y - 14, 66, 12);
        ctx.strokeRect(x - 33, y - 14, 66, 12);
    }

    // 劇情二：阿土伯坐女兒的機車離開，C 位長椅上只留一張紙箱，阿睿在路邊揮手
    static drawFarewell(ctx, W, H) {
        const A = ComicArtGenerator;
        const sky = ctx.createLinearGradient(0, 0, 0, 470);
        sky.addColorStop(0, '#12162e');
        sky.addColorStop(0.55, '#4a2350');
        sky.addColorStop(1, '#b4532a');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, W, 470);
        A.city(ctx, W, 470, 23);
        A.tree(ctx, 470, 400, 64);
        A.ground(ctx, W, H, 446, '#1d2230');
        A.temple(ctx, 190, 250, 240);
        ART_FX.img1.lanterns.forEach(l => A.lantern(ctx, l.x, l.y, l.w, l.h));
        A.warmGlow(ctx, 190, 500, 150, '255,200,90', 0.3);
        A.bench(ctx, 190, 520, 260);
        A.farewellNote(ctx, 190, 488, -0.05);
        // 馬路
        ctx.fillStyle = '#1b1f29';
        ctx.fillRect(0, 600, W, 110);
        ctx.fillStyle = '#9ca3af';
        ctx.fillRect(0, 598, W, 5);
        ctx.fillStyle = 'rgba(250,204,21,0.7)';
        for (let x = 0; x < W; x += 46) ctx.fillRect(x, 654, 26, 4);
        A.scooter(ctx, 444, 694);
        A.ruiBack(ctx, 104, 640);
        A.applyComicFinish(ctx, W, H);
    }

    // 劇情三：寒流夜，全公園都盯著那張空出來的 C 位（做成電視新聞的寒流特報畫面）
    static drawColdNight(ctx, W, H) {
        const A = ComicArtGenerator;
        A.nightSky(ctx, W, 600, 31);
        A.tree(ctx, 270, 470, 90);
        // 石板地
        ctx.fillStyle = '#2a2f38';
        ctx.fillRect(0, 560, W, H - 560);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath(); ctx.moveTo(0, 600 + i * 48); ctx.lineTo(W, 600 + i * 48); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(W / 2 + (i - 4) * 40, 560); ctx.lineTo(W / 2 + (i - 4) * 140, H); ctx.stroke();
        }
        // 後面的廟牆 + 石窗：窗裡有兩雙眼睛在偷看
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(60, 300, 420, 270);
        ctx.strokeRect(60, 300, 420, 270);
        ctx.fillStyle = '#1a0505';
        ctx.beginPath(); ctx.arc(270, 420, 56, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        [[246, 404], [290, 438]].forEach(([ex, ey]) => {
            [0, 16].forEach(dx => {
                ctx.fillStyle = '#f5f5f4';
                ctx.beginPath(); ctx.ellipse(ex + dx, ey, 6, 4, 0, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#111';
                ctx.beginPath(); ctx.arc(ex + dx + 1, ey + 1, 2, 0, Math.PI * 2); ctx.fill();
            });
        });
        ctx.strokeStyle = '#b45309';
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(270 + i * 20, 368); ctx.lineTo(270 + i * 20, 472); ctx.stroke(); }
        A.offerings(ctx, 350, 500, 120);
        // 紙箱哥躲在左邊柱子後、廣場舞阿姨躲在右邊柱子後
        ctx.save();
        ctx.translate(10, 470);
        NPC_SPRITES.boxbro.draw(ctx);
        ctx.restore();
        ctx.save();
        ctx.translate(536, 470);
        ctx.scale(-1, 1);
        NPC_SPRITES.auntie.draw(ctx);
        ctx.restore();
        // 柱子
        ctx.fillStyle = '#991b1b';
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        [[24, 220], [480, 220]].forEach(([x, y]) => {
            ctx.fillRect(x, y, 40, 620);
            ctx.strokeRect(x, y, 40, 620);
        });
        // 屋簷
        ctx.fillStyle = '#431407';
        ctx.beginPath();
        ctx.moveTo(-10, 0);
        ctx.lineTo(W + 10, 0);
        ctx.lineTo(W + 10, 250);
        ctx.quadraticCurveTo(W / 2, 205, -10, 250);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        for (let x = -40; x < W + 40; x += 26) {
            ctx.beginPath(); ctx.moveTo(W / 2 + (x - W / 2) * 0.4, 0); ctx.lineTo(x, 236); ctx.stroke();
        }
        A.signBoard(ctx, 200, 244, 140, 34, '福德正神', '#111827', '#fbbf24', 20);
        ART_FX.img3.lanterns.forEach(l => A.lantern(ctx, l.x, l.y, 52, 66));
        // 空出來的 C 位：只剩阿土伯留下的紙箱
        A.warmGlow(ctx, 270, 612, 230, '255,200,90', 0.4);
        A.bench(ctx, 270, 612, 380);
        A.farewellNote(ctx, 270, 580, 0.04);
        // 電視新聞的寒流特報：右上角台標 + 下方跑馬燈
        A.signBoard(ctx, W - 200, 22, 58, 32, 'LIVE', '#dc2626', '#ffffff', 16);
        A.signBoard(ctx, W - 142, 22, 124, 32, '寒流特報 8°C', '#0f172a', '#ffffff', 15);
        ctx.fillStyle = '#0b2a6b';
        ctx.fillRect(0, 722, W, 36);
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.strokeRect(-2, 722, W + 4, 36);
        A.signBoard(ctx, 0, 722, 66, 36, '快訊', '#facc15', '#111827', 17);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 15px ${FONT_SERIF}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('寒流今晚報到｜平地低溫 8 度｜各地公園長椅一位難求', 78, 741);
        A.applyComicFinish(ctx, W, H);
    }

    // 劇情四：阿睿拉筋暖身，遠處的紙箱哥也在暖身
    static drawWarmup(ctx, W, H) {
        const A = ComicArtGenerator;
        const C = ART_COLORS;
        A.nightSky(ctx, W, 560, 41);
        A.moon(ctx, 110, 180, 26);
        A.city(ctx, W, 560, 17);
        A.tree(ctx, 50, 520, 60);
        A.ground(ctx, W, H, 560);
        A.lampPost(ctx, ART_FX.img4.lamp.x, ART_FX.img4.lamp.y, 760);
        A.bench(ctx, 230, 640, 360);
        // 遠處的紙箱哥：也在暖身，還「哼」了一聲
        ctx.save();
        ctx.translate(410, 530);
        ctx.scale(0.64, 0.64);
        NPC_SPRITES.boxbro.draw(ctx);
        ctx.restore();
        ctx.save();
        ctx.translate(500, 548);
        ctx.rotate(0.12);
        ctx.font = `900 24px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 6;
        ctx.strokeStyle = '#000';
        ctx.strokeText('哼！', 0, 0);
        ctx.fillStyle = '#e5e7eb';
        ctx.fillText('哼！', 0, 0);
        ctx.restore();
        A.bag(ctx, 30, 700, 84, 58);
        // 阿睿側彎拉筋，紙箱夾在腋下
        A.limb(ctx, [[206, 700], [168, 800], [160, 870]], 26, C.jeans);
        A.limb(ctx, [[222, 700], [262, 800], [278, 870]], 26, C.jeans);
        A.limb(ctx, [[214, 706], [244, 556]], 76, C.parka);
        A.cardboard(ctx, 320, 640, 54, 104, 0.18);
        A.limb(ctx, [[252, 568], [300, 612], [296, 652]], 22, C.parka);
        A.hand(ctx, 294, 656, 10);
        A.ruiHead(ctx, 262, 506, 32, 0.4, 'open');
        A.limb(ctx, [[230, 556], [192, 468], [250, 418]], 22, C.parka);
        A.hand(ctx, 254, 414, 10);
        A.warmGlow(ctx, 318, 540, 26, '230,240,250', 0.5);
        // 喀啦！
        ctx.save();
        ctx.translate(366, 590);
        ctx.rotate(-0.15);
        ctx.font = `900 30px ${FONT_SERIF}`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000';
        ctx.strokeText('喀啦！', 0, 0);
        ctx.fillStyle = '#facc15';
        ctx.fillText('喀啦！', 0, 0);
        ctx.restore();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 3;
        [[-0.9, 0], [-0.4, 0], [0.1, 0]].forEach(([a]) => {
            ctx.beginPath();
            ctx.moveTo(226 + Math.cos(a) * 46, 640 + Math.sin(a) * 46);
            ctx.lineTo(226 + Math.cos(a) * 66, 640 + Math.sin(a) * 66);
            ctx.stroke();
        });
        A.applyComicFinish(ctx, W, H);
    }

    static drawParkMap(ctx, W, H) {
        const A = ComicArtGenerator;
        // 草地
        ctx.fillStyle = '#10251b';
        ctx.fillRect(0, 0, W, H);
        const r = A.rng(17);
        for (let i = 0; i < 260; i++) {
            ctx.fillStyle = r() < 0.5 ? 'rgba(30,70,45,0.5)' : 'rgba(8,20,14,0.5)';
            ctx.beginPath();
            ctx.arc(r() * W, r() * H, 4 + r() * 14, 0, Math.PI * 2);
            ctx.fill();
        }
        // 公園外的馬路和大樓
        ctx.fillStyle = '#0c1018';
        ctx.fillRect(0, 0, W, 150);
        A.city(ctx, W, 96, 13);
        ctx.fillStyle = '#1b2029';
        ctx.fillRect(0, 96, W, 44);
        ctx.fillStyle = 'rgba(250,204,21,0.6)';
        for (let x = 10; x < W; x += 40) ctx.fillRect(x, 117, 22, 3);
        ctx.fillStyle = '#374151';
        for (let x = 0; x < W; x += 14) ctx.fillRect(x, 144, 8, 8);

        // 步道：從中間的土地公廟（C 位）連到四個角落
        const center = PARK_SPOTS[4].mapPos;
        const paths = [[118, 292], [418, 262], [428, 478], [122, 508], [272, 640], [272, 170]];
        [['#2b3038', 34], ['#454b55', 24]].forEach(([c, w]) => {
            ctx.strokeStyle = c;
            ctx.lineWidth = w;
            ctx.lineCap = 'round';
            paths.forEach(([x, y]) => {
                ctx.beginPath();
                ctx.moveTo(center.x, center.y);
                ctx.quadraticCurveTo((center.x + x) / 2 + (y - center.y) * 0.25, (center.y + y) / 2, x, y);
                ctx.stroke();
            });
            ctx.beginPath();
            ctx.ellipse(center.x, center.y, 70, 52, 0, 0, Math.PI * 2);
            ctx.stroke();
        });
        // 池塘
        ctx.fillStyle = '#0c2a3d';
        ctx.strokeStyle = ART_COLORS.ink;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(470, 372, 56, 34, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(147,197,253,0.4)';
        ctx.beginPath(); ctx.ellipse(462, 366, 28, 10, -0.2, 0, Math.PI); ctx.stroke();
        // 樹
        [[40, 200, 26], [210, 230, 22], [340, 200, 24], [500, 190, 26], [40, 400, 28], [200, 560, 24], [350, 580, 26],
            [500, 600, 28], [60, 620, 26], [180, 380, 18], [370, 430, 18]].forEach(([x, y, rr]) => {
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.beginPath(); ctx.ellipse(x + 6, y + 8, rr, rr * 0.7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#163a2a';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            ctx.fillStyle = 'rgba(80,140,90,0.35)';
            ctx.beginPath(); ctx.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.4, 0, Math.PI * 2); ctx.fill();
        });

        // 地標（俯視的小圖）
        ctx.save();
        ctx.translate(118, 238); ctx.scale(0.42, 0.42);
        A.pavilion(ctx, -90, 40, 180);
        ctx.restore();
        ctx.save();
        ctx.translate(380, 160); ctx.scale(0.5, 0.5);
        A.slide(ctx, 0, 60);
        ctx.restore();
        A.building(ctx, 410, 404, 76, 50, '#334155');
        A.signBoard(ctx, 422, 414, 52, 20, 'W.C.', '#1d4ed8', '#fff', 12);
        A.building(ctx, 66, 434, 92, 52, '#3f3f46');
        ctx.fillStyle = '#fde68a';
        ctx.fillRect(74, 448, 24, 18);
        A.signBoard(ctx, 102, 446, 48, 18, '管理室', '#f5f5f4', '#111', 10);
        A.warmGlow(ctx, center.x, center.y - 20, 110, '255,200,90', 0.35);
        ctx.save();
        ctx.translate(center.x, center.y - 76); ctx.scale(0.36, 0.36);
        A.temple(ctx, 0, 0, 300);
        ctx.restore();

        // 每個位子的長椅
        PARK_SPOTS.forEach(spot => {
            const { x, y } = spot.mapPos;
            ctx.fillStyle = ART_COLORS.woodLight;
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.fillRect(x - 20, y - 6, 40, 12);
            ctx.strokeRect(x - 20, y - 6, 40, 12);
        });
        // 路燈
        ART_FX.img2.lamps.forEach(l => {
            A.warmGlow(ctx, l.x, l.y, 36, '255,236,170', 0.45);
            ctx.fillStyle = '#fef3c7';
            ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill();
        });
        // 夜色
        ctx.fillStyle = 'rgba(5,8,20,0.35)';
        ctx.fillRect(0, 0, W, H);
        ComicArtGenerator.applyComicFinish(ctx, W, H);
    }

    static applyComicFinish(ctx, W, H) {
        ctx.save();
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 120; i++) {
            const x = (i * 37) % W;
            const y = (i * 83) % H;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 8, y + 24);
            ctx.stroke();
        }
        const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.65);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(4,6,10,0.6)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, W, H);
        ctx.restore();
    }
}

/**
 * ============================================================================
 * 公園裡的路人（140x240，腳底在 y = 236、臉朝右；從右邊進場時左右翻轉）
 * ============================================================================
 */
const NPC_SIZE = { w: 140, h: 240 };

// 站著的人：o = { skin, top, bottom, shoes, hipY, shoulderY, headY, backArm, frontArm, legs }
function npcPerson(ctx, o) {
    const A = ComicArtGenerator;
    const hipY = o.hipY ?? 150;
    const shoulderY = o.shoulderY ?? 88;
    const headY = o.headY ?? 60;
    const legs = o.legs ?? [[[62, hipY], [58, 230]], [[78, hipY], [84, 230]]];
    if (o.backArm) A.limb(ctx, o.backArm, 13, o.top);
    legs.forEach(pts => A.limb(ctx, pts, 15, o.bottom));
    ctx.fillStyle = o.shoes ?? '#111';
    ctx.strokeStyle = ART_COLORS.ink;
    ctx.lineWidth = 2;
    legs.forEach(pts => {
        const [fx, fy] = pts[pts.length - 1];
        ctx.beginPath(); ctx.ellipse(fx + 5, fy + 2, 11, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    A.limb(ctx, [[70, hipY + 2], [70, shoulderY]], o.bodyW ?? 38, o.top);
    if (o.frontArm) {
        A.limb(ctx, o.frontArm, 13, o.top);
        const [hx, hy] = o.frontArm[o.frontArm.length - 1];
        A.hand(ctx, hx, hy, 5, o.skin);
    }
    ctx.fillStyle = o.skin;
    ctx.strokeStyle = ART_COLORS.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(72, headY, 16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(86, headY - 2); ctx.lineTo(93, headY + 6); ctx.lineTo(86, headY + 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ART_COLORS.ink;
    ctx.beginPath(); ctx.arc(80, headY - 3, 2, 0, Math.PI * 2); ctx.fill();
}

const NPC_SPRITES = {
    // 巡守員：鴨舌帽、螢光背心，手電筒往前照（光束起點 beam）
    patrol: {
        beam: { x: 136, y: 104 },
        draw(ctx) {
            npcPerson(ctx, {
                skin: '#d6a585', top: '#1e3a5f', bottom: '#172033',
                backArm: [[64, 92], [52, 130], [56, 160]],
                frontArm: [[74, 92], [100, 104], [116, 104]]
            });
            ComicArtGenerator.limb(ctx, [[70, 146], [70, 96]], 30, '#bef264');
            ctx.fillStyle = '#e5e7eb';
            ctx.fillRect(56, 112, 28, 5);
            ctx.fillRect(56, 128, 28, 5);
            ctx.fillStyle = '#1e3a5f';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(72, 52, 17, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillRect(72, 48, 26, 6);
            ctx.strokeRect(72, 48, 26, 6);
            ctx.fillStyle = '#111';
            ctx.save();
            ctx.translate(116, 104);
            ctx.fillRect(0, -6, 18, 12);
            ctx.strokeRect(0, -6, 18, 12);
            ctx.fillStyle = '#fef9c3';
            ctx.fillRect(16, -7, 5, 14);
            ctx.restore();
        }
    },
    // 廣場舞阿姨：燙捲髮、花上衣、拉著卡拉 OK 音響推車
    auntie: {
        draw(ctx) {
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#27272a';
            ctx.beginPath(); ctx.roundRect(100, 170, 36, 52, 4); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#52525b';
            [184, 206].forEach(y => { ctx.beginPath(); ctx.arc(118, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
            ctx.fillStyle = '#111';
            [[106, 228], [130, 228]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill(); });
            ctx.beginPath(); ctx.moveTo(104, 172); ctx.lineTo(98, 128); ctx.stroke();
            npcPerson(ctx, {
                skin: '#e0b090', top: '#db2777', bottom: '#18181b',
                backArm: [[64, 92], [44, 76], [36, 56]],
                frontArm: [[74, 94], [90, 118], [98, 128]]
            });
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            [[62, 104], [78, 120], [64, 134], [76, 98]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); });
            ctx.fillStyle = '#3b1d2e';
            ctx.strokeStyle = ART_COLORS.ink;
            [[58, 50], [68, 42], [80, 44], [60, 62], [86, 52]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
            ctx.fillStyle = '#fde68a';
            ctx.font = `900 18px ${FONT_SERIF}`;
            ctx.fillText('♪', 122, 156);
        }
    },
    // 宿敵紙箱哥：背上一大疊紙箱、紅毛帽、大鬍子
    boxbro: {
        draw(ctx) {
            const A = ComicArtGenerator;
            A.cardboard(ctx, 42, 128, 48, 52, -0.05);
            A.cardboard(ctx, 40, 82, 44, 44, 0.06);
            A.cardboard(ctx, 44, 44, 36, 34, -0.08);
            npcPerson(ctx, {
                skin: '#c99a7a', top: '#6b4f2a', bottom: '#2f3b2b',
                backArm: [[64, 92], [56, 126], [62, 156]],
                frontArm: [[76, 94], [92, 126], [96, 150]]
            });
            ctx.fillStyle = '#1c1917';
            ctx.beginPath(); ctx.arc(76, 70, 13, 0.1 * Math.PI, 0.95 * Math.PI); ctx.fill();
            ctx.fillStyle = '#b91c1c';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(72, 54, 17, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    },
    // 鴿王阿伯：汗衫短褲拖鞋，手上一袋飼料，腳邊一群鴿子
    pigeons: {
        draw(ctx) {
            npcPerson(ctx, {
                skin: '#d4a07c', top: '#e5e7eb', bottom: '#a3895f', shoes: '#1d4ed8',
                hipY: 158, shoulderY: 104, headY: 80, bodyW: 34,
                legs: [[[63, 158], [60, 230]], [[77, 158], [82, 230]]],
                backArm: [[64, 106], [44, 92], [36, 76]],
                frontArm: [[74, 108], [92, 132], [102, 146]]
            });
            ctx.fillStyle = '#f5f5f4';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(96, 144, 18, 22, 3); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#d6d3d1';
            ctx.beginPath(); ctx.arc(60, 76, 7, 0, Math.PI * 2); ctx.fill();
            [[104, 222], [124, 214], [116, 232], [132, 228], [96, 206]].forEach(([x, y], i) => {
                ctx.fillStyle = i % 2 ? '#6b7280' : '#9ca3af';
                ctx.beginPath(); ctx.ellipse(x, y, 9, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(x + 8, y - 5, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            });
        }
    },
    // 找暗處的情侶：手牽手，頭上一顆愛心
    couple: {
        draw(ctx) {
            ctx.save();
            ctx.translate(-22, 30);
            ctx.scale(0.86, 0.86);
            npcPerson(ctx, {
                skin: '#e8b996', top: '#f472b6', bottom: '#1f2937',
                backArm: [[64, 92], [56, 126], [60, 152]],
                frontArm: [[76, 94], [96, 126], [112, 140]]
            });
            ctx.fillStyle = '#1c1917';
            ctx.beginPath(); ctx.arc(66, 58, 18, Math.PI * 0.9, Math.PI * 2.05); ctx.lineTo(52, 100); ctx.closePath(); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(26, 22);
            ctx.scale(0.9, 0.9);
            npcPerson(ctx, {
                skin: '#d8a888', top: '#2563eb', bottom: '#111827',
                backArm: [[64, 92], [50, 126], [48, 140]],
                frontArm: [[76, 94], [86, 128], [88, 152]]
            });
            ctx.fillStyle = '#111827';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(72, 52, 17, Math.PI, Math.PI * 2); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.restore();
            ctx.fillStyle = '#f472b6';
            ctx.font = `900 26px ${FONT_SERIF}`;
            ctx.fillText('♥', 58, 30);
        }
    },
    // 醉漢：歪一邊、臉紅、拎著酒瓶
    drunk: {
        draw(ctx) {
            ctx.save();
            ctx.translate(70, 236);
            ctx.rotate(0.14);
            ctx.translate(-70, -236);
            npcPerson(ctx, {
                skin: '#e08a7a', top: '#d6d3d1', bottom: '#4b5563',
                backArm: [[64, 92], [40, 110], [30, 100]],
                frontArm: [[76, 94], [104, 86], [114, 70]]
            });
            ctx.fillStyle = '#15803d';
            ctx.strokeStyle = ART_COLORS.ink;
            ctx.lineWidth = 2;
            ctx.save();
            ctx.translate(114, 66);
            ctx.rotate(-0.5);
            ctx.fillRect(-6, -26, 12, 30);
            ctx.strokeRect(-6, -26, 12, 30);
            ctx.fillRect(-3, -36, 6, 10);
            ctx.restore();
            ctx.fillStyle = 'rgba(220,38,38,0.5)';
            ctx.beginPath(); ctx.arc(80, 66, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1c1917';
            ctx.beginPath(); ctx.arc(70, 50, 15, Math.PI, Math.PI * 1.8); ctx.fill();
            ctx.restore();
        }
    },
    // 晨運太極阿伯：白色太極服、白髮，雙手推掌
    taichi: {
        draw(ctx) {
            npcPerson(ctx, {
                skin: '#d8ab8a', top: '#f5f5f4', bottom: '#e7e5e4', shoes: '#111',
                legs: [[[62, 150], [44, 230]], [[78, 150], [96, 230]]],
                backArm: [[64, 92], [44, 70], [36, 44]],
                frontArm: [[76, 94], [104, 92], [126, 90]]
            });
            ctx.fillStyle = '#e5e7eb';
            ctx.beginPath(); ctx.arc(66, 50, 12, Math.PI, Math.PI * 1.9); ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(70, 96); ctx.lineTo(70, 146); ctx.stroke();
        }
    }
};
