import type { SidebarWidgetType } from "../../types/config";

export const sidebarWidgetRegistry: Record<SidebarWidgetType, { label: string }> = {
	profile: { label: "Profile" },
	toc: { label: "Table of Contents" },
	categories: { label: "Categories" },
	tags: { label: "Tags" },
	announcement: { label: "Announcement" },
	advertisement: { label: "Advertisement" },
	siteStats: { label: "Site Stats" },
	siteInfo: { label: "Site Info" },
	calendar: { label: "Calendar" },
};
