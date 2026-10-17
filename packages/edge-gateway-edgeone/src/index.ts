import { createGatewayHandler, type GatewayFetch, type GatewayMode } from "@kirari/edge-gateway-core";

/** Public, build-time policy only. Secrets and cache bindings are deliberately unavailable. */
export type MakersGatewayOptions = {
	mode?: GatewayMode;
	allowedOrigins?: readonly string[];
	fetch?: GatewayFetch;
};

export type MakersRequestContext = { request: Request };

/** Makers file-route handler; no env, KV, cache, next(), or waitUntil dependency. */
export function createMakersGateway(options: MakersGatewayOptions = {}) {
	const handle = createGatewayHandler({
		mode: options.mode,
		allowedOrigins: options.allowedOrigins,
		fetch: abortAwareFetch(options.fetch ?? globalThis.fetch.bind(globalThis)),
		cacheLevel: "CACHE_NONE",
	});
	return function onRequest(context: MakersRequestContext): Promise<Response> {
		const request = context.request;
		// Makers documents AbortController, but not an inbound Request.signal.
		// Keep the original URL/method/body/header accessors without reconstructing it.
		const fallback = request.signal ? undefined : new AbortController().signal;
		const compatible = fallback
			? new Proxy(request, {
				get(target, key) {
					return key === "signal" ? fallback : Reflect.get(target, key, target);
				},
			})
			: request;
		return handle(compatible);
	};
}

/** Enforce Core's deadline even if the provider fetch ignores AbortSignal. */
function abortAwareFetch(fetcher: GatewayFetch): GatewayFetch {
	return (input, init) => new Promise<Response>((resolve, reject) => {
		const signal = init?.signal;
		let aborted = false;
		let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
		let stream: TransformStreamDefaultController<Uint8Array> | undefined;
		const cleanup = () => signal?.removeEventListener("abort", abort);
		const cancel = () => { void reader?.cancel().catch(() => undefined); };
		const abort = () => {
			aborted = true;
			cleanup();
			// No provider exception, URL, header or binding value enters this error.
			const error = new Error("Gateway upstream aborted.");
			if (stream) stream.error(error);
			else reject(error);
			cancel();
		};
		if (signal?.aborted) { abort(); return; }
		signal?.addEventListener("abort", abort, { once: true });
		Promise.resolve().then(() => {
			if (aborted) throw new Error("Gateway upstream aborted.");
			return fetcher(input, init);
		}).then((response) => {
			if (aborted) {
				void response.body?.cancel().catch(() => undefined);
				return;
			}
			if (!response.body) { cleanup(); resolve(response); return; }
			const responseReader = response.body.getReader();
			reader = responseReader;
			// Makers supports TransformStream construction, but not new ReadableStream.
			const body = new TransformStream<Uint8Array, Uint8Array>({
				start(controller) { stream = controller; },
			});
			const writer = body.writable.getWriter();
			// Core may reject a status/header without reading its body. Cancellation
			// must release the source even while its first read is still pending.
			void writer.closed.catch(() => { cleanup(); cancel(); });
			void (async () => {
				try {
					while (true) {
						const chunk = await responseReader.read();
						if (aborted) return;
						if (chunk.done) { await writer.close(); cleanup(); return; }
						await writer.write(chunk.value);
					}
				} catch {
					cleanup();
					cancel();
					if (!aborted) stream?.error(new Error("Gateway upstream read failed."));
				} finally {
					writer.releaseLock();
				}
			})();
			resolve(new Response(body.readable, { status: response.status, statusText: response.statusText, headers: response.headers }));
		}).catch(() => {
			cleanup();
			cancel();
			reject(new Error("Gateway upstream unavailable."));
		});
	});
}
