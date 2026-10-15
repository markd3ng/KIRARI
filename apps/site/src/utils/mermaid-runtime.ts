import type { transitionManager } from "./transition-manager";

let installed = false;
let nextId = 0;

/** A single renderer is shared by the default and translated post routes. */
export function installMermaid(transitions: Pick<typeof transitionManager, "on">): void {
	if (installed) return;
	installed = true;

	const states = new WeakMap<HTMLElement, { source: string; theme?: string }>();
	let pending = Promise.resolve();

	async function render(): Promise<void> {
		const blocks = Array.from(document.querySelectorAll<HTMLElement>(
			'[data-mermaid-enabled="true"] pre.mermaid',
		));
		if (!blocks.length) return;
		const theme = document.documentElement.classList.contains("dark") ? "dark" : "default";
		const candidates = blocks.filter((block) => states.get(block)?.theme !== theme);
		if (!candidates.length) return;

		try {
			const { default: mermaid } = await import("mermaid");
			mermaid.initialize({ startOnLoad: false, theme, securityLevel: "strict", suppressErrorRendering: true });
			for (const block of candidates) {
				if (!block.isConnected) continue;
				const state = states.get(block) || { source: block.textContent || "", theme: undefined };
				states.set(block, state);
				state.theme = theme;
				const container = document.createElement("div");
				container.setAttribute("aria-hidden", "true");
				container.style.cssText = "position:fixed;visibility:hidden;pointer-events:none";
				document.body.append(container);
				try {
					// Mermaid measures SVG in the document; keep its temporary UI hidden and always remove it.
					const { svg, bindFunctions } = await mermaid.render(
						`kirari-mermaid-${nextId++}`, state.source, container,
					);
					if (!block.isConnected) continue;
					block.innerHTML = svg;
					block.removeAttribute("aria-label");
					block.dataset.mermaidRendered = theme;
					bindFunctions?.(block);
				} catch (error) {
					const code = document.createElement("code");
					code.textContent = state.source;
					block.replaceChildren(code);
					block.setAttribute("aria-label", "Mermaid diagram could not be rendered; source shown");
					delete block.dataset.mermaidRendered;
					console.warn("[Mermaid] Diagram rendering failed; source retained.", error);
				} finally {
					container.remove();
				}
			}
		} catch (error) {
			console.warn("[Mermaid] Renderer unavailable; source retained.", error);
		}
	}

	function refresh(): void {
		// Mermaid's global theme configuration and async renderer must not overlap.
		pending = pending.then(render).catch((error) => console.warn("[Mermaid] Initialization failed.", error));
	}

	transitions.on("transition:after-swap", refresh);
	new MutationObserver(refresh).observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class"],
	});
	refresh();
}
