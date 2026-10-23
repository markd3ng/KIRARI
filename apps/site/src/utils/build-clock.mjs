const MAX_EPOCH_SECONDS = 8_640_000_000_000;

export function getBuildDate(environment = process.env) {
	if (environment.KIRARI_DETERMINISTIC_BUILD_CLOCK !== "true") return new Date();
	const sourceDateEpoch = environment.SOURCE_DATE_EPOCH;
	if (sourceDateEpoch === undefined) throw new Error("A deterministic build clock requires SOURCE_DATE_EPOCH.");
	if (!/^(0|[1-9]\d*)$/.test(sourceDateEpoch)) {
		throw new Error("SOURCE_DATE_EPOCH must be a nonnegative whole number of seconds.");
	}
	const timestamp = Number(sourceDateEpoch);
	if (!Number.isSafeInteger(timestamp) || timestamp > MAX_EPOCH_SECONDS) {
		throw new Error("SOURCE_DATE_EPOCH must be within the valid JavaScript Date range.");
	}
	return new Date(timestamp * 1000);
}
