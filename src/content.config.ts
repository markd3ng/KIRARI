import { defineCollection } from "astro:content";


import { glob } from "astro/loaders";
import { z } from "astro/zod";

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		slug: z.string().optional().default(""),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		image: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		og: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		tags: z
			.array(z.string())
			.optional()
			.nullable()
			.transform((value) => value ?? []),
		tagLabels: z.record(z.string(), z.string()).optional().default({}),
		category: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		categoryLabel: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		lang: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		translationKey: z
			.string()
			.optional()
			.nullable()
			.transform((value) => value ?? ""),
		mermaid: z.boolean().optional().default(false),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
		routeSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};




