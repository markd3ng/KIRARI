import { getLlmStaticPaths, serveLlmMarkdown } from "../../utils/llm-content";

export const getStaticPaths = getLlmStaticPaths;
export const GET = serveLlmMarkdown;
