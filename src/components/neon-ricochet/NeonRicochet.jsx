import { A } from '@solidjs/router';
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { muted, playSound, toggleMuted } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import SoundToggle from '../ui/SoundToggle';
import { advanceRun, aim, chooseUpgrade, createRun, HEIGHT, launch, LEVELS, MODES, POWERUPS, pulse, SECTORS, SHIPS, UPGRADES, WIDTH } from './engine';
import { createNeonMusic } from './music';
import './ricochet.css';

const TIMED_POWERS = ['wide', 'slow', 'laser', 'fire', 'magnet'];
const snapshot = run => ({
	phase: run.phase, sector: run.sector, mode: run.mode, stage: run.stage, stageTotal: run.stageTotal, score: run.score, lives: run.lives,
	combo: run.combo, maxCombo: run.maxCombo, bricks: run.bricks.filter(b => b.hp > 0).length,
	totalBricks: run.bricks.length, balls: run.balls.length, held: run.balls.some(b => b.held),
	shield: run.shield, powersCaught: run.powersCaught, ship: run.ship,
	energy: Math.floor(run.energy), pulses: run.pulses, bossesDefeated: run.bossesDefeated,
	bossHp: run.boss?.hp || 0, bossMax: run.boss?.maxHp || 1, bossName: run.boss?.name || '',
	bossCharging: run.boss?.phase === 'charging', upgrades: { ...run.upgrades }, offers: [...run.offers],
	...Object.fromEntries(TIMED_POWERS.map(kind => [kind, Math.ceil(run[kind] || 0)])),
});
const safeNumber = (value, maximum = Number.MAX_SAFE_INTEGER) => Number.isFinite(value) ? Math.min(maximum, Math.max(0, Math.floor(value))) : 0;
const formatScore = score => score.toLocaleString();
const recordKey = mode => mode === 'bossrush' ? 'ricochet-bossrush-best' : 'ricochet-best';
const readBest = mode => { const raw = load(recordKey(mode), {}); return { score: safeNumber(raw?.score), sector: safeNumber(raw?.sector, SECTORS), combo: safeNumber(raw?.combo), stage: safeNumber(raw?.stage, MODES[mode].route.length) }; };

