const userAgent = process.env.npm_config_user_agent || "";

if (userAgent && !userAgent.includes("pnpm")) {
	console.error("This project uses pnpm. Please run `pnpm install`.");
	process.exit(1);
}
