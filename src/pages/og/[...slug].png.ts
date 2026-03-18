import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { siteConfig } from "@/config";
import { requestOgImageFromApi } from "@/utils/og-api";
import { buildOgApiPayload } from "@/utils/og-payload";

let fontCache: { regular: ArrayBuffer | null; bold: ArrayBuffer | null } = {
	regular: null,
	bold: null,
};

async function loadFont(weight: number): Promise<ArrayBuffer> {
	const cacheKey = weight === 700 ? "bold" : "regular";
	const cached = fontCache[cacheKey];
	if (cached) return cached;

	const fontFile =
		weight === 700
			? "roboto-latin-700-normal.woff"
			: "roboto-latin-400-normal.woff";

	try {
		const fontPath = join(
			process.cwd(),
			"node_modules/@fontsource/roboto/files",
			fontFile
		);
		const buffer = await readFile(fontPath);
		const arrayBuffer = buffer.buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		fontCache[cacheKey] = arrayBuffer;
		return arrayBuffer;
	} catch {
		const cdnUrl =
			weight === 700
				? "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-700-normal.woff"
				: "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.8/files/roboto-latin-400-normal.woff";

		const response = await fetch(cdnUrl);
		const arrayBuffer = await response.arrayBuffer();
		fontCache[cacheKey] = arrayBuffer;
		return arrayBuffer;
	}
}

async function generateLocalOgPng(
	post: CollectionEntry<"posts">,
	width: number,
	height: number,
	brand: string,
	bgColor: string,
	textColor: string
): Promise<Buffer> {

	const { title, description, published, tags } = post.data;
	const date = published
		? new Date(published).toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: "";

	const svg = await satori(
		{
			type: "div",
			props: {
				style: {
					width: "100%",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					backgroundColor: bgColor,
					padding: "60px",
					fontFamily: "Roboto",
				},
				children: [
					{
						type: "div",
						props: {
							style: {
								display: "flex",
								flexDirection: "column",
								flex: 1,
								justifyContent: "space-between",
							},
							children: [
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											flexDirection: "column",
											gap: "20px",
										},
										children: [
											{
												type: "div",
												props: {
													style: {
														fontSize: "24px",
														color: textColor,
														opacity: 0.8,
													},
													children: brand,
												},
											},
											{
												type: "div",
												props: {
													style: {
														fontSize: "56px",
														fontWeight: "bold",
														color: textColor,
														lineHeight: 1.2,
														maxWidth: "90%",
													},
													children: title,
												},
											},
											description && {
												type: "div",
												props: {
													style: {
														fontSize: "28px",
														color: textColor,
														opacity: 0.7,
														maxWidth: "80%",
														overflow: "hidden",
														textOverflow: "ellipsis",
														display: "-webkit-box",
														WebkitLineClamp: 2,
														WebkitBoxOrient: "vertical" as const,
													},
													children: description,
												},
											},
										].filter(Boolean),
									},
								},
								{
									type: "div",
									props: {
										style: {
											display: "flex",
											justifyContent: "space-between",
											alignItems: "flex-end",
											marginTop: "40px",
										},
										children: [
											date && {
												type: "div",
												props: {
													style: {
														fontSize: "22px",
														color: textColor,
														opacity: 0.6,
													},
													children: date,
												},
											},
											tags &&
												tags.length > 0 && {
													type: "div",
													props: {
														style: {
															display: "flex",
															gap: "12px",
														},
														children: tags.slice(0, 3).map((tag: string) => ({
															type: "div",
															props: {
																style: {
																	fontSize: "18px",
																	color: textColor,
																	backgroundColor: "rgba(255,255,255,0.1)",
																	padding: "8px 16px",
																	borderRadius: "20px",
																},
																children: tag,
															},
														})),
													},
												},
										].filter(Boolean),
									},
								},
							],
						},
					},
				],
			},
		},
		{
			width,
			height,
			fonts: [
				{
					name: "Roboto",
					data: await loadFont(400),
					weight: 400,
					style: "normal",
				},
				{
					name: "Roboto",
					data: await loadFont(700),
					weight: 700,
					style: "normal",
				},
			],
		}
	);

	const pngBuffer = await sharp(Buffer.from(svg))
		.resize(width, height)
		.png()
		.toBuffer();

	return pngBuffer;
}

function buildSiteUrl(): string | undefined {
	if (!siteConfig.url) return undefined;
	try {
		return new URL(siteConfig.base || "/", siteConfig.url).toString();
	} catch {
		return undefined;
	}
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
	const bgColor = ogConfig.backgroundColor || "#1a1a2e";
	const textColor = ogConfig.textColor || "#ffffff";
	const apiConfig = ogConfig.api;
	const fallbackToLocal = apiConfig?.fallbackToLocal ?? true;

	if (apiConfig?.enabled) {
		try {
			const payload = buildOgApiPayload(post, {
				slug,
				siteUrl: buildSiteUrl(),
				brand: apiConfig.brand || brand,
				templateName: apiConfig.templateName,
				width,
				height,
				defaultFeaturedImage: apiConfig.defaultFeaturedImage,
			});
			const apiImage = await requestOgImageFromApi(payload, apiConfig, slug);
			return new Response(new Uint8Array(apiImage), {

				headers: {
					"Content-Type": "image/png",
					"Cache-Control": "public, max-age=31536000, immutable",
				},
			});
		} catch (error) {
			console.warn(
				`[og] external API failed for slug=${slug}: ${error instanceof Error ? error.message : "unknown error"}`
			);
			if (!fallbackToLocal) {
				return new Response("Failed to generate OG image", { status: 502 });
			}
		}
	}

	const pngBuffer = await generateLocalOgPng(
		post,
		width,
		height,
		brand,
		bgColor,
		textColor
	);

	return new Response(new Uint8Array(pngBuffer), {

		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

export async function getStaticPaths(): Promise<{ params: { slug: string } }[]> {

	const posts = await getCollection("posts");
	return posts.map((post) => ({
		params: { slug: post.id },
	}));
}
