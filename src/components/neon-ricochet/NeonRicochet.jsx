import { A } from '@solidjs/router';
import { createSignal, onCleanup, onMount, Show } from 'solid-js';
import { unlock } from '../../state/achievements';
import { confetti } from '../../utils/confetti';
import { playSound } from '../../utils/sound';
import { load, save } from '../../utils/storage';
import SoundToggle from '../ui/SoundToggle';
import { advanceRun, aim, createRun, HEIGHT, launch, SECTORS, WIDTH } from './engine';
import './ricochet.css';

const snapshot = run => ({ phase: run.phase, sector: run.sector, score: run.score, lives: run.lives, combo: run.combo, maxCombo: run.maxCombo, bricks: run.bricks.filter(b => b.hp).length, wide: Math.ceil(run.wide), slow: Math.ceil(run.slow), shield: run.shield });
export default function NeonRicochet() {
	let run = createRun(), canvas, ctx, frame, last = 0, media, sectorButton;
	let left = false, right = false, visible = true, reduced = false;
	const [hud, setHud] = createSignal(snapshot(run));
	const [paused, setPaused] = createSignal(false);
	const rawBest = load('ricochet-best', {});
	const [best, setBest] = createSignal(rawBest && typeof rawBest === 'object' && Number.isFinite(rawBest.score) ? rawBest : { score: 0, sector: 0, combo: 0 });
	const [announcement, setAnnouncement] = createSignal('Five sectors. Three lives. Make every bounce count.');
	let savedRun = false, comboAwarded = false, hudKey = '';
	const publish = () => {
		if (run.maxCombo >= 8 && !comboAwarded) { comboAwarded = true; unlock('ricochet-combo'); }
		const next = snapshot(run), key = JSON.stringify(next);
		if (key !== hudKey) { hudKey = key; setHud(next); }
		if (!savedRun && ['won', 'over'].includes(run.phase)) {
			savedRun = true;
			const record = { score: Math.max(best().score || 0, run.score), sector: Math.max(best().sector || 0, run.sector), combo: Math.max(best().combo || 0, run.maxCombo) };
			setBest(record); save('ricochet-best', record);
			setAnnouncement(run.phase === 'won' ? 'All five sectors cleared. You’re a ricochet legend.' : `Run complete. ${run.score} points, sector ${run.sector}.`);
			queueMicrotask(() => sectorButton?.focus());
		}
	};
	const draw = () => {
		if (!ctx) return;
		ctx.clearRect(0, 0, WIDTH, HEIGHT);
		ctx.fillStyle = '#0b1222'; ctx.fillRect(0, 0, WIDTH, HEIGHT);
		for (let i = 0; i < 65; i++) {
			ctx.fillStyle = i % 4 ? '#22324c' : '#5c7093';
			ctx.fillRect((i * 127 + 19) % WIDTH, (i * 71 + 27) % HEIGHT, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
		}
		ctx.strokeStyle = '#1e2d46'; ctx.lineWidth = 1;
		for (let x = 0; x < WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke(); }
		for (let y = 0; y < HEIGHT; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke(); }
		ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#7d91b3'; ctx.textAlign = 'left';
		ctx.fillText(`SECTOR ${String(run.sector).padStart(2, '0')} / ${SECTORS}`, 38, 35);
		ctx.textAlign = 'right'; ctx.fillText(`${run.bricks.filter(b => b.hp).length} SIGNALS LEFT`, WIDTH - 38, 35);
		for (const b of run.bricks) {
			if (!b.hp) continue;
			ctx.shadowBlur = reduced ? 0 : 12; ctx.shadowColor = b.color;
			ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
			ctx.shadowBlur = 0; ctx.fillStyle = '#ffffff44'; ctx.fillRect(b.x + 3, b.y + 3, b.w - 6, 2);
			if (b.hp > 1) { ctx.strokeStyle = '#0b1222'; ctx.lineWidth = 3; ctx.strokeRect(b.x + 7, b.y + 7, b.w - 14, b.h - 14); }
		}
		if (!reduced) for (const p of run.particles) {
			ctx.globalAlpha = Math.max(0, p.life / 0.45); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3);
		}
		ctx.globalAlpha = 1;
		for (const d of run.drops) {
			ctx.fillStyle = d.kind === 'wide' ? '#c0f58b' : d.kind === 'slow' ? '#b994ff' : '#6de0ec';
			ctx.beginPath(); ctx.arc(d.x, d.y, 13, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#0b1222'; ctx.textAlign = 'center'; ctx.font = 'bold 13px system-ui';
			ctx.fillText(d.kind === 'wide' ? '↔' : d.kind === 'slow' ? 'S' : '◆', d.x, d.y + 4);
		}
		if (run.shield) { ctx.fillStyle = '#6de0ec'; ctx.fillRect(8, HEIGHT - 12, WIDTH - 16, 3); }
		ctx.fillStyle = run.wide ? '#c0f58b' : '#6de0ec'; ctx.shadowBlur = reduced ? 0 : 18; ctx.shadowColor = ctx.fillStyle;
		ctx.fillRect(run.paddle.x - run.paddle.width / 2, HEIGHT - 42, run.paddle.width, 12);
		ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(run.ball.x, run.ball.y, 8, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
		if (run.combo >= 2) {
			ctx.textAlign = 'center'; ctx.fillStyle = '#c0f58b'; ctx.font = 'bold 24px system-ui';
			ctx.fillText(`COMBO ×${Math.min(8, run.combo)}`, WIDTH / 2, 260);
		}
	};
	const pause = () => {
		if (['ready', 'playing'].includes(run.phase)) { setPaused(true); left = right = false; setAnnouncement('Paused. Your sector will wait.'); }
	};
	const activate = () => {
		if (paused()) { setPaused(false); last = 0; setAnnouncement('Back in the game.'); }
		else if (run.phase === 'ready') { launch(run); playSound('place'); setAnnouncement('Catch power-ups. Aim with the edge of your paddle.'); }
		else if (run.phase === 'playing') pause();
		publish(); canvas?.focus({ preventScroll: true });
	};
	const restart = () => {
		run = createRun(); savedRun = false; comboAwarded = false; setPaused(false); last = 0; left = right = false;
		setAnnouncement('Fresh run. Move the paddle, then launch.'); publish(); draw(); canvas?.focus({ preventScroll: true });
	};
	const pointer = event => {
		if (paused() || !['ready', 'playing'].includes(run.phase)) return;
		const rect = canvas.getBoundingClientRect(); aim(run, ((event.clientX - rect.left) / rect.width) * WIDTH);
	};
	onMount(() => {
		document.title = 'Neon Ricochet | Alfred Shaheen';
		ctx = canvas.getContext('2d');
		const dpr = Math.min(2, window.devicePixelRatio || 1); canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
		media = window.matchMedia('(prefers-reduced-motion: reduce)'); reduced = media.matches;
		const motion = () => { reduced = media.matches; draw(); }; media.addEventListener('change', motion);
		const hidden = () => { if (document.hidden) pause(); }; document.addEventListener('visibilitychange', hidden);
		const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (!visible && run.phase === 'playing') pause(); }); observer.observe(canvas);
		const blur = () => pause(); window.addEventListener('blur', blur);
		const release = event => { if (['ArrowLeft', 'a', 'A'].includes(event.key)) left = false; if (['ArrowRight', 'd', 'D'].includes(event.key)) right = false; };
		window.addEventListener('keyup', release);
		const tick = time => {
			const dt = last ? (time - last) / 1000 : 0; last = time;
			if (!paused() && visible && !document.hidden) {
				const events = advanceRun(run, dt, Number(right) - Number(left));
				if (events.includes('hit')) playSound('pop');
				if (events.includes('power')) { playSound('match'); setAnnouncement('Power-up caught.'); }
				if (events.includes('lost')) { playSound('miss'); setAnnouncement('One life down. Line up your next launch.'); }
				if (events.includes('sector')) { unlock('ricochet-first-sector'); playSound('match'); setAnnouncement(`Sector ${run.sector} unlocked. Bonus life earned.`); }
				if (events.includes('won')) { unlock('ricochet-clear'); playSound('win'); confetti(); }
				if (events.includes('over')) playSound('lose');
				publish();
			}
			draw(); frame = requestAnimationFrame(tick);
		}; frame = requestAnimationFrame(tick);
		onCleanup(() => { cancelAnimationFrame(frame); observer.disconnect(); media.removeEventListener('change', motion); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('blur', blur); window.removeEventListener('keyup', release); });
	});
	const keys = event => {
		if (event.ctrlKey || event.metaKey || event.altKey) return;
		if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(event.key)) {
			event.preventDefault(); if (paused()) return;
			if (['ArrowLeft', 'a', 'A'].includes(event.key)) left = true; else right = true;
		} else if ((event.code === 'Space' || event.key.toLowerCase() === 'p') && !event.repeat) { event.preventDefault(); activate(); }
	};
	const control = (event, side) => { if (paused() || !['ready', 'playing'].includes(run.phase)) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); if (side === 'left') left = true; else right = true; };
	return <section class="page ricochet">
		<header class="nr-heading"><A href="/games" class="back-link">← All games</A><p class="nr-kicker">THE NEON ARCADE / 06</p><h1 class="page-title">Neon <span>Ricochet</span></h1><p>Break the signal. Ride the rebound.</p></header>
		<dl class="nr-hud"><div><dt>Score</dt><dd>{hud().score.toLocaleString()}</dd></div><div><dt>Sector</dt><dd>{hud().sector}/{SECTORS}</dd></div><div><dt>Lives</dt><dd>{hud().lives} <span aria-hidden="true">◆</span></dd></div><div><dt>Best</dt><dd>{(best().score || 0).toLocaleString()}</dd></div></dl>
		<div class="nr-arena">
			<canvas ref={canvas} tabIndex="0" role="img" aria-label={`Neon Ricochet arena. Sector ${hud().sector}, ${hud().bricks} bricks left, ${hud().lives} lives.`} aria-describedby="nr-controls" onKeyDown={keys} onPointerMove={pointer} onPointerDown={event => { if (event.pointerType === 'touch') event.currentTarget.setPointerCapture(event.pointerId); pointer(event); canvas.focus({ preventScroll: true }); }} />
			<Show when={paused() || ['ready', 'over', 'won'].includes(hud().phase)}>
				<div class="nr-overlay"><div class="nr-overlay-card">
					<p class="nr-kicker">{paused() ? 'BREATHING ROOM' : hud().phase === 'won' ? 'TRANSMISSION RESTORED' : hud().phase === 'over' ? 'SIGNAL LOST' : `SECTOR ${String(hud().sector).padStart(2, '0')}`}</p>
					<h2>{paused() ? 'Take a beat.' : hud().phase === 'won' ? 'You cleared the cosmos.' : hud().phase === 'over' ? 'One more run?' : hud().sector === 1 ? 'Find your rhythm.' : 'A fresh frequency.'}</h2>
					<p>{paused() ? 'Your score and power-ups are frozen.' : ['over', 'won'].includes(hud().phase) ? `${hud().score.toLocaleString()} points · best combo ×${hud().maxCombo}` : 'Catch the ball. Catch the power-ups. Clear the sector.'}</p>
					<button ref={sectorButton} class="btn" onClick={() => ['over', 'won'].includes(run.phase) ? restart() : activate()}>{paused() ? 'Resume' : ['over', 'won'].includes(hud().phase) ? 'New run' : 'Launch ball'}</button>
				</div></div>
			</Show>
		</div>
		<div class="nr-actions"><button class="btn btn-ghost" onClick={activate} disabled={['won', 'over'].includes(hud().phase)}>{paused() ? 'Resume' : hud().phase === 'ready' ? 'Launch' : 'Pause'}</button><button class="btn btn-ghost" onClick={restart}>Restart</button><SoundToggle /></div>
		<div class="nr-touch" role="group" aria-label="Touch paddle controls"><button class="btn btn-ghost" aria-label="Move paddle left" onPointerDown={e => control(e, 'left')} onPointerUp={() => left = false} onPointerCancel={() => left = false} onLostPointerCapture={() => left = false} onClick={e => { if (e.detail === 0) aim(run, run.paddle.target - 70); }}>←</button><span>Drag the arena to steer</span><button class="btn btn-ghost" aria-label="Move paddle right" onPointerDown={e => control(e, 'right')} onPointerUp={() => right = false} onPointerCancel={() => right = false} onLostPointerCapture={() => right = false} onClick={e => { if (e.detail === 0) aim(run, run.paddle.target + 70); }}>→</button></div>
		<p class="nr-announcement" role="status">{announcement()}</p>
		<div class="nr-powerups"><span><b>↔</b> Wide paddle · 12s</span><span><b>S</b> Slow ball · 9s</span><span><b>◆</b> Safety shield · one save</span><Show when={hud().wide || hud().slow || hud().shield}><strong>{hud().wide ? `Wide ${hud().wide}s ` : ''}{hud().slow ? `Slow ${hud().slow}s ` : ''}{hud().shield ? 'Shield ready' : ''}</strong></Show></div>
		<details class="nr-guide"><summary>How to find your flow</summary><p id="nr-controls">Move the paddle with your pointer, drag on touch screens, or focus the arena and use ←/→ or A/D. Space launches or pauses; P does the same. Use the outer edges of the paddle to aim sharper rebounds.</p><p>Consecutive brick hits before returning to the paddle build your multiplier, up to ×8. Armored bricks take two hits. Every sixth destroyed brick drops a power-up. Clearing a sector earns bonus points and a life, up to five lives. Clear all five sectors to win.</p><p>Leaving the tab or scrolling away pauses a live run. Best scores stay in this browser. Reduced motion removes glow particles; sound follows your existing mute setting.</p></details>
	</section>;
}
