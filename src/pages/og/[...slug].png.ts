import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

import { readFile } from "node:fs/promises";
import path, { dirname, join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { siteConfig } from "@/config";

type FontWeight = 400 | 500 | 700 | 800;

const FONT_FILE_MAP: Record<FontWeight, string> = {
	400: "roboto-latin-400-normal.woff",
	500: "roboto-latin-500-normal.woff",
	700: "roboto-latin-700-normal.woff",
	800: "roboto-latin-900-normal.woff",
};

const fontCache = new Map<FontWeight, ArrayBuffer>();

type ResolvedTemplateBackground = {
	type: "color" | "linear-gradient";
	color?: string;
	direction?:
		| "to top"
		| "to top right"
		| "to right"
		| "to bottom right"
		| "to bottom"
		| "to bottom left"
		| "to left"
		| "to top left";
	colorStops?: string[];
	noise: number;
	gridOverlay?: {
		pattern: "grid" | "graph-paper" | "dots";
		color: string;
		opacity: number;
		blurRadius: number;
	};
};

type ResolvedTemplateConfig = {
	layoutStyle: "left-content" | "right-content";
	accentColor: string;
	background: ResolvedTemplateBackground;
	defaultFeaturedImage: string;
	logo: string;
};

type ResolvedCoverConfig = {
	allowUpscale: boolean;
	background: string;
};

type ResolvedExternalImageConfig = {
	timeoutMs: number;
	retry: number;
	retryDelayMs: number;
	useProxy: boolean;
};

async function loadFont(weight: FontWeight): Promise<ArrayBuffer> {
	const cached = fontCache.get(weight);
	if (cached) return cached;

	const fileName = FONT_FILE_MAP[weight];
	const localFontPath = join(
		process.cwd(),
		"node_modules/@fontsource/roboto/files",
		fileName
	);

	try {
		const buffer = await readFile(localFontPath);
		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		fontCache.set(weight, arrayBuffer);
		return arrayBuffer;
	} catch {
		const cdnUrl = `https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.2.10/files/${fileName}`;
		const response = await fetch(cdnUrl);
		if (!response.ok) {
			throw new Error(`Failed to load font from CDN (${response.status})`);
		}
		const arrayBuffer = await response.arrayBuffer();
		fontCache.set(weight, arrayBuffer);
		return arrayBuffer;
	}
}

function formatDate(value: Date | undefined): string {
	if (!value) return "";
	return new Date(value).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function estimateReadingMinutes(body: string): number {
	const words = body.trim().split(/\s+/).filter(Boolean).length;
	if (words === 0) return 1;
	return Math.max(1, Math.ceil(words / 220));
}

function toBackgroundShorthand(background: {
	type: "color" | "linear-gradient";
	color?: string;
	direction?:
		| "to top"
		| "to top right"
		| "to right"
		| "to bottom right"
		| "to bottom"
		| "to bottom left"
		| "to left"
		| "to top left";
	colorStops?: string[];
}): string {
	if (background.type === "color") {
		return background.color || "#ffffff";
	}
	const direction = background.direction || "to bottom right";
	const stops = background.colorStops?.length
		? background.colorStops.join(", ")
		: "#ffffff, #f8fafc, #f1f5f9";
	return `linear-gradient(${direction}, ${stops})`;
}

function svgToDataUrl(svg: string): string {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

function patternSvg(
	pattern: "grid" | "graph-paper" | "dots",
	color: string,
	opacity: number
): string {
	if (pattern === "grid") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><g fill="none" opacity="${opacity}"><path d="M48 47.5L0 47.5" stroke="${color}"/><path d="M47.5 0V48" stroke="${color}"/></g></svg>`;
	}
	if (pattern === "graph-paper") {
		return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g fill="${color}" fill-opacity="${opacity}"><path d="M6 5V0H5v5H0v1h5v94h1V6h94V5H6z"/></g></svg>`;
	}
	return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20"><g fill="${color}" fill-opacity="${opacity}"><circle cx="3" cy="3" r="3"/><circle cx="13" cy="13" r="3"/></g></svg>`;
}

function noiseSvg(opacity: number): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" stitchTiles="stitch"/></filter><rect width="120" height="120" filter="url(#n)" opacity="${opacity}"/></svg>`;
}

function getPostContentDir(post: CollectionEntry<"posts">): string {
	const filePath = (post as CollectionEntry<"posts"> & { filePath?: string }).filePath;
	if (filePath) {
		return dirname(path.resolve(process.cwd(), filePath));
	}

	const slugDir = path.dirname(post.id);
	return path.resolve(
		process.cwd(),
		"src/content/posts",
		slugDir === "." ? "" : slugDir
	);
}

async function readImageBufferFromDataUrl(dataUrl: string): Promise<Buffer> {
	const commaIndex = dataUrl.indexOf(",");
	if (commaIndex < 0) {
		throw new Error("Invalid data URL");
	}
	const meta = dataUrl.slice(0, commaIndex);
	const payload = dataUrl.slice(commaIndex + 1);
	if (meta.includes(";base64")) {
		return Buffer.from(payload, "base64");
	}
	return Buffer.from(decodeURIComponent(payload), "utf8");
}

async function fetchImageWithRetry(
	url: string,
	options: ResolvedExternalImageConfig
): Promise<Buffer> {
	const { timeoutMs, retry, retryDelayMs, useProxy } = options;

	// Prepare proxy agent if needed
	const proxyUrl = useProxy
		? (process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy)
		: undefined;

	// Note: Node.js native fetch doesn't support proxy directly
	// For full proxy support, you'd need to use undici or node-fetch with proxy agent
	// For now, we'll use the environment variable approach which works with some CDN/network configurations

	let lastError: Error | undefined;

	for (let attempt = 1; attempt <= retry; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

			const fetchOptions: RequestInit = {
				signal: controller.signal,
				headers: {
					"User-Agent": "KIRARI-OG-Generator/1.0",
				},
			};

			// Log proxy usage for debugging
			if (proxyUrl && attempt === 1) {
				console.log(`[og] Using proxy for external image: ${proxyUrl}`);
			}

			const response = await fetch(url, fetchOptions);
			clearTimeout(timeoutId);

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const arrayBuffer = await response.arrayBuffer();
			if (arrayBuffer.byteLength === 0) {
				throw new Error("Fetched image is empty");
			}

			if (attempt > 1) {
				console.log(`[og] Successfully fetched image on attempt ${attempt}/${retry}`);
			}

			return Buffer.from(arrayBuffer);
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			
			// Don't retry on abort (timeout)
			if (error instanceof Error && error.name === "AbortError") {
				throw new Error(`Image fetch timeout after ${timeoutMs}ms`);
			}

			// Log retry attempt
			if (attempt < retry) {
				console.warn(
					`[og] Image fetch attempt ${attempt}/${retry} failed: ${lastError.message}. Retrying in ${retryDelayMs}ms...`
				);
				await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
			}
		}
	}

	throw lastError || new Error(`Failed to fetch image after ${retry} attempts`);
}

async function readImageBuffer(
	image: string,
	post: CollectionEntry<"posts">,
	externalConfig?: ResolvedExternalImageConfig
): Promise<Buffer> {
	if (image.startsWith("data:")) {
		return readImageBufferFromDataUrl(image);
	}

	if (/^https?:\/\//i.test(image)) {
		const config = externalConfig || {
			timeoutMs: 15000,
			retry: 3,
			retryDelayMs: 1000,
			useProxy: true,
		};
		return fetchImageWithRetry(image, config);
	}

	if (image.startsWith("/")) {
		const publicPath = path.resolve(process.cwd(), "public", image.slice(1));
		return readFile(publicPath);
	}

	const postContentDir = getPostContentDir(post);
	const candidateFromPostDir = path.resolve(postContentDir, image);
	try {
		return await readFile(candidateFromPostDir);
	} catch {
		const candidateFromSrc = path.resolve(process.cwd(), "src", image);
		return readFile(candidateFromSrc);
	}
}

function mimeByFormat(format?: string): string {
	switch (format) {
		case "jpeg":
			return "image/jpeg";
		case "png":
			return "image/png";
		case "webp":
			return "image/webp";
		case "gif":
			return "image/gif";
		case "svg":
			return "image/svg+xml";
		case "avif":
			return "image/avif";
		default:
			return "image/png";
	}
}

async function imageToDataUrl(imageBuffer: Buffer): Promise<string> {
	const metadata = await sharp(imageBuffer, { animated: true }).metadata();
	const mime = mimeByFormat(metadata.format);
	return `data:${mime};base64,${imageBuffer.toString("base64")}`;
}

async function tryGetFeaturedImageDataUrl(
	post: CollectionEntry<"posts">,
	defaultFeaturedImage?: string
): Promise<string | null> {
	const source = post.data.image?.trim() || defaultFeaturedImage?.trim();
	if (!source) return null;
	try {
		const imageBuffer = await readImageBuffer(source, post);
		return await imageToDataUrl(imageBuffer);
	} catch (error) {
		console.warn(
			`[og] featured image load failed for slug=${post.id}: ${error instanceof Error ? error.message : "unknown error"}`
		);
		return null;
	}
}

async function tryGetLogoImageDataUrl(
	logoPath?: string
): Promise<string | null> {
	if (!logoPath?.trim()) return null;
	try {
		// Logo is relative to public directory or absolute URL
		const imageBuffer = await readImageBuffer(logoPath, {} as CollectionEntry<"posts">);
		return await imageToDataUrl(imageBuffer);
	} catch (error) {
		console.warn(`[og] logo image load failed: ${error instanceof Error ? error.message : "unknown error"}`);
		return null;
	}
}

async function generateMagazineOgPng(
	post: CollectionEntry<"posts">,
	width: number,
	height: number,
	brand: string,
	templateConfig: ResolvedTemplateConfig
): Promise<Buffer> {
	const featuredImageDataUrl = await tryGetFeaturedImageDataUrl(post, templateConfig.defaultFeaturedImage);
	const logoDataUrl = await tryGetLogoImageDataUrl(templateConfig.logo);
	const category = (post.data.category || "ARTICLE").toUpperCase();
	const title = post.data.title;
	const subtitle = post.data.description || "";
	const publishDate = formatDate(post.data.published);
	const readTime = `${estimateReadingMinutes(post.body || "")} min read`;
	const reverse = templateConfig.layoutStyle === "right-content";
	const background = templateConfig.background;

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					width: `${width}px`,
					height: `${height}px`,
					display: "flex",
					position: "relative",
					padding: "44px",
					gap: "28px",
					flexDirection: reverse ? "row-reverse" : "row",
					background: toBackgroundShorthand(background),
					fontFamily: "Roboto",
				},
				children: [
					{
						type: "div",
						props: {
							style: {
								position: "absolute",
								inset: 0,
								opacity: background.noise,
								backgroundImage: `url('${svgToDataUrl(noiseSvg(1))}')`,
								backgroundRepeat: "repeat",
							},
						},
					},
					background.gridOverlay
						? {
								type: "div",
								props: {
									style: {
										position: "absolute",
										inset: 0,
										opacity: 1,
										backgroundImage: `url('${svgToDataUrl(
											patternSvg(
												background.gridOverlay.pattern,
												background.gridOverlay.color,
												background.gridOverlay.opacity
											)
										)}')`,
										backgroundRepeat: "repeat",
									},
								},
							}
						: null,
					{
						type: "div",
						props: {
							style: {
								width: "58%",
								display: "flex",
								flexDirection: "column",
								justifyContent: "space-between",
								zIndex: 1,
							},
							children: [
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											gap: "12px",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														color: templateConfig.accentColor,
														fontWeight: 700,
														fontSize: "16px",
														letterSpacing: "0.08em",
													},
													children: category,
												},
											},
											{
												type: "div",
												props: {
													style: {
														fontWeight: 800,
														fontSize: "52px",
														lineHeight: 1.15,
														color: "#111827",
														maxHeight: "360px",
														overflow: "hidden",
													},
													children: title,
												},
											},
											subtitle
												? {
														type: "div",
														props: {
															style: {
																fontWeight: 400,
																fontSize: "24px",
																color: "#4b5563",
																lineHeight: 1.35,
																maxHeight: "100px",
																overflow: "hidden",
															},
															children: subtitle,
														},
													}
												: null,
										].filter(Boolean),
									},
								},
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														alignItems: "center",
														gap: "10px",
														color: "#374151",
														fontSize: "19px",
														fontWeight: 500,
													},
													children: logoDataUrl
														? [
																{
																	type: "img",
																	props: {
																		src: logoDataUrl,
																		alt: "logo",
																		style: {
																			width: "32px",
																			height: "32px",
																			objectFit: "contain",
																		},
																	},
																},
																{
																	type: "div",
																	props: {
																		children: brand,
																	},
																},
														  ]
														: [
																{
																	type: "div",
																	props: {
																		style: {
																			width: "10px",
																			height: "10px",
																			borderRadius: "9999px",
																			backgroundColor: templateConfig.accentColor,
																		},
																	},
																},
																{
																	type: "div",
																	props: {
																		children: brand,
																	},
																},
														  ],
												},
											},
											{
												type: "div",
												props: {
													style: {
														display: "flex",
														gap: "8px",
														fontSize: "16px",
														color: "#6b7280",
													},
													children: [
														{
															type: "div",
															props: { children: publishDate },
														},
														{
															type: "div",
															props: { children: "•" },
														},
														{
															type: "div",
															props: { children: readTime },
														},
													],
												},
											},
										],
									},
								},
							],
						},
					},
					{
						type: "div",
						props: {
							style: {
								width: "42%",
								display: "flex",
								alignItems: "stretch",
								zIndex: 1,
							},
							children: featuredImageDataUrl
								? {
										type: "img",
										props: {
											src: featuredImageDataUrl,
											alt: "featured image",
											style: {
												width: "100%",
												height: "100%",
												objectFit: "cover",
												borderRadius: "22px",
												backgroundColor: "#e5e7eb",
											},
										},
								  }
								: {
										type: "div",
										props: {
											style: {
												width: "100%",
												height: "100%",
												borderRadius: "22px",
												background: "linear-gradient(135deg, #dbeafe, #e2e8f0)",
												border: `1px solid ${templateConfig.accentColor}33`,
											},
										},
								  },
						},
					},
				].filter(Boolean),
			},
		},
		{
			width,
			height,
			fonts: [
				{ name: "Roboto", data: await loadFont(400), weight: 400, style: "normal" },
				{ name: "Roboto", data: await loadFont(500), weight: 500, style: "normal" },
				{ name: "Roboto", data: await loadFont(700), weight: 700, style: "normal" },
				{ name: "Roboto", data: await loadFont(800), weight: 800, style: "normal" },
			],
		}
	);

	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateCoverOgPng(
	post: CollectionEntry<"posts">,
	width: number,
	height: number,
	options: ResolvedCoverConfig,
	externalConfig: ResolvedExternalImageConfig
): Promise<Buffer | null> {
	const source = post.data.image?.trim();
	if (!source) return null;

	const imageBuffer = await readImageBuffer(source, post, externalConfig);
	const image = sharp(imageBuffer, { animated: true });
	const metadata = await image.metadata();
	const srcWidth = metadata.width || 0;
	const srcHeight = metadata.height || 0;
	const isSmall = srcWidth > 0 && srcHeight > 0 && (srcWidth < width || srcHeight < height);

	if (!options.allowUpscale && isSmall) {
		return image
			.resize(width, height, {
				fit: "contain",
				position: "centre",
				withoutEnlargement: true,
				background: options.background,
			})
			.png()
			.toBuffer();
	}

	return image
		.resize(width, height, {
			fit: "cover",
			position: "centre",
			withoutEnlargement: !options.allowUpscale,
		})
		.png()
		.toBuffer();
}

