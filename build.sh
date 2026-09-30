#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -eq 0 ]]; then
	cd "$ROOT_DIR"
	exec env -u KIRARI_SITE_SOURCE -u KIRARI_BUILD_ONLY pnpm build
fi

if [[ $# -ne 2 || "$1" != "--site" || -z "$2" ]]; then
	printf 'Usage: ./build.sh [--site <directory>]\n' >&2
	exit 2
fi

cd "$ROOT_DIR"
exec node scripts/build-external-site.mjs "$2"
