import type { CollectionEntry } from "astro:content";

type BuildOgPayloadOptions = {
	slug: string;
	siteUrl?: string;
	brand: string;
	templateName: string;
	width: number;
	height: number;
	defaultFeaturedImage?: string;
};

export type OgApiPayload = {
	templateName: string;
	format: "png";
	width: number;
	height: number;
	data: {
		title: string;
		subtitle: string;
		category: string;
		author: string;
		publishedAt: string;
		readingTime: string;
		featuredImage?: string;
		tags: string[];
		brand: string;
		slug: string;
	};
};

function toPublicImageUrl(image: string | undefined, siteUrl?: string): string {
	if (!image) return "";
	if (/^https?:\/\//i.test(image)) return image;
	if (!siteUrl) return "";
	if (!image.startsWith("/")) return "";

	try {
		return new URL(image, siteUrl).toString();
	} catch {
		return "";
	}
}

function estimateReadingMinutes(body: string): number {
	const words = body.trim().split(/\s+/).filter(Boolean).length;
	if (words === 0) return 1;
	return Math.max(1, Math.ceil(words / 220));
}

function formatDate(value: Date | undefined): string {
	if (!value) return "";
	return new Date(value).toLocaleDateString("en-US", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
}

export function buildOgApiPayload(
	post: CollectionEntry<"posts">,
	options: BuildOgPayloadOptions
): OgApiPayload {
	const { data } = post;
	const featuredImage =
		toPublicImageUrl(data.image, options.siteUrl) ||
		toPublicImageUrl(options.defaultFeaturedImage, options.siteUrl);

	const payload: OgApiPayload = {
		templateName: options.templateName,
		format: "png",
		width: options.width,
		height: options.height,
		data: {
			title: data.title,
			subtitle: data.description || "",
			category: data.category || "",
			author: options.brand,
			publishedAt: formatDate(data.published),
			readingTime: `${estimateReadingMinutes(post.body || "")} min read`,

			tags: (data.tags || []).slice(0, 5),
			brand: options.brand,
			slug: options.slug,
		},
	};

	if (featuredImage) {
		payload.data.featuredImage = featuredImage;
	}

	return payload;
}
