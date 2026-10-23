export function formatLocalBuildTime(date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		calendar: "gregory",
		numberingSystem: "latn",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const value = (type) => parts.find((part) => part.type === type).value;

	return `${value("year")}-${value("month")}-${value("day")} ${value("hour")}:${value("minute")}:${value("second")}`;
}
