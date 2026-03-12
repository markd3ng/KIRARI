import { getCollection } from "astro:content";
import satori from "satori";
import sharp from "sharp";
import { siteConfig } from "@/config";

export async function GET({ params, site }: { params: { slug: string }; site: URL }) {
	const slug = params.slug;

	// Get post by slug
	const posts = await getCollection("posts");
	const post = posts.find((p) => p.id === slug);

	if (!post) {
		return new Response("Post not found", { status: 404 });
	}

	const { title, description, published, tags } = post.data;
	const date = published ? new Date(published).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	}) : "";

	const ogConfig = siteConfig.og || {};
	const width = ogConfig.width || 1200;
	const height = ogConfig.height || 630;
	const brand = ogConfig.brand || siteConfig.title;
	const bgColor = ogConfig.backgroundColor || "#1a1a2e";
	const textColor = ogConfig.textColor || "#ffffff";

	// Generate SVG using satori
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
					fontFamily: "sans-serif",
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
											// Brand
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
											// Title
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
											// Description
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
								// Footer with date and tags
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
											// Date
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
											// Tags
											tags && tags.length > 0 && {
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
					name: "sans-serif",
					data: await fetchFont(),
					weight: 400,
					style: "normal",
				},
				{
					name: "sans-serif",
					data: await fetchFont(700),
					weight: 700,
					style: "normal",
				},
			],
		}
	);

	// Convert SVG to PNG
	const png = sharp(Buffer.from(svg))
		.resize(width, height)
		.png();

	const pngBuffer = await png.toBuffer();

	return new Response(pngBuffer, {
		headers: {
			"Content-Type": "image/png",
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}

async function fetchFont(weight: number = 400): Promise<ArrayBuffer> {
	// Use Google Fonts Inter as fallback
	const url = weight === 700
		? "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2"
		: "https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2";

	const response = await fetch(url);
	return response.arrayBuffer();
}

export async function getStaticPaths() {
	const posts = await getCollection("posts");
	return posts.map((post) => ({
		params: { slug: post.id },
	}));
}