function resolveTemplateConfig(
	template: NonNullable<NonNullable<typeof siteConfig.og>["template"]> | undefined
): ResolvedTemplateConfig {
	const background = template?.background;
	const resolvedBackground: ResolvedTemplateBackground =
		background?.type === "color"
			? {
					type: "color",
					color: background.color || "#ffffff",
					noise: background.noise ?? 0.02,
					gridOverlay: background.gridOverlay
						? {
								pattern: background.gridOverlay.pattern,
								color: background.gridOverlay.color,
								opacity: background.gridOverlay.opacity ?? 0.3,
								blurRadius: background.gridOverlay.blurRadius ?? 60,
						  }
						: undefined,
			  }
			: {
					type: "linear-gradient",
					direction: background?.type === "linear-gradient" ? background.direction : "to bottom right",
					colorStops:
						background?.type === "linear-gradient" && background.colorStops.length > 0
							? background.colorStops
							: ["#ffffff", "#f8fafc", "#f1f5f9"],
					noise: background?.noise ?? 0.02,
					gridOverlay: background?.gridOverlay
						? {
								pattern: background.gridOverlay.pattern,
								color: background.gridOverlay.color,
								opacity: background.gridOverlay.opacity ?? 0.3,
								blurRadius: background.gridOverlay.blurRadius ?? 60,
						  }
						: {
								pattern: "dots",
								color: "#e2e8f0",
								opacity: 0.3,
								blurRadius: 60,
						  },
			  };

	return {
		layoutStyle: template?.layoutStyle || "left-content",
		accentColor: template?.accentColor || "#2563eb",
		background: resolvedBackground,
		defaultFeaturedImage: template?.defaultFeaturedImage || "",
		logo: template?.logo || "",
	};
}

