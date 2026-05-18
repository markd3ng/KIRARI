type ServiceBinding = {
	fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

type PagesContext<Env> = {
	request: Request;
	env: Env;
};

interface Env {
	GHCARD_CACHE: ServiceBinding;
}

export const onRequest = async (context: PagesContext<Env>): Promise<Response> => {
	const incomingUrl = new URL(context.request.url);
	const targetUrl = new URL(context.request.url);
	targetUrl.pathname = targetUrl.pathname.replace(/^\/ghc/, "/api/github");

	const headers = new Headers(context.request.headers);
	headers.set("X-KIRARI-GHC-PUBLIC-BASE", `${incomingUrl.origin}/ghc`);

	return context.env.GHCARD_CACHE.fetch(
		new Request(targetUrl, {
			method: context.request.method,
			headers,
			body: context.request.body,
			redirect: context.request.redirect,
		}),
	);
};
