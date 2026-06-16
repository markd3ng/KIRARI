<script lang="ts">
import QRCode from "qrcode";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

let {
	title,
	author,
	description = "",
	pubDate = "",
	url,
	siteTitle,
	avatar = "",
}: {
	title: string;
	author: string;
	description?: string;
	pubDate?: string;
	url: string;
	siteTitle: string;
	avatar?: string;
} = $props();

let showModal = $state(false);
let posterImage = $state<string | null>(null);
let generating = $state(false);
let copied = $state(false);

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

function getLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const chars = text.split("");
	const lines: string[] = [];
	let currentLine = "";
	for (let i = 0; i < chars.length; i++) {
		if (ctx.measureText(currentLine + chars[i]).width < maxWidth) {
			currentLine += chars[i];
		} else {
			lines.push(currentLine);
			currentLine = chars[i];
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines;
}

async function generatePoster() {
	showModal = true;
	if (posterImage) return;
	generating = true;
	try {
		const scale = 2;
		const width = 425 * scale;
		const padding = 24 * scale;
		const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 100 * scale });
		const [qrImg, coverImg, avatarImg] = await Promise.all([
			loadImage(qrDataUrl),
			loadImage("/og/default.png"),
			avatar ? loadImage(avatar) : Promise.resolve(null),
		]);

		const canvas = document.createElement("canvas");
		const ctx = ctx2d(canvas);
		if (!ctx) { generating = false; return; }

		const contentWidth = width - padding * 2;
		const coverHeight = 200 * scale;
		const footerHeight = 64 * scale;
		const titleFont = `700 ${24 * scale}px system-ui, sans-serif`;
		const descFont = `${14 * scale}px system-ui, sans-serif`;

		ctx.font = titleFont;
		const titleLines = getLines(ctx, title, contentWidth);
		const titleHeight = titleLines.length * 30 * scale;

		ctx.font = descFont;
		const descLines = description ? getLines(ctx, description, contentWidth - 16 * scale).slice(0, 4) : [];
		const descHeight = descLines.length * 25 * scale;

		canvas.height = coverHeight + padding + titleHeight + 16 * scale + descHeight + 48 * scale + footerHeight + padding;

		// Background
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Cover
		if (coverImg) {
			const r = coverImg.width / coverImg.height;
			const tr = width / coverHeight;
			let sx = 0, sy = 0, sw = coverImg.width, sh = coverImg.height;
			if (r > tr) { sw = sh * tr; sx = (coverImg.width - sw) / 2; }
			else { sh = sw / tr; sy = (coverImg.height - sh) / 2; }
			ctx.drawImage(coverImg, sx, sy, sw, sh, 0, 0, width, coverHeight);
		} else {
			ctx.fillStyle = "#f3f4f6";
			ctx.fillRect(0, 0, width, coverHeight);
		}

		// Title
		let dy = coverHeight + padding;
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		ctx.font = titleFont;
		ctx.fillStyle = "#111827";
		for (const line of titleLines) { ctx.fillText(line, padding, dy); dy += 30 * scale; }
		dy += 16 * scale;

		// Description
		if (descLines.length) {
			ctx.font = descFont;
			ctx.fillStyle = "#4b5563";
			for (const line of descLines) { ctx.fillText(line, padding + 16 * scale, dy); dy += 25 * scale; }
		}
		dy += 24 * scale;

		// Divider
		ctx.strokeStyle = "#f3f4f6";
		ctx.lineWidth = scale;
		ctx.beginPath(); ctx.moveTo(padding, dy); ctx.lineTo(width - padding, dy); ctx.stroke();
		dy += 24 * scale;

		// Footer: author + QR
		if (avatarImg) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(padding + 32 * scale, dy + 32 * scale, 32 * scale, 0, Math.PI * 2);
			ctx.closePath(); ctx.clip();
			ctx.drawImage(avatarImg, padding, dy, 64 * scale, 64 * scale);
			ctx.restore();
		}
		const authorX = padding + (avatar ? 80 * scale : 0);
		ctx.fillStyle = "#9ca3af";
		ctx.font = `${12 * scale}px system-ui, sans-serif`;
		ctx.fillText(i18n(I18nKey.author, undefined), authorX, dy + 2 * scale);
		ctx.fillStyle = "#1f2937";
		ctx.font = `700 ${18 * scale}px system-ui, sans-serif`;
		ctx.fillText(author, authorX, dy + 22 * scale);

		// QR
		if (qrImg) {
			const qrSize = 64 * scale;
			const qrX = width - padding - qrSize;
			ctx.fillStyle = "#ffffff";
			ctx.shadowColor = "rgba(0,0,0,0.05)"; ctx.shadowBlur = 4 * scale; ctx.shadowOffsetY = 2 * scale;
			roundRect(ctx, qrX, dy, qrSize, qrSize, 4 * scale); ctx.fill();
			ctx.shadowColor = "transparent";
			ctx.drawImage(qrImg, qrX + 4 * scale, dy + 4 * scale, 56 * scale, 56 * scale);

			ctx.textAlign = "right";
			ctx.fillStyle = "#9ca3af";
			ctx.font = `${12 * scale}px system-ui, sans-serif`;
			ctx.fillText(i18n(I18nKey.scanToRead, undefined), qrX - 8 * scale, dy + 10 * scale);
			ctx.fillStyle = "#1f2937";
			ctx.font = `700 ${16 * scale}px system-ui, sans-serif`;
			ctx.fillText(siteTitle, qrX - 8 * scale, dy + 32 * scale);
		}
		posterImage = canvas.toDataURL("image/png");
	} catch (e) { console.error(e); }
	generating = false;
}

