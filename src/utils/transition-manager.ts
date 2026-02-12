/**
 * Transition Manager
 *
 * Provides a unified API for page transitions using:
 * - Native View Transitions API (primary, for modern browsers)
 * - Swup (fallback, dynamically loaded for browsers without View Transitions support)
 */

// Feature detection
export const supportsViewTransitions =
	typeof document !== "undefined" && "startViewTransition" in document;

// Unified event types that map to both Astro ClientRouter and Swup events
export type TransitionEventType =
	| "transition:start" // Navigation begins
	| "transition:before-swap" // Content loaded, about to swap
	| "transition:after-swap" // DOM swapped
	| "transition:end"; // Navigation complete

export interface TransitionEventData {
	from?: string;
	to?: string;
	direction?: "forward" | "back";
}

type TransitionCallback = (data?: TransitionEventData) => void;

class TransitionManager {
	private listeners = new Map<TransitionEventType, Set<TransitionCallback>>();
	private swupInstance: any = null;
	private initialized = false;

	constructor() {
		// Initialize listener sets
		const events: TransitionEventType[] = [
			"transition:start",
			"transition:before-swap",
			"transition:after-swap",
			"transition:end",
		];
		events.forEach((event) => {
			this.listeners.set(event, new Set());
		});
	}

	/**
	 * Register a callback for a transition event
	 */
	on(event: TransitionEventType, callback: TransitionCallback): () => void {
		const listeners = this.listeners.get(event);
		if (listeners) {
			listeners.add(callback);
		}
		// Return unsubscribe function
		return () => {
			listeners?.delete(callback);
		};
	}

	/**
	 * Emit a transition event to all registered listeners
	 */
	emit(event: TransitionEventType, data?: TransitionEventData): void {
		const listeners = this.listeners.get(event);
		if (listeners) {
			listeners.forEach((callback) => {
				try {
					callback(data);
				} catch (error) {
					console.error(
						`Error in transition event handler for ${event}:`,
						error,
					);
				}
			});
		}
	}

	/**
	 * Initialize the transition system
	 * - If View Transitions are supported, set up Astro ClientRouter event listeners
	 * - Otherwise, dynamically load and initialize Swup as fallback
	 */
	async init(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;

		if (supportsViewTransitions) {
			console.log("[TransitionManager] Using native View Transitions API");
			this.setupAstroClientRouter();
		} else {
			console.log(
				"[TransitionManager] View Transitions not supported, loading Swup fallback",
			);
			await this.setupSwupFallback();
		}
	}

	/**
	 * Set up Astro ClientRouter event listeners
	 * Maps Astro lifecycle events to unified transition events
	 */
	private setupAstroClientRouter(): void {
		// astro:before-preparation - Navigation starts
		document.addEventListener("astro:before-preparation", (event: any) => {
			const data: TransitionEventData = {
				from: event.from?.href,
				to: event.to?.href,
				direction: event.direction,
			};
			this.emit("transition:start", data);
		});

		// astro:before-swap - Content loaded, about to swap DOM
		document.addEventListener("astro:before-swap", (event: any) => {
			const data: TransitionEventData = {
				from: event.from?.href,
				to: event.to?.href,
				direction: event.direction,
			};
			this.emit("transition:before-swap", data);
		});

		// astro:after-swap - DOM swapped
		document.addEventListener("astro:after-swap", () => {
			const data: TransitionEventData = {
				to: window.location.href,
			};
			this.emit("transition:after-swap", data);
		});

		// astro:page-load - Navigation complete
		document.addEventListener("astro:page-load", () => {
			const data: TransitionEventData = {
				to: window.location.href,
			};
			this.emit("transition:end", data);
		});
	}

	/**
	 * Dynamically load and initialize Swup for browsers without View Transitions
	 */
	private async setupSwupFallback(): Promise<void> {
		try {
			// Dynamically import Swup and plugins
			// Note: SwupProgressPlugin is NOT used - we use our own CSS class-based
			// progress bar animation controlled via onTransitionStart/onTransitionEnd
			// in Layout.astro for consistency with View Transitions mode
			const [{ default: Swup }, { default: SwupPreloadPlugin }] =
				await Promise.all([import("swup"), import("@swup/preload-plugin")]);

			// Initialize Swup with similar config to previous @swup/astro setup
			this.swupInstance = new Swup({
				animationSelector: '[class*="transition-swup-"]',
				containers: ["main", "#toc"],
				cache: true,
				plugins: [new SwupPreloadPlugin()],
			});

			// Map Swup events to unified transition events
			this.swupInstance.hooks.on("visit:start", (visit: any) => {
				this.emit("transition:start", {
					from: visit.from?.url,
					to: visit.to?.url,
				});
			});

			this.swupInstance.hooks.on("content:replace", () => {
				this.emit("transition:before-swap", {
					to: window.location.href,
				});
			});

			this.swupInstance.hooks.on("page:view", () => {
				this.emit("transition:after-swap", {
					to: window.location.href,
				});
			});

			this.swupInstance.hooks.on("visit:end", (visit: any) => {
				this.emit("transition:end", {
					to: visit.to?.url,
				});
			});

			// Expose swup globally for compatibility with existing code
			(window as any).swup = this.swupInstance;

			// Dispatch event for any code waiting for swup
			document.dispatchEvent(new CustomEvent("swup:enable"));

			console.log("[TransitionManager] Swup fallback initialized");
		} catch (error) {
			console.error("[TransitionManager] Failed to load Swup fallback:", error);
		}
	}

	/**
	 * Check if using View Transitions or Swup fallback
	 */
	isUsingViewTransitions(): boolean {
		return supportsViewTransitions;
	}

	/**
	 * Check if using Swup fallback
	 */
	isUsingSwup(): boolean {
		return !supportsViewTransitions && this.swupInstance !== null;
	}

	/**
	 * Get the Swup instance (if using fallback)
	 */
	getSwupInstance(): any {
		return this.swupInstance;
	}
}

// Singleton instance
export const transitionManager = new TransitionManager();

// Export for type declarations
declare global {
	interface Window {
		swup: any;
		transitionManager?: TransitionManager;
	}
}