function roundedRect(ctx, x, y, width, height, radius = 4) {
	const r = Math.min(radius, width / 2, height / 2);
	ctx.beginPath();
	ctx.moveTo(x + r, y); ctx.lineTo(x + width - r, y); ctx.quadraticCurveTo(x + width, y, x + width, y + r);
	ctx.lineTo(x + width, y + height - r); ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
	ctx.lineTo(x + r, y + height); ctx.quadraticCurveTo(x, y + height, x, y + height - r);
	ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

function PilotArt(props) {
	return <svg viewBox="0 0 160 84" class="nr-pilot-art" aria-hidden="true" style={{ color: SHIPS[props.ship].color }}>
		<ellipse cx="80" cy="66" rx="56" ry="8" fill="currentColor" opacity="0.07" />
		<path d="M74 56 L80 80 L86 56" fill="currentColor" opacity="0.3" />
		<Show when={props.ship === 'courier'}><path d="M80 7 L96 35 L135 61 L128 70 L96 59 L80 67 L64 59 L32 70 L25 61 L64 35 Z" fill="#152a3a" stroke="currentColor" stroke-width="1.5" /><path d="M80 7 L89 42 L80 57 L71 42 Z" fill="currentColor" opacity="0.6" /><path d="M36 60 L63 47 M124 60 L97 47" stroke="currentColor" stroke-width="3" /></Show>
		<Show when={props.ship === 'bulwark'}><path d="M80 12 L99 29 L121 31 L138 54 L136 69 L102 66 L92 58 L68 58 L58 66 L24 69 L22 54 L39 31 L61 29 Z" fill="#20273b" stroke="currentColor" stroke-width="1.5" /><path d="M70 30 L90 30 L95 46 L80 57 L65 46 Z" fill="currentColor" opacity="0.6" /><path d="M35 40 L41 58 L58 56 M125 40 L119 58 L102 56" fill="none" stroke="currentColor" stroke-width="4" /></Show>
		<Show when={props.ship === 'interceptor'}><path d="M80 3 L90 32 L112 21 L105 44 L130 68 L97 61 L80 68 L63 61 L30 68 L55 44 L48 21 L70 32 Z" fill="#302034" stroke="currentColor" stroke-width="1.5" /><path d="M80 9 L86 43 L80 56 L74 43 Z" fill="currentColor" opacity="0.75" /><path d="M46 62 L63 51 M114 62 L97 51" stroke="currentColor" stroke-width="2.5" /></Show>
		<path d="M78 28 L82 28 L85 40 L80 44 L75 40 Z" fill="#eaffff" opacity="0.9" />
	</svg>;
}

export default function NeonRicochet() {
	const savedShip = load('ricochet-ship', 'courier');
	const initialShip = typeof savedShip === 'string' && Object.hasOwn(SHIPS, savedShip) ? savedShip : 'courier';
	const savedMode = load('ricochet-mode', 'campaign');
	const initialMode = typeof savedMode === 'string' && Object.hasOwn(MODES, savedMode) ? savedMode : 'campaign';
	let run = createRun({ ship: initialShip, mode: initialMode }), canvas, ctx, frame, last = 0, media, sectorButton, draftButton, consoleElement, music, backdrop, backdropSector = 0;
	let shake = 0, callout = null, previousCombo = 0;
	let left = false, right = false, visible = true, reduced = false;
	let savedRun = false, hudKey = '', comboAwarded = false, collectionAwarded = false, depthAwarded = false, novaAwarded = false, bossAwarded = false, buildAwarded = false;
	const [hud, setHud] = createSignal(snapshot(run));
	const [paused, setPaused] = createSignal(false);
	const [selectedShip, setSelectedShip] = createSignal(initialShip);
	const [selectedMode, setSelectedMode] = createSignal(initialMode);
	const [effectsOn, setEffectsOn] = createSignal(load('ricochet-effects', true) !== false);
	const [motionReduced, setMotionReduced] = createSignal(false);
	const [musicOn, setMusicOn] = createSignal(false);
	const [fullscreen, setFullscreen] = createSignal(false);
	const [canFullscreen, setCanFullscreen] = createSignal(false);
	const [best, setBest] = createSignal(readBest(initialMode));
	const [announcement, setAnnouncement] = createSignal(`${SECTORS} sectors. Three bosses. Choose a ship, build your loadout, and restore the signal.`);
	const level = () => LEVELS[hud().sector - 1];
	const route = () => MODES[hud().mode].route;
	const activePowers = () => TIMED_POWERS.filter(kind => hud()[kind] > 0);
	const terminal = () => ['won', 'over'].includes(hud().phase);
	const drafting = () => hud().phase === 'upgrade';
	const perkCount = () => Object.values(hud().upgrades).reduce((total, count) => total + count, 0);
	const activePerks = () => Object.entries(hud().upgrades).filter(([, count]) => count > 0);
	const pulseReady = () => hud().energy >= 100 && hud().phase === 'playing' && !paused();
	const lively = () => effectsOn() && !reduced;
	const status = () => paused() ? 'Paused' : hud().phase === 'upgrade' ? 'Choose an upgrade' : hud().phase === 'ready' ? 'Ready to launch' : hud().phase === 'playing' ? 'Signal active' : hud().phase === 'won' ? `${MODES[hud().mode].name} complete` : 'Run complete';
	const saveRecord = () => {
		const record = { score: Math.max(best().score, safeNumber(run.score)), sector: Math.max(best().sector, safeNumber(run.sector, SECTORS)), combo: Math.max(best().combo, safeNumber(run.maxCombo)), stage: Math.max(best().stage || 0, safeNumber(run.stage, run.stageTotal)), version: 3, totalSectors: run.stageTotal, mode: run.mode };
		setBest(record); save(recordKey(run.mode), record);
	};
	const publish = () => {
		if (run.maxCombo >= 8 && !comboAwarded) { comboAwarded = true; unlock('ricochet-combo'); }
		if (run.powersCaught >= 8 && !collectionAwarded) { collectionAwarded = true; unlock('ricochet-loadout'); }
		if (run.mode === 'campaign' && run.sector >= 7 && !depthAwarded) { depthAwarded = true; unlock('ricochet-deep-space'); }
		if (run.pulses > 0 && !novaAwarded) { novaAwarded = true; unlock('ricochet-nova'); }
		if (run.bossesDefeated > 0 && !bossAwarded) { bossAwarded = true; unlock('ricochet-boss'); }
		if (Object.values(run.upgrades).reduce((total, count) => total + count, 0) >= 5 && !buildAwarded) { buildAwarded = true; unlock('ricochet-build'); }
		const next = snapshot(run), key = JSON.stringify(next);
		const newDraft = run.phase === 'upgrade' && hud().phase !== 'upgrade';
		if (key !== hudKey) { hudKey = key; setHud(next); }
		if (newDraft) { left = right = false; setAnnouncement('Upgrade uplink ready. Choose one of three permanent perks. The arena is frozen.'); queueMicrotask(() => draftButton?.focus({ preventScroll: true })); }
		if (!savedRun && ['won', 'over'].includes(run.phase)) {
			savedRun = true;
			saveRecord();
			setAnnouncement(run.phase === 'won' ? `${MODES[run.mode].name} complete. ${formatScore(run.score)} points. ${run.bossesDefeated} bosses defeated. The crown is yours.` : `Run complete. ${formatScore(run.score)} points, sector ${run.sector}, ${run.powersCaught} power-ups caught.`);
			queueMicrotask(() => sectorButton?.focus({ preventScroll: true }));
		}
	};
	const paintBackdrop = () => {
		backdrop ??= document.createElement('canvas'); backdrop.width = WIDTH; backdrop.height = HEIGHT;
		const bg = backdrop.getContext('2d'); if (!bg) return;
		const color = LEVELS[run.sector - 1].color;
		bg.fillStyle = '#060a18'; bg.fillRect(0, 0, WIDTH, HEIGHT);
		const nebula = bg.createRadialGradient(WIDTH * 0.76, HEIGHT * 0.17, 4, WIDTH * 0.76, HEIGHT * 0.17, WIDTH * 0.65);
		nebula.addColorStop(0, `${color}24`); nebula.addColorStop(0.45, '#33367d20'); nebula.addColorStop(1, '#060a1800');
		bg.fillStyle = nebula; bg.fillRect(0, 0, WIDTH, HEIGHT);
		const aurora = bg.createRadialGradient(100, 260, 5, 100, 260, 330);
		aurora.addColorStop(0, '#623db41c'); aurora.addColorStop(1, '#060a1800'); bg.fillStyle = aurora; bg.fillRect(0, 0, WIDTH, HEIGHT);
		for (let i = 0; i < 88; i++) {
			bg.globalAlpha = i % 4 === 0 ? 0.55 : 0.2;
			bg.fillStyle = i % 5 === 0 ? color : '#d9e9ff'; const size = i % 11 === 0 ? 2 : 1;
			bg.fillRect((i * 137 + 41) % WIDTH, (i * 83 + 22) % HEIGHT, size, size);
		}
		bg.globalAlpha = 1;
		bg.strokeStyle = '#38546a22'; bg.lineWidth = 1;
		for (let i = -5; i <= 5; i++) { bg.beginPath(); bg.moveTo(WIDTH / 2 + i * 23, 282); bg.lineTo(WIDTH / 2 + i * 142, HEIGHT); bg.stroke(); }
		for (let i = 1; i <= 8; i++) { const y = 282 + i * i * 3.6; bg.beginPath(); bg.moveTo(0, y); bg.lineTo(WIDTH, y); bg.stroke(); }
		bg.strokeStyle = `${color}55`; bg.beginPath(); bg.moveTo(8, 62); bg.lineTo(8, HEIGHT - 60); bg.moveTo(WIDTH - 8, 62); bg.lineTo(WIDTH - 8, HEIGHT - 60); bg.stroke();
		bg.fillStyle = '#e4efff04'; bg.font = '900 160px system-ui'; bg.textAlign = 'center'; bg.fillText(String(run.sector).padStart(2, '0'), WIDTH / 2, 405);
		backdropSector = run.sector;
	};
	const draw = () => {
		if (!ctx) return;
		if (backdropSector !== run.sector) paintBackdrop();
		ctx.fillStyle = '#060a18'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
		ctx.save();
		if (lively() && shake > 0 && !paused()) ctx.translate(Math.sin(run.time * 92) * shake * 13, Math.cos(run.time * 77) * shake * 9);
		if (backdrop) ctx.drawImage(backdrop, 0, 0);
		if (lively()) {
			ctx.fillStyle = '#cedfff'; ctx.globalAlpha = 0.3;
			for (let i = 0; i < 22; i++) ctx.fillRect((i * 137 + 47 + run.time * (3 + i % 3)) % WIDTH, (i * 89 + 54 + run.time * (1 + i % 2)) % HEIGHT, 1, 1);
			ctx.globalAlpha = 1;
		}
		ctx.shadowBlur = 0; ctx.globalAlpha = 1;
		ctx.font = '600 11px system-ui'; ctx.fillStyle = '#b0c4df'; ctx.textAlign = 'left';
		ctx.fillText(`${String(run.sector).padStart(2, '0')}  /  ${LEVELS[run.sector - 1].name.toUpperCase()}`, 30, 32);
		ctx.textAlign = 'right'; ctx.fillText(`${run.bricks.filter(b => b.hp > 0).length} SIGNALS LEFT`, WIDTH - 30, 32);
		ctx.strokeStyle = '#8298c02e'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, 46); ctx.lineTo(WIDTH - 30, 46); ctx.stroke();
		for (const b of run.bricks) {
			if (b.hp <= 0) continue;
			const blast = b.kind === 'blast', armored = b.maxHp > 1, color = blast ? '#ffb365' : b.color;
			ctx.shadowBlur = !lively() ? 0 : blast ? 13 : 7; ctx.shadowColor = color;
			const surface = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
			surface.addColorStop(0, `${color}ed`); surface.addColorStop(1, `${color}85`);
			ctx.fillStyle = surface; roundedRect(ctx, b.x, b.y, b.w, b.h, 4); ctx.fill(); ctx.shadowBlur = 0;
			ctx.strokeStyle = `${color}dd`; ctx.lineWidth = 1; ctx.stroke();
			ctx.fillStyle = '#ffffff4a'; roundedRect(ctx, b.x + 4, b.y + 3, b.w - 8, 2, 1); ctx.fill();
			if (armored) {
				ctx.strokeStyle = '#09112288'; ctx.lineWidth = 1;
				roundedRect(ctx, b.x + 5, b.y + 6, b.w - 10, b.h - 11, 2); ctx.stroke();
				for (let i = 0; i < b.hp; i++) { ctx.fillStyle = '#071326ad'; ctx.fillRect(b.x + b.w / 2 - b.hp * 3 + i * 6, b.y + b.h / 2, 3, 3); }
			}
			if (blast) { ctx.fillStyle = '#381b09'; ctx.font = '800 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText('✦', b.x + b.w / 2, b.y + b.h / 2 + 4); }
		}
		if (lively()) for (const p of run.particles) {
			ctx.globalAlpha = Math.max(0, p.life / (p.maxLife || 0.45)); ctx.fillStyle = p.color;
			ctx.fillRect(p.x, p.y, p.size || 3, p.size || 3);
		}
		ctx.globalAlpha = 1;
		for (const bumper of run.bumpers) {
			ctx.save(); ctx.translate(bumper.x, bumper.y);
			ctx.fillStyle = '#10192d'; ctx.strokeStyle = bumper.color; ctx.lineWidth = 2;
			ctx.shadowBlur = lively() ? 12 : 0; ctx.shadowColor = bumper.color;
			ctx.beginPath(); ctx.arc(0, 0, bumper.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
			ctx.strokeStyle = `${bumper.color}88`; ctx.lineWidth = 1;
			ctx.beginPath(); ctx.arc(0, 0, bumper.radius - 6, 0, Math.PI * 2); ctx.stroke();
			for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + (lively() ? run.time * 0.7 : 0); ctx.fillStyle = bumper.color; ctx.beginPath(); ctx.arc(Math.cos(a) * (bumper.radius - 3), Math.sin(a) * (bumper.radius - 3), 2, 0, Math.PI * 2); ctx.fill(); }
			ctx.fillStyle = '#dce7ff'; ctx.font = '700 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('+', 0, 5); ctx.restore();
		}
		const boss = run.boss;
		if (boss?.hp > 0) {
			const color = boss.color || '#ff7eae', charging = boss.phase === 'charging';
			const centerX = boss.x + boss.w / 2, centerY = boss.y + boss.h / 2;
			if (charging) {
				ctx.save(); ctx.globalAlpha = 0.32; ctx.setLineDash([5, 7]); ctx.strokeStyle = '#ffb481'; ctx.lineWidth = 1;
				ctx.beginPath(); ctx.moveTo(centerX, boss.y + boss.h); ctx.lineTo(boss.targetX || run.paddle.x, HEIGHT - 42); ctx.stroke(); ctx.setLineDash([]);
				ctx.globalAlpha = 0.85; ctx.strokeStyle = '#ffb481'; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.arc(centerX, centerY, boss.h / 2 + 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (boss.telegraph || 0)); ctx.stroke(); ctx.restore();
			}
			ctx.save(); ctx.translate(centerX, centerY);
			ctx.shadowBlur = lively() ? 14 : 0; ctx.shadowColor = color;
			ctx.fillStyle = boss.flash > 0 && lively() ? '#eaffff' : '#25243c'; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.moveTo(-boss.w / 2, -8); ctx.lineTo(-boss.w * 0.35, -boss.h / 2); ctx.lineTo(-boss.w * 0.16, -12); ctx.lineTo(0, -boss.h / 2); ctx.lineTo(boss.w * 0.16, -12); ctx.lineTo(boss.w * 0.35, -boss.h / 2); ctx.lineTo(boss.w / 2, -8); ctx.lineTo(boss.w * 0.44, boss.h / 2); ctx.lineTo(boss.w * 0.2, 10); ctx.lineTo(0, boss.h / 2); ctx.lineTo(-boss.w * 0.2, 10); ctx.lineTo(-boss.w * 0.44, boss.h / 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
			for (const direction of [-1, 1]) {
				ctx.strokeStyle = `${color}aa`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(direction * boss.w * 0.2, -1); ctx.lineTo(direction * boss.w * 0.38, 5); ctx.lineTo(direction * boss.w * 0.43, -5); ctx.stroke();
				ctx.fillStyle = charging ? '#ffd7ad' : color; roundedRect(ctx, direction * boss.w * 0.28 - 4, 11, 8, 10, 2); ctx.fill();
			}
			ctx.fillStyle = charging ? '#ffb481' : color; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(15, 0); ctx.lineTo(0, 12); ctx.lineTo(-15, 0); ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#f3f9ff'; roundedRect(ctx, -7, -2, 14, 4, 2); ctx.fill();
			ctx.restore();
		}
		for (const shot of run.enemyShots) {
			const radius = (shot.radius || 6) + 2;
			ctx.fillStyle = shot.color || '#ff789d'; ctx.strokeStyle = '#ffd5de'; ctx.lineWidth = 1;
			ctx.shadowBlur = lively() ? 9 : 0; ctx.shadowColor = shot.color || '#ff789d';
			ctx.beginPath(); ctx.moveTo(shot.x, shot.y - radius); ctx.lineTo(shot.x + radius, shot.y); ctx.lineTo(shot.x, shot.y + radius); ctx.lineTo(shot.x - radius, shot.y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
		}
		if (lively()) for (const wave of run.shockwaves) {
			ctx.globalAlpha = Math.max(0, wave.life / wave.maxLife) * 0.8;
			ctx.strokeStyle = '#b1fff0'; ctx.lineWidth = lively() ? 4 : 2;
			ctx.beginPath(); ctx.arc(wave.x, wave.y, wave.radius, 0, Math.PI * 2); ctx.stroke();
			if (lively()) { ctx.globalAlpha *= 0.3; ctx.lineWidth = 10; ctx.stroke(); }
		}
		ctx.globalAlpha = 1;
		for (const drop of run.drops) {
			const power = POWERUPS[drop.kind]; if (!power) continue;
			ctx.save(); ctx.translate(drop.x, drop.y);
			ctx.shadowBlur = !lively() ? 0 : 13; ctx.shadowColor = power.color;
			ctx.fillStyle = '#101a30'; ctx.strokeStyle = power.color; ctx.lineWidth = 2;
			roundedRect(ctx, -14, -14, 28, 28, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
			ctx.fillStyle = power.color; ctx.font = '800 15px system-ui'; ctx.textAlign = 'center'; ctx.fillText(power.glyph, 0, 5); ctx.restore();
		}
		if (run.shield > 0) {
			ctx.strokeStyle = POWERUPS.shield.color; ctx.lineWidth = 3; ctx.shadowBlur = !lively() ? 0 : 12; ctx.shadowColor = POWERUPS.shield.color;
			ctx.beginPath(); ctx.moveTo(10, HEIGHT - 15); ctx.lineTo(WIDTH - 10, HEIGHT - 15); ctx.stroke(); ctx.shadowBlur = 0;
			ctx.fillStyle = `${POWERUPS.shield.color}12`; ctx.fillRect(10, HEIGHT - 14, WIDTH - 20, 14);
		}
		const paddleColor = run.fire > 0 ? POWERUPS.fire.color : run.magnet > 0 ? POWERUPS.magnet.color : run.wide > 0 ? POWERUPS.wide.color : SHIPS[run.ship].color;
		const paddleX = run.paddle.x - run.paddle.width / 2, paddleY = HEIGHT - 42;
		ctx.shadowBlur = !lively() ? 0 : 16; ctx.shadowColor = paddleColor; ctx.fillStyle = paddleColor;
		roundedRect(ctx, paddleX, paddleY, run.paddle.width, 12, 6); ctx.fill(); ctx.shadowBlur = 0;
		ctx.fillStyle = '#ffffff99'; roundedRect(ctx, paddleX + 9, paddleY + 2, run.paddle.width - 18, 3, 2); ctx.fill();
		ctx.fillStyle = '#06132799'; roundedRect(ctx, run.paddle.x - 17, paddleY + 6, 34, 3, 1); ctx.fill();
		if (run.laser > 0) {
			ctx.fillStyle = POWERUPS.laser.color;
			for (const x of [paddleX + 5, paddleX + run.paddle.width - 9]) { roundedRect(ctx, x, paddleY - 7, 4, 15, 2); ctx.fill(); }
		}
		for (const bolt of run.lasers) {
			ctx.shadowBlur = !lively() ? 0 : 10; ctx.shadowColor = POWERUPS.laser.color; ctx.fillStyle = POWERUPS.laser.color;
			roundedRect(ctx, bolt.x - (bolt.w || 4) / 2, bolt.y, bolt.w || 4, bolt.h || 16, 2); ctx.fill(); ctx.shadowBlur = 0;
		}
		for (const ball of run.balls) {
			const color = run.fire > 0 ? POWERUPS.fire.color : '#eaffff';
			if (lively() && ball.trail?.length && !ball.held) {
				ball.trail.forEach((point, i) => { ctx.globalAlpha = (i + 1) / ball.trail.length * 0.25; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, 2 + i / ball.trail.length * 4, 0, Math.PI * 2); ctx.fill(); });
				ctx.globalAlpha = 1;
			}
			ctx.shadowBlur = !lively() ? 0 : 14; ctx.shadowColor = color; ctx.fillStyle = color;
			ctx.beginPath(); ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
			ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ball.x - 2, ball.y - 2, 2.5, 0, Math.PI * 2); ctx.fill();
		}
		if (run.combo >= 2) {
			ctx.textAlign = 'center'; ctx.fillStyle = '#d5fbba'; ctx.font = '800 19px system-ui';
			ctx.fillText(`×${Math.min(8, run.combo)} CHAIN`, WIDTH / 2, HEIGHT - 76);
		}
		if (callout && lively()) {
			ctx.globalAlpha = Math.min(1, callout.life / 0.35); ctx.textAlign = 'center'; ctx.fillStyle = callout.color; ctx.font = '800 21px system-ui';
			ctx.fillText(callout.text, WIDTH / 2, HEIGHT - 132 - (1 - callout.life / callout.maxLife) * 18); ctx.globalAlpha = 1;
		}
		ctx.restore();
	};
	const pause = () => {
		if (['ready', 'playing'].includes(run.phase)) { music?.update({ playing: false, sector: run.sector, boss: false }); setPaused(true); left = right = false; setAnnouncement('Paused. Your sector, power timers, and score are frozen.'); }
	};
	const resume = () => { if (musicOn()) music?.resume(); setPaused(false); last = 0; setAnnouncement('Signal restored. Keep the rally alive.'); };
	const togglePause = () => {
		if (terminal() || drafting()) return;
		if (paused()) resume(); else pause();
		canvas?.focus({ preventScroll: true });
	};
	const activate = () => {
		if (terminal() || drafting()) return;
		if (musicOn()) music?.resume();
		if (paused()) resume();
		else if (run.phase === 'ready' || run.balls.some(b => b.held)) { launch(run); playSound('place'); setAnnouncement('Aim with the paddle edges. Catch falling power-ups.'); }
		else if (run.phase === 'playing') pause();
		publish(); canvas?.focus({ preventScroll: true });
	};
	const resetRun = (focus = true) => {
		saveRecord();
		run = createRun({ ship: selectedShip(), mode: selectedMode() }); savedRun = comboAwarded = collectionAwarded = depthAwarded = novaAwarded = bossAwarded = buildAwarded = false;
		setBest(readBest(run.mode));
		shake = previousCombo = 0; callout = null;
		setPaused(false); last = 0; left = right = false;
		setAnnouncement(`${SHIPS[selectedShip()].name} ready. Line up the paddle, then launch.`); publish(); draw(); if (focus) canvas?.focus({ preventScroll: true });
	};
	const restart = () => resetRun();
	const handleEvents = events => {
		if (events.includes('hit')) playSound('pop');
		if (events.includes('power')) { playSound('match'); setAnnouncement(run.lastPower && POWERUPS[run.lastPower] ? `${POWERUPS[run.lastPower].name} caught. ${POWERUPS[run.lastPower].description}` : 'Power-up caught.'); }
		if (events.includes('shield')) { playSound('match'); setAnnouncement('Safety Net absorbed the danger. Keep the rally alive.'); }
		if (events.includes('caught')) setAnnouncement('Magnetic Grip caught the ball. Move to aim, then press Space or Release ball.');
		if (events.includes('pulse')) { shake = 0.12; playSound('match'); setAnnouncement('Nova Pulse unleashed. Enemy shots erased; the signal is breaking open.'); }
		if (events.includes('boss-hit')) shake = Math.max(shake, 0.06);
		if (events.includes('boss-defeated')) { shake = 0.14; callout = { text: 'GUARDIAN OFFLINE', color: '#ffb7d0', life: 1.3, maxLife: 1.3 }; playSound('win'); setAnnouncement('Guardian defeated. Clear any remaining signals to move on.'); }
		if (events.includes('hazard')) { shake = 0.1; playSound('miss'); setAnnouncement('Hostile fire hit your ship. Watch the guardian’s targeting beam.'); }
		if (events.includes('bump')) playSound('pop');
		if (run.combo >= 8 && previousCombo < 8) callout = { text: 'CHAIN REACTION ×8', color: '#d5fbba', life: 1, maxLife: 1 };
		else if (run.combo >= 4 && previousCombo < 4) callout = { text: 'FLOW STATE ×4', color: '#b1fff0', life: 0.8, maxLife: 0.8 };
		previousCombo = run.combo;
		if (events.includes('lost') && !events.includes('hazard')) { playSound('miss'); setAnnouncement('One life down. Line up your next launch.'); }
		if (events.includes('sector')) { if (run.mode === 'campaign') unlock('ricochet-first-sector'); playSound('match'); setAnnouncement(`${MODES[run.mode].name}, stage ${run.stage}: ${LEVELS[run.sector - 1].name}. ${LEVELS[run.sector - 1].subtitle}`); }
		if (events.includes('won')) { if (run.mode === 'campaign') unlock('ricochet-clear'); playSound('win'); if (lively()) confetti(); }
		if (events.includes('over')) playSound('lose');
	};
	const firePulse = () => {
		if (run.phase !== 'playing' || paused()) return;
		const eventIndex = run.events.length;
		if (!pulse(run)) { setAnnouncement(`Nova charge ${Math.floor(run.energy)}%. Keep breaking signals to fill the reactor.`); return; }
		handleEvents(run.events.slice(eventIndex)); publish(); draw(); canvas?.focus({ preventScroll: true });
	};
	const pickUpgrade = id => {
		if (!chooseUpgrade(run, id)) return;
		playSound('match'); setAnnouncement(`${UPGRADES[id].name} installed for this run. Sector ${run.sector} ready.`);
		publish(); draw(); last = 0; queueMicrotask(() => sectorButton?.focus({ preventScroll: true }));
	};
	const selectShip = ship => {
		setSelectedShip(ship); save('ricochet-ship', ship);
		const fresh = run.phase === 'ready' && run.stage === 1 && run.time === 0 && run.score === 0;
		if (fresh) resetRun(false);
		setAnnouncement(`${SHIPS[ship].name} selected${fresh ? '. Ready for launch.' : ' for your next run.'}`);
	};
	const selectMode = mode => {
		setSelectedMode(mode); save('ricochet-mode', mode);
		const fresh = run.phase === 'ready' && run.stage === 1 && run.time === 0 && run.score === 0;
		if (fresh) resetRun(false);
		setAnnouncement(`${MODES[mode].name} selected${fresh ? '. Ready for launch.' : ' for your next run.'}`);
	};
	const toggleEffects = () => { const next = !effectsOn(); setEffectsOn(next); save('ricochet-effects', next); shake = 0; callout = null; draw(); };
	const toggleMusic = () => {
		const next = !musicOn();
		if (next && muted()) toggleMuted();
		if (!music || music.setEnabled(next) === false) { setAnnouncement('Synth music is unavailable in this browser.'); return; }
		setMusicOn(next);
	};
	const toggleFullscreen = async () => {
		try { if (document.fullscreenElement === consoleElement) await document.exitFullscreen(); else await consoleElement.requestFullscreen(); }
		catch { setAnnouncement('Fullscreen could not open. You can keep playing here.'); }
	};
	const pointer = event => {
		if (paused() || !['ready', 'playing'].includes(run.phase)) return;
		const rect = canvas.getBoundingClientRect(); if (!rect.width) return;
		aim(run, ((event.clientX - rect.left) / rect.width) * WIDTH);
	};
	onMount(() => {
		document.title = 'Neon Ricochet | Alfred Shaheen'; music = createNeonMusic(); ctx = canvas.getContext('2d');
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		media = window.matchMedia('(prefers-reduced-motion: reduce)'); reduced = media.matches; setMotionReduced(reduced);
		setCanFullscreen(!!document.fullscreenEnabled && typeof consoleElement?.requestFullscreen === 'function');
		const fullscreenChange = () => { setFullscreen(document.fullscreenElement === consoleElement); if (run.phase === 'playing') pause(); };
		document.addEventListener('fullscreenchange', fullscreenChange);
		const motion = () => { reduced = media.matches; setMotionReduced(reduced); draw(); }; media.addEventListener('change', motion);
		const hidden = () => { if (document.hidden && run.phase === 'playing') pause(); };
		document.addEventListener('visibilitychange', hidden);
		window.addEventListener('pagehide', saveRecord);
		const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible && run.phase === 'playing') pause(); }); observer.observe(canvas);
		const blur = () => { if (run.phase === 'playing') pause(); else left = right = false; }; window.addEventListener('blur', blur);
		const release = event => { if (['ArrowLeft', 'a', 'A'].includes(event.key)) left = false; if (['ArrowRight', 'd', 'D'].includes(event.key)) right = false; };
		window.addEventListener('keyup', release);
		const tick = time => {
			const dt = last ? (time - last) / 1000 : 0; last = time;
			if (!paused() && visible && !document.hidden) {
				shake = Math.max(0, shake - Math.min(dt, 0.05));
				if (callout) { callout.life -= Math.min(dt, 0.05); if (callout.life <= 0) callout = null; }
				const events = advanceRun(run, dt, Number(right) - Number(left));
				handleEvents(events); publish();
			}
			music?.update({ playing: run.phase === 'playing' && !paused() && visible && !document.hidden, sector: run.sector, boss: !!run.boss && run.boss.hp > 0 });
			draw(); frame = requestAnimationFrame(tick);
		}; frame = requestAnimationFrame(tick);
		onCleanup(() => {
			saveRecord(); music?.dispose(); document.removeEventListener('fullscreenchange', fullscreenChange);
			window.removeEventListener('pagehide', saveRecord);
			cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener('change', motion);
			document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); window.removeEventListener('keyup', release);
		});
	});
	const keys = event => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(event.key)) {
			event.preventDefault(); if (paused() || drafting() || terminal()) return;
			if (['ArrowLeft', 'a', 'A'].includes(event.key)) left = true; else right = true;
		} else if (event.code === 'Space' || event.key === ' ') { event.preventDefault(); if (!event.repeat) activate(); }
		else if (event.key.toLowerCase() === 'p') { event.preventDefault(); if (!event.repeat) togglePause(); }
		else if (event.key.toLowerCase() === 'e') { event.preventDefault(); if (!event.repeat) firePulse(); }
	};
	const control = (event, side) => {
		if (paused() || !['ready', 'playing'].includes(run.phase)) return;
		event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
		if (side === 'left') left = true; else right = true;
	};
	return <section class="page ricochet" style={{ '--nr-accent': level().color, '--nr-ship': SHIPS[hud().ship].color }}>
		<header class="nr-heading">
			<div class="nr-topline"><A href="/games" class="back-link">← Arcade</A><span class="nr-edition">FLIGHT DECK // NR–06</span></div>
			<div class="nr-title-row"><div><p class="nr-kicker">BREAK THE SIGNAL. OWN THE VOID.</p><h1 class="page-title">Neon <span>Ricochet<span class="nr-title-dot">.</span></span></h1><p class="nr-tagline">Three ships. Twelve sectors. A crown worth chasing.</p></div><span class="nr-status" classList={{ 'is-active': hud().phase === 'playing' && !paused() }}><i aria-hidden="true" />{status()}</span></div>
		</header>
		<div class="nr-play-layout">
			<div ref={consoleElement} class="nr-console" classList={{ 'nr-immersive': fullscreen() }}>
				<dl class="nr-hud">
					<div class="nr-score"><dt>Score</dt><dd>{formatScore(hud().score)}</dd></div>
					<div><dt>Chain</dt><dd classList={{ 'nr-hot': hud().combo >= 2 }}>×{Math.min(8, Math.max(1, hud().combo))}<small>best ×{Math.min(8, Math.max(1, hud().maxCombo))}</small></dd></div>
					<div><dt>Lives</dt><dd>{hud().lives}<span class="nr-lives" aria-hidden="true"> <For each={Array.from({ length: hud().lives })}>{() => <i />}</For></span></dd></div>
					<div><dt>{hud().mode === 'bossrush' ? 'Rush best' : 'Personal best'}</dt><dd>{formatScore(best().score)}</dd></div>
				</dl>
				<div class="nr-stage"><div><span class="nr-sector-number">{String(hud().sector).padStart(2, '0')}</span><div><strong>{level().name}</strong><span>{MODES[hud().mode].name} · stage {hud().stage}/{hud().stageTotal} · {SHIPS[hud().ship].name}</span></div></div><span class="nr-brick-count">{hud().totalBricks - hud().bricks}<span> / {hud().totalBricks} cleared</span></span></div>
				<div class="nr-progress" style={{ 'grid-template-columns': `repeat(${hud().stageTotal}, 1fr)` }} role="img" aria-label={`${MODES[hud().mode].name}: ${hud().phase === 'won' ? hud().stageTotal : hud().stage - 1} of ${hud().stageTotal} stages cleared; ${level().name} ${hud().phase === 'won' ? 'complete' : 'current'}.`}><For each={route()}>{(_, i) => <span classList={{ 'is-cleared': i() + 1 < hud().stage || hud().phase === 'won', 'is-current': i() + 1 === hud().stage && hud().phase !== 'won' }} />}</For></div>
				<Show when={hud().bossHp > 0}>
					<div class="nr-boss-strip" classList={{ 'is-charging': hud().bossCharging }}><span><b>GUARDIAN</b> {hud().bossName}</span><div class="nr-boss-health" role="progressbar" aria-label={`${hud().bossName} remaining health`} aria-valuenow={hud().bossHp} aria-valuemin="0" aria-valuemax={hud().bossMax}><i style={{ width: `${hud().bossHp / hud().bossMax * 100}%` }} /></div><strong>{hud().bossCharging ? 'VOLLEY INCOMING' : `${hud().bossHp}/${hud().bossMax} HP`}</strong></div>
				</Show>
				<div class="nr-arena" classList={{ 'is-drafting': drafting() }}>
					<canvas ref={canvas} tabIndex={drafting() ? -1 : 0} aria-disabled={drafting()} aria-label={`Neon Ricochet game arena. ${MODES[hud().mode].name}, stage ${hud().stage}, ${hud().bricks} bricks left, ${hud().lives} lives. Nova charge ${hud().energy} percent. Focus here to play with the keyboard.`} aria-describedby="nr-controls" onKeyDown={keys} onBlur={() => { left = right = false; }} onPointerCancel={() => { left = right = false; }} onLostPointerCapture={() => { left = right = false; }} onPointerMove={pointer} onPointerDown={event => { if (drafting()) return; if (event.pointerType === 'touch') event.currentTarget.setPointerCapture(event.pointerId); pointer(event); canvas.focus({ preventScroll: true }); }}>Neon Ricochet requires a browser with canvas support. Use the arrow keys or A and D to steer, Space to launch, P to pause, and E for a charged Nova Pulse.</canvas>
					<Show when={paused() || ['ready', 'over', 'won'].includes(hud().phase)}>
						<div class="nr-overlay"><div class="nr-overlay-card">
							<p class="nr-kicker">{paused() ? 'TRANSMISSION ON HOLD' : hud().phase === 'won' ? 'TRANSMISSION RESTORED' : hud().phase === 'over' ? 'SIGNAL LOST' : `${MODES[hud().mode].name.toUpperCase()} · STAGE ${String(hud().stage).padStart(2, '0')} / ${hud().stageTotal}`}</p>
							<h2>{paused() ? 'Take a breath.' : hud().phase === 'won' ? 'The crown is yours.' : hud().phase === 'over' ? 'Chase a new high.' : level().name}</h2>
							<p>{paused() ? 'Your power timers, score, and sector will wait.' : terminal() ? `${formatScore(hud().score)} points · ${hud().bossesDefeated} guardians · ${perkCount()} upgrades` : hud().bossHp > 0 ? `${hud().bossName} guards this frequency. Clear the bricks and the guardian.` : level().subtitle}</p>
							<button ref={sectorButton} class="btn nr-primary" onClick={() => terminal() ? restart() : activate()}>{paused() ? 'Resume transmission' : terminal() ? `New ${MODES[selectedMode()].name.toLowerCase()} run` : 'Launch ball'} <span aria-hidden="true">↗</span></button>
							<Show when={!terminal()}><span class="nr-overlay-hint">{paused() ? 'P or Space to resume' : `${SHIPS[hud().ship].name} ready · Space to launch`}</span></Show>
						</div></div>
					</Show>
					<Show when={drafting()}>
						<div class="nr-overlay nr-draft-overlay"><div class="nr-draft-panel" role="region" aria-label="Choose a permanent upgrade">
							<div class="nr-draft-heading"><p class="nr-kicker">UPGRADE UPLINK // STAGE {hud().stage}</p><h2>Build something dangerous.</h2><p>Choose one. It stays with your ship for this run.</p></div>
							<div class="nr-draft-cards"><For each={hud().offers}>{(id, i) => <button type="button" ref={el => { if (i() === 0) draftButton = el; }} class="nr-draft-choice" style={{ '--perk-color': UPGRADES[id].color }} onClick={() => pickUpgrade(id)}><b class="nr-draft-glyph" aria-hidden="true">{UPGRADES[id].glyph}</b><span class="nr-draft-copy"><small>LEVEL {(hud().upgrades[id] || 0) + 1} / {UPGRADES[id].maxStacks}</small><strong>{UPGRADES[id].name}</strong><span>{UPGRADES[id].description}</span></span><b class="nr-draft-arrow" aria-hidden="true">↗</b></button>}</For></div>
						</div></div>
					</Show>
				</div>
				<div class="nr-reactor-row">
					<div class="nr-reactor"><span>REACTOR <strong>{hud().energy}%</strong></span><div class="nr-energy-meter" role="progressbar" aria-label="Nova Pulse charge" aria-valuenow={hud().energy} aria-valuemin="0" aria-valuemax="100"><i style={{ width: `${hud().energy}%` }} /></div><small>{hud().energy >= 100 ? 'Nova ready — unleash it' : 'Break signals to charge your nova'}</small></div>
					<button type="button" class="btn nr-nova" classList={{ 'is-ready': pulseReady() }} disabled={!pulseReady()} onClick={firePulse}><span aria-hidden="true">✺</span><span>Nova Pulse<small>{hud().energy >= 100 ? 'UNLEASH' : 'CHARGING'}</small></span><kbd>E</kbd></button>
				</div>
				<div class="nr-loadout" aria-label="Active power-ups"><span class="nr-loadout-label">CAPSULES</span><Show when={activePowers().length || hud().shield || hud().balls > 1} fallback={<span class="nr-loadout-empty">Catch glowing capsules to power up.</span>}><For each={activePowers()}>{kind => <span class="nr-power-chip" style={{ '--power-color': POWERUPS[kind].color }}><b aria-hidden="true">{POWERUPS[kind].glyph}</b>{POWERUPS[kind].name}<strong>{hud()[kind]}s</strong></span>}</For><Show when={hud().shield > 0}><span class="nr-power-chip" style={{ '--power-color': POWERUPS.shield.color }}><b aria-hidden="true">{POWERUPS.shield.glyph}</b>Shield<strong>{hud().shield} save{hud().shield > 1 ? 's' : ''}</strong></span></Show><Show when={hud().balls > 1}><span class="nr-power-chip" style={{ '--power-color': POWERUPS.multiball.color }}><b aria-hidden="true">{POWERUPS.multiball.glyph}</b>Multiball<strong>{hud().balls} balls</strong></span></Show></Show></div>
				<Show when={activePerks().length}><div class="nr-perk-tray" aria-label="Permanent upgrades for this run"><span class="nr-loadout-label">BUILD</span><For each={activePerks()}>{([id, count]) => <span title={UPGRADES[id].description} class="nr-perk-chip" style={{ '--perk-color': UPGRADES[id].color }}><b aria-hidden="true">{UPGRADES[id].glyph}</b>{UPGRADES[id].name}<strong>×{count}</strong></span>}</For></div></Show>
				<div class="nr-toolbar"><div class="nr-actions"><button class="btn nr-control" onClick={activate} disabled={terminal() || drafting()}>{paused() ? 'Resume' : hud().phase === 'ready' ? 'Launch' : hud().held ? 'Release ball' : drafting() ? 'Choose perk' : 'Pause'}<kbd>{hud().held || hud().phase === 'ready' ? 'Space' : 'P'}</kbd></button><Show when={hud().phase === 'playing' && hud().held && !paused()}><button class="btn nr-control" onClick={togglePause}>Pause<kbd>P</kbd></button></Show><button class="btn nr-control" onClick={restart}>New run<span aria-hidden="true">↻</span></button></div><div class="nr-audio-actions"><button type="button" class="btn nr-control nr-music" aria-label="Synth soundtrack" aria-pressed={musicOn()} classList={{ 'is-enabled': musicOn() }} title={musicOn() ? 'Synth soundtrack on; follows sound mute' : 'Turn on the synth soundtrack'} onClick={toggleMusic}><span aria-hidden="true">♫</span><span>Music</span></button><SoundToggle /><Show when={canFullscreen()}><button type="button" class="btn nr-control nr-fullscreen" aria-label={fullscreen() ? 'Exit fullscreen' : 'Enter fullscreen'} title={fullscreen() ? 'Exit fullscreen' : 'Fullscreen flight deck'} onClick={toggleFullscreen}><span aria-hidden="true">{fullscreen() ? '⊡' : '⛶'}</span></button></Show></div></div>
				<div class="nr-touch" role="group" aria-label="Touch paddle controls"><button class="btn nr-control" aria-label="Move paddle left" onPointerDown={e => control(e, 'left')} onPointerUp={() => left = false} onPointerCancel={() => left = false} onLostPointerCapture={() => left = false} onClick={e => { if (e.detail === 0 && !paused() && !drafting()) aim(run, run.paddle.target - 70); }}>←</button><span>Drag to steer <span>· catch, rebound, repeat</span></span><button class="btn nr-control" aria-label="Move paddle right" onPointerDown={e => control(e, 'right')} onPointerUp={() => right = false} onPointerCancel={() => right = false} onLostPointerCapture={() => right = false} onClick={e => { if (e.detail === 0 && !paused() && !drafting()) aim(run, run.paddle.target + 70); }}>→</button></div>
				<p class="nr-announcement" role="status" aria-live="polite">{announcement()}</p>
			</div>
			<aside class="nr-mission-rail" aria-label="Flight computer">
				<div class="nr-flight-card" style={{ '--nr-ship': SHIPS[hud().ship].color }}><div class="nr-rail-heading"><span>FLIGHT COMPUTER</span><i aria-hidden="true" /></div><PilotArt ship={hud().ship} /><div class="nr-flight-title"><strong>{SHIPS[hud().ship].name}</strong><span>{MODES[hud().mode].name}</span></div><p>{SHIPS[hud().ship].description}</p><dl class="nr-run-stats"><div><dt>Guardians</dt><dd>{hud().bossesDefeated}/3</dd></div><div><dt>Upgrades</dt><dd>{perkCount()}</dd></div><div><dt>Novas</dt><dd>{hud().pulses}</dd></div></dl></div>
				<div class="nr-route-card"><div class="nr-rail-heading"><span>TRANSMISSION ROUTE</span><strong>{hud().stage}/{hud().stageTotal}</strong></div><ol><For each={route()}>{(sector, i) => <li classList={{ 'is-current': i() + 1 === hud().stage && hud().phase !== 'won', 'is-cleared': i() + 1 < hud().stage || hud().phase === 'won', 'is-guardian': sector % 4 === 0 }}><span>{String(sector).padStart(2, '0')}</span><strong>{LEVELS[sector - 1].name}</strong><b aria-hidden="true">{i() + 1 < hud().stage || hud().phase === 'won' ? '✓' : sector % 4 === 0 ? '◇' : '·'}</b></li>}</For></ol><p><span aria-hidden="true">◇</span> Guardian frequencies: 04 / 08 / 12</p></div>
				<div class="nr-flight-tip"><span aria-hidden="true">✺</span><p>Charge your nova on brick hits. Save it for an enemy volley or a wall of armor.</p></div>
			</aside>
		</div>
		<section class="nr-hangar" aria-labelledby="nr-hangar-title">
			<div class="nr-hangar-header"><div><p class="nr-kicker">HANGAR // YOUR NEXT TRANSMISSION</p><h2 id="nr-hangar-title">Choose your flight.</h2></div><span>{run.time === 0 && hud().score === 0 && hud().phase === 'ready' ? 'Configure your launch below' : 'Changes apply to your next run'}</span></div>
			<div class="nr-mode-picker" role="group" aria-label="Game mode"><For each={Object.entries(MODES)}>{([id, mode]) => <button type="button" class="nr-mode-option" classList={{ 'is-selected': selectedMode() === id }} aria-pressed={selectedMode() === id} onClick={() => selectMode(id)}><span aria-hidden="true">{id === 'campaign' ? '⌁' : '◇'}</span><span><strong>{mode.name}<small>{mode.route.length} stages</small></strong><span>{mode.description}</span></span><b aria-hidden="true">{selectedMode() === id ? '✓' : '+'}</b></button>}</For></div>
			<div class="nr-ship-picker" role="group" aria-label="Ship for the next run"><For each={Object.entries(SHIPS)}>{([id, ship]) => <button type="button" class="nr-ship-option" style={{ '--ship-color': ship.color }} classList={{ 'is-selected': selectedShip() === id }} aria-pressed={selectedShip() === id} onClick={() => selectShip(id)}><div class="nr-ship-top"><span>FLIGHT CLASS // {id === 'courier' ? 'BALANCED' : id === 'bulwark' ? 'DEFENSIVE' : 'HIGH VOLTAGE'}</span><b aria-hidden="true">{selectedShip() === id ? '✓' : '+'}</b></div><PilotArt ship={id} /><div class="nr-ship-description"><h3>{ship.name}</h3><p>{ship.description}</p></div><div class="nr-ship-stats"><span><b>{ship.lives}</b> starting lives</span><span><b>{ship.width}</b> paddle width</span><span><b>{Math.round(ship.chargeRate * 100)}%</b> charge rate</span></div></button>}</For></div>
			<div class="nr-hangar-footer"><p>Capsules give temporary powers. Draft upgrades shape your entire run.</p><button type="button" class="btn nr-control" aria-pressed={effectsOn() && !motionReduced()} disabled={motionReduced()} title={motionReduced() ? 'Your system reduced motion setting turns visual effects off' : 'Toggle star drift, trails, particles, and subtle camera shake'} onClick={toggleEffects}><span aria-hidden="true">✦</span>Effects {effectsOn() && !motionReduced() ? 'on' : 'off'}</button></div>
		</section>
		<div class="nr-reference">
			<details class="nr-guide nr-codex"><summary><span>Capsule field guide<small>Eight temporary powers · stack your advantages</small></span><b aria-hidden="true">+</b></summary><div class="nr-codex-grid"><For each={Object.entries(POWERUPS)}>{([kind, power]) => <article class="nr-codex-card" style={{ '--power-color': power.color }}><b class="nr-power-glyph" aria-hidden="true">{power.glyph}</b><div><h3>{power.name}<Show when={power.duration}><span>{power.duration}s base</span></Show></h3><p>{power.description}</p></div></article>}</For></div></details>
			<details class="nr-guide nr-perks"><summary><span>Permanent upgrade archive<small>Draft one of three · your choices define the run</small></span><b aria-hidden="true">+</b></summary><div class="nr-codex-grid"><For each={Object.entries(UPGRADES)}>{([id, perk]) => <article class="nr-codex-card" style={{ '--power-color': perk.color }}><b class="nr-power-glyph" aria-hidden="true">{perk.glyph}</b><div><h3>{perk.name}<span>max ×{perk.maxStacks}</span></h3><p>{perk.description}</p></div></article>}</For></div></details>
			<details class="nr-guide nr-map"><summary><span>The transmission route<small>{MODES[hud().mode].name} · {hud().stageTotal} stages · three guardians</small></span><b aria-hidden="true">+</b></summary><ol class="nr-sector-map"><For each={route()}>{(sector, i) => <li classList={{ 'is-cleared': i() + 1 < hud().stage || hud().phase === 'won', 'is-current': i() + 1 === hud().stage && hud().phase !== 'won' }} style={{ '--stage-color': LEVELS[sector - 1].color }}><span class="nr-map-number">{String(sector).padStart(2, '0')}</span><div><strong>{LEVELS[sector - 1].name}<Show when={sector % 4 === 0}><em>GUARDIAN</em></Show></strong><p>{LEVELS[sector - 1].subtitle}</p></div><span class="nr-map-status">{i() + 1 < hud().stage || hud().phase === 'won' ? '✓' : i() + 1 === hud().stage ? 'NOW' : '·'}</span></li>}</For></ol></details>
			<details class="nr-guide nr-how"><summary><span>Flight manual &amp; scoring<small>A little technique goes a long way</small></span><b aria-hidden="true">+</b></summary><div class="nr-guide-content"><p id="nr-controls">Move your pointer or drag in the arena to steer. For keyboard play, focus the arena and use <kbd>←</kbd> <kbd>→</kbd> or <kbd>A</kbd> <kbd>D</kbd>. <kbd>Space</kbd> launches, releases a magnet-held ball, or pauses a rally; <kbd>P</kbd> pauses or resumes. Press <kbd>E</kbd> or the Nova Pulse button when the reactor reaches 100%. Buttons provide the same controls on touch screens.</p><p>The paddle edges create sharper rebounds. Consecutive brick hits before returning to the paddle build a chain multiplier up to ×8. Armor marks show remaining hits; orange star bricks explode into their neighbors. Moving bumpers deflect the ball. Catch a power capsule after every five destroyed bricks.</p><p>Guardians hold sectors 04, 08, and 12. Their targeting beam warns of a coming volley: move out of its path, catch a Safety Net, or fire your nova to erase hostile shots. Your nova also damages every surviving brick and the guardian. Clear both the brick pattern and the guardian to continue.</p><p>Campaign offers a permanent upgrade after every second sector through sector 10. Boss Rush takes you straight to the three guardians and offers an upgrade between encounters. Pick one of three cards; the arena stays frozen during the draft. Upgrades stack up to their listed maximum and reset on a new run.</p><p>Every third campaign sector cleared restores one life; Boss Rush restores a life between encounters. Lives cap at five. Keep at least one ball alive to avoid losing a life. Choose your ship and mode in the hangar; changes made during a run apply to the next run. Each mode saves its own best score in this browser.</p><p>Leaving the tab, window, or arena pauses a live run. Personal bests are saved on completion, restart, and leaving the game. Synth music starts only when enabled and follows your sound mute setting. Fullscreen opens the flight deck; Escape exits. Reduced motion or Effects off removes camera shake, star drift, trails, particles, and celebration effects.</p></div></details>
		</div>
	</section>;
}