function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
	return canvas.getContext("2d");
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + r);
	ctx.closePath();
}

function downloadPoster() {
	if (!posterImage) return;
	const a = document.createElement("a");
	a.href = posterImage;
	a.download = `poster-${title.replace(/\s+/g, "-")}.png`;
	a.click();
}

function copyShareLink() {
	navigator.clipboard.writeText(url);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}
</script>

{#if title}
	<button
		class="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[var(--primary)]/80 dark:text-black/70"
		onclick={generatePoster}
	>
		↑
		{i18n(I18nKey.shareArticle, undefined)}
	</button>
{/if}

{#if showModal}
	<div
		class="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		onclick={() => (showModal = false)}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex max-h-[90vh] w-full max-w-[440px] flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-gray-800"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex min-h-[200px] items-center justify-center bg-gray-50 p-6 dark:bg-gray-900">
				{#if posterImage}
					<img src={posterImage} alt="Share Poster" class="max-h-[60vh] w-full rounded-lg object-contain shadow-lg" />
				{:else}
					<div class="flex flex-col items-center gap-3">
						<div class="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-[var(--primary)]"></div>
						<span class="text-sm text-50">{i18n(I18nKey.generatingPoster, undefined)}</span>
					</div>
				{/if}
			</div>
			<div class="grid grid-cols-2 gap-3 border-t border-black/10 p-4 dark:border-white/10">
				<button
					class="flex items-center justify-center gap-2 rounded-xl bg-black/5 px-4 py-3 font-medium text-70 transition-all hover:bg-black/10 active:scale-[0.98] dark:bg-white/10 dark:hover:bg-white/20"
					onclick={copyShareLink}
				>
					{copied ? "✓" : "🔗"}
					{i18n(copied ? I18nKey.copied : I18nKey.copyLink, undefined)}
				</button>
				<button
					class="flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 font-medium text-white shadow-lg transition-all hover:brightness-90 active:scale-[0.98] disabled:opacity-50"
					onclick={downloadPoster}
					disabled={!posterImage}
				>
					⬇
					{i18n(I18nKey.savePoster, undefined)}
				</button>
			</div>
		</div>
	</div>
{/if}
