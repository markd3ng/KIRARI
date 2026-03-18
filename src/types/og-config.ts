export type OGApiConfig = {
	/** 是否启用外部 OG API 服务 */
	enabled: boolean;
	/** API 端点地址，如 https://og.saru.im/api/v1/images */
	endpoint: string;
	/** 模板名称，如 blog:magazine */
	templateName: string;
	/** 请求超时时间（毫秒） */
	timeoutMs?: number;
	/** 失败重试次数 */
	retry?: number;
	/** API 失败时是否回退到本地生成 */
	fallbackToLocal?: boolean;
	/** 品牌名（用于模板展示） */
	brand?: string;
	/** 默认封面图 URL（无封面时使用） */
	defaultFeaturedImage?: string;
};
