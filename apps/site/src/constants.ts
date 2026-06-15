import type { Config as ConfigType } from "./types/config";
import { loadConfig } from "./utils/config-loader";

/**
 * Site configuration loaded from TOML file
 * 从 TOML 文件加载的站点配置
 * 
 * Configuration priority: ENV variables > TOML config > Default values
 * 配置优先级：环境变量 > TOML 配置 > 默认值
 * 
 * Edit kirari.config.toml to customize your site.
 * 编辑 kirari.config.toml 来自定义你的站点。
 */
const loadedConfig = loadConfig();

export const Config: ConfigType = loadedConfig;