function resolveCoverConfig(
	cover: NonNullable<NonNullable<typeof siteConfig.og>["cover"]> | undefined
): ResolvedCoverConfig {
	return {
		allowUpscale: cover?.allowUpscale ?? false,
		background: cover?.background || "#0f172a",
	};
}

function resolveExternalImageConfig(
	externalImage: NonNullable<NonNullable<typeof siteConfig.og>["externalImage"]> | undefined
): ResolvedExternalImageConfig {
	return {
		timeoutMs: externalImage?.timeoutMs ?? 15000,
		retry: externalImage?.retry ?? 3,
		retryDelayMs: externalImage?.retryDelayMs ?? 1000,
		useProxy: externalImage?.useProxy ?? true,
	};
}

function responsePng(buffer: Buffer): Response {
	return new Response(new Uint8Array(buffer), {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}


export async function GET({ params }: { params: { slug?: string } }): Promise<Response> {
	const slug = params.slug;
	if (!slug) {
		return new Response("Post not found", { status: 404 });
	}

	const posts = await getCollection("posts");
	const post = posts.find((p) => p.id === slug);
	if (!post) {
		return new Response("Post not found", { status: 404 });
	}

	const ogConfig = siteConfig.og || {
		defaultImage: "/og/default.png",
		width: 1200,
		height: 630,
	};
	const width = ogConfig.width || 1200;
	const height = ogConfig.height || 630;
	const brand = ogConfig.brand || siteConfig.title;

	const coverOptions = resolveCoverConfig(ogConfig.cover);
	const externalImageConfig = resolveExternalImageConfig(ogConfig.externalImage);

	if (ogConfig.useCoverAsOg && post.data.image) {
		try {
			const coverPng = await generateCoverOgPng(post, width, height, coverOptions, externalImageConfig);
			if (coverPng) return responsePng(coverPng);
		} catch (error) {
			console.warn(
				`[og] cover direct output failed for slug=${slug}: ${error instanceof Error ? error.message : "unknown error"}`
			);
		}
	}

	const templateConfig = resolveTemplateConfig(ogConfig.template);
	const pngBuffer = await generateMagazineOgPng(post, width, height, brand, templateConfig);

	return responsePng(pngBuffer);
}

export async function getStaticPaths(): Promise<{ params: { slug: string } }[]> {
	const posts = await getCollection("posts");
	return posts.map((post) => ({
		params: { slug: post.id },
	}));
}
