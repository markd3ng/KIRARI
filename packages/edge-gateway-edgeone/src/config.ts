import type { MakersGatewayOptions } from "./index.ts";

// Public source configuration only; never put credentials or private values here.
// Standalone hosting: set mode: "standalone" and exact HTTPS allowedOrigins.
export const gatewayPolicy = { mode: "integrated" } satisfies MakersGatewayOptions;
