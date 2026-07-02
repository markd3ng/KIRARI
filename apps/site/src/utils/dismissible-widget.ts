type DismissibleWidgetOptions = {
	widgetSelector: string;
	closeSelector: string;
	closedKey: (storageKey: string) => string;
	countKey?: (storageKey: string) => string;
};

export function initDismissibleWidgets(options: DismissibleWidgetOptions): void {
	document.querySelectorAll<HTMLElement>(options.widgetSelector).forEach((widget) => {
		const key = widget.dataset.storageKey;
		if (!key) return;

		const root = widget.closest("widget-layout") as HTMLElement | null;
		const closedKey = options.closedKey(key);
		if (localStorage.getItem(closedKey) === "1") {
			hideRoot(root);
			return;
		}

		const limit = Number(widget.dataset.displayCount || "-1");
		if (options.countKey && limit > 0) {
			const countKey = options.countKey(key);
			const count = Number(localStorage.getItem(countKey) || "0");
			if (count >= limit) {
				hideRoot(root);
				return;
			}
			localStorage.setItem(countKey, String(count + 1));
		}

		widget.querySelector(options.closeSelector)?.addEventListener("click", () => {
			localStorage.setItem(closedKey, "1");
			hideRoot(root);
		}, { once: true });
	});
}

function hideRoot(root: HTMLElement | null): void {
	if (root) root.hidden = true;
}
