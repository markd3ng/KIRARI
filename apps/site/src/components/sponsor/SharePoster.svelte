<script lang="ts">
import QRCode from "qrcode";
import Icon from "@iconify/svelte";
import { onMount } from "svelte";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";

let {
	title = "",
	author = "",
	description = "",
	pubDate = "",
	url = "",
	siteTitle = "",
	avatar = "",
}: {
	title?: string;
	author?: string;
	description?: string;
	pubDate?: string;
	url?: string;
	siteTitle?: string;
	avatar?: string;
} = $props();

let showModal = $state(false);
let posterImage = $state<string | null>(null);
let generating = $state(false);
let copied = $state(false);
let themeColor = $state("#558e88");

onMount(() => {
	const el = document.createElement("div");
	el.style.color = "var(--primary)";
	el.style.display = "none";
	document.body.appendChild(el);
	const c = getComputedStyle(el).color;
	document.body.removeChild(el);
	if (c) themeColor = c;
});

function loadImage(src: string): Promise<HTMLImageElement | null> {
	return new Promise((resolve) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => {
			if (!src.includes("images.weserv.nl")) {
				const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&output=png`;
				const proxyImg = new Image();
				proxyImg.crossOrigin = "anonymous";
				proxyImg.onload = () => resolve(proxyImg);
				proxyImg.onerror = () => resolve(null);
				proxyImg.src = proxyUrl;
			} else {
				resolve(null);
			}
		};
		img.src = src;
	});
}

function getLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
	const chars = text.split("");
	const lines: string[] = [];
	let currentLine = "";
	for (let i = 0; i < chars.length; i++) {
		const char = chars[i];
		if (ctx.measureText(currentLine + char).width < maxWidth) {
			currentLine += char;
		} else {
			lines.push(currentLine);
			currentLine = char;
		}
	}
	if (currentLine) lines.push(currentLine);
	return lines;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + r);
	ctx.lineTo(x + w, y + h - r);
	ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
	ctx.lineTo(x + r, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + r);
	ctx.closePath();
}

async function generatePoster() {
	showModal = true;
	if (posterImage) return;
	generating = true;
	try {
		const scale = 2;
		const width = 425 * scale;
		const padding = 24 * scale;
		const qrCodeUrl = await QRCode.toDataURL(url, { margin: 1, width: 100 * scale, color: { dark: "#000000", light: "#ffffff" } });
		const coverH = 200 * scale;
		const [qrImg, coverImg, avatarImg] = await Promise.all([
			loadImage(qrCodeUrl),
			loadImage("/og/default.png"),
			avatar ? loadImage(avatar) : Promise.resolve(null),
		]);

		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas context not available");

		canvas.width = width;
		canvas.height = 1000 * scale;
		const contentWidth = width - padding * 2;
		let currentY = 0;

		// Cover area
		currentY += coverH;
		currentY += padding;

		// Title
		ctx.font = `700 ${24 * scale}px system-ui, sans-serif`;
		const titleLines = getLines(ctx, title, contentWidth);
		const titleHeight = titleLines.length * 30 * scale;
		currentY += titleHeight;
		currentY += 16 * scale;

		// Description
		let descHeight = 0;
		if (description) {
			ctx.font = `${14 * scale}px system-ui, sans-serif`;
			const descLines = getLines(ctx, description, contentWidth - 16 * scale).slice(0, 6);
			descHeight = descLines.length * 25 * scale;
			currentY += descHeight;
		} else {
			currentY += 8 * scale;
		}

		// Footer
		currentY += 24 * scale;
		currentY += 64 * scale;
		currentY += padding;

		// Resize canvas
		canvas.height = currentY;

		// === DRAW ===
		// Background
		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Decorative circles
		ctx.save();
		ctx.globalAlpha = 0.1;
		ctx.fillStyle = themeColor;
		ctx.beginPath();
		ctx.arc(width - 25 * scale, 25 * scale, 75 * scale, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.arc(10 * scale, canvas.height - 10 * scale, 50 * scale, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// Date badge
		let dateObj: { day: string; month: string; year: string } | null = null;
		try {
			const d = new Date(pubDate);
			if (!Number.isNaN(d.getTime())) {
				dateObj = { day: d.getDate().toString().padStart(2, "0"), month: (d.getMonth() + 1).toString().padStart(2, "0"), year: d.getFullYear().toString() };
			}
		} catch (_) {}

		// Cover
		if (coverImg) {
			const imgRatio = coverImg.width / coverImg.height;
			const targetRatio = width / coverH;
			let sx = 0, sy = 0, sw = coverImg.width, sh = coverImg.height;
			if (imgRatio > targetRatio) { sh = coverImg.height; sw = sh * targetRatio; sx = (coverImg.width - sw) / 2; }
			else { sw = coverImg.width; sh = sw / targetRatio; sx = 0; sy = (coverImg.height - sh) / 2; }
			ctx.drawImage(coverImg, sx, sy, sw, sh, 0, 0, width, coverH);
		} else {
			ctx.save();
			ctx.fillStyle = themeColor;
			ctx.globalAlpha = 0.2;
			ctx.fillRect(0, 0, width, coverH);
			ctx.restore();
		}

		// Date overlay
		if (dateObj) {
			const dBW = 60 * scale, dBH = 60 * scale;
			const dBX = padding, dBY = coverH - dBH;
			ctx.fillStyle = "rgba(0,0,0,0.3)";
			drawRoundedRect(ctx, dBX, dBY, dBW, dBH, 4 * scale);
			ctx.fill();
			ctx.fillStyle = "#ffffff";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.font = `700 ${30 * scale}px system-ui, sans-serif`;
			ctx.fillText(dateObj.day, dBX + dBW / 2, dBY + 24 * scale);
			ctx.strokeStyle = "rgba(255,255,255,0.6)";
			ctx.lineWidth = scale;
			ctx.beginPath();
			ctx.moveTo(dBX + 10 * scale, dBY + 42 * scale);
			ctx.lineTo(dBX + dBW - 10 * scale, dBY + 42 * scale);
			ctx.stroke();
			ctx.font = `${10 * scale}px system-ui, sans-serif`;
			ctx.fillText(`${dateObj.year} ${dateObj.month}`, dBX + dBW / 2, dBY + 51 * scale);
		}

		// Title
		let drawY = coverH + padding;
		ctx.textBaseline = "top";
		ctx.textAlign = "left";
		ctx.font = `700 ${24 * scale}px system-ui, sans-serif`;
		ctx.fillStyle = "#111827";
		titleLines.forEach((line) => { ctx.fillText(line, padding, drawY); drawY += 30 * scale; });
		drawY += 16 * scale;

		// Description with vertical accent
		if (description && descHeight > 0) {
			ctx.fillStyle = "#e5e7eb";
			drawRoundedRect(ctx, padding, drawY - 8 * scale, 4 * scale, descHeight + 8 * scale, 2 * scale);
			ctx.fill();
			ctx.font = `${14 * scale}px system-ui, sans-serif`;
			ctx.fillStyle = "#4b5563";
			const descLines = getLines(ctx, description, contentWidth - 16 * scale).slice(0, 6);
			descLines.forEach((line) => { ctx.fillText(line, padding + 16 * scale, drawY); drawY += 25 * scale; });
		} else {
			drawY += 8 * scale;
		}

		// Divider
		drawY += 24 * scale;
		ctx.strokeStyle = "#f3f4f6";
		ctx.lineWidth = scale;
		ctx.beginPath();
		ctx.moveTo(padding, drawY);
		ctx.lineTo(width - padding, drawY);
		ctx.stroke();
		drawY += 24 * scale;

		// Footer
		const footerY = drawY;
		if (avatarImg) {
			ctx.save();
			ctx.beginPath();
			ctx.arc(padding + 32 * scale, footerY + 32 * scale, 32 * scale, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(avatarImg, padding, footerY, 64 * scale, 64 * scale);
			ctx.restore();
			ctx.beginPath();
			ctx.arc(padding + 32 * scale, footerY + 32 * scale, 32 * scale, 0, Math.PI * 2);
			ctx.strokeStyle = "#ffffff";
			ctx.lineWidth = 2 * scale;
			ctx.stroke();
		}
		const textX = padding + (avatar ? 80 * scale : 0);
		const textCY = footerY + 32 * scale;
		ctx.fillStyle = "#9ca3af";
		ctx.font = `${12 * scale}px system-ui, sans-serif`;
		ctx.fillText(i18n(I18nKey.author), textX, textCY - 20 * scale);
		ctx.fillStyle = "#1f2937";
		ctx.font = `700 ${20 * scale}px system-ui, sans-serif`;
		ctx.fillText(author, textX, textCY + 4 * scale);

		// QR code
		const qrS = 64 * scale;
		const qrX = width - padding - qrS;
		ctx.fillStyle = "#ffffff";
		ctx.shadowColor = "rgba(0,0,0,0.05)";
		ctx.shadowBlur = 4 * scale;
		ctx.shadowOffsetY = 2 * scale;
		drawRoundedRect(ctx, qrX, footerY, qrS, qrS, 4 * scale);
		ctx.fill();
		ctx.shadowColor = "transparent";
		const qrPad = (qrS - 56 * scale) / 2;
		if (qrImg) ctx.drawImage(qrImg, qrX + qrPad, footerY + qrPad, 56 * scale, 56 * scale);

		const infoX = qrX - 16 * scale;
		ctx.textAlign = "right";
		ctx.fillStyle = "#9ca3af";
		ctx.font = `${12 * scale}px system-ui, sans-serif`;
		ctx.fillText(i18n(I18nKey.scanToRead), infoX, textCY - 20 * scale);
		ctx.fillStyle = "#1f2937";
		ctx.font = `700 ${20 * scale}px system-ui, sans-serif`;
		ctx.fillText(siteTitle, infoX, textCY + 4 * scale);

		posterImage = canvas.toDataURL("image/png");
		generating = false;
	} catch (error) {
		console.error("Failed to generate poster:", error);
		generating = false;
	}
}

function downloadPoster() {
	if (!posterImage) return;
	const a = document.createElement("a");
	a.href = posterImage;
	a.download = `poster-${title.replace(/\s+/g, "-")}.png`;
	a.click();
}

function closeModal() {
	showModal = false;
}

function copyLink() {
	navigator.clipboard.writeText(url);
	copied = true;
	setTimeout(() => (copied = false), 2000);
}
</script>

{#if title}
	<button
		class="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary)] text-white dark:text-black/70 rounded-lg font-medium hover:bg-[var(--primary)]/80 hover:scale-105 active:scale-95 transition-all whitespace-nowrap"
		onclick={generatePoster}
	>
		<Icon icon="material-symbols:share" />
		{i18n(I18nKey.shareArticle)}
	</button>
{/if}

{#if showModal}
	<div
		class="fixed inset-0 z-9999 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 transition-opacity"
		onclick={closeModal}
	>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="bg-white dark:bg-gray-800 rounded-2xl max-w-[440px] w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="p-6 flex justify-center bg-gray-50 dark:bg-gray-900 min-h-[200px] items-center">
				{#if posterImage}
					<img src={posterImage} alt="Poster" class="max-w-full h-auto shadow-lg rounded-lg" />
				{:else}
					<div class="flex flex-col items-center gap-3">
						<div class="w-8 h-8 border-2 border-gray-200 rounded-full animate-spin" style="border-top-color: {themeColor}"></div>
						<span class="text-sm text-gray-500">{i18n(I18nKey.generatingPoster)}</span>
					</div>
				{/if}
			</div>
			<div class="p-4 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-3">
				<button
					class="py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
					onclick={copyLink}
				>
					{#if copied}
						<Icon icon="material-symbols:check" />
						<span>{i18n(I18nKey.copied)}</span>
					{:else}
						<Icon icon="material-symbols:link" />
						<span>{i18n(I18nKey.copyLink)}</span>
					{/if}
				</button>
				<button
					class="py-3 text-white rounded-xl font-medium active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-90"
					style="background-color: {themeColor};"
					onclick={downloadPoster}
					disabled={!posterImage}
				>
					<Icon icon="material-symbols:download" />
					{i18n(I18nKey.savePoster)}
				</button>
			</div>
		</div>
	</div>
{/if}
