import { createStoredAnalyticsRepository } from "@ai-platform-core/analytics";
import { createD1KeyValueStore, type D1DatabaseLike } from "@ai-platform-core/storage";
import { createPlatformRuntime, createPromptTemplateRuntime, createStoredPromptTemplateRepository, type PlatformRuntime } from "./index.js";

export interface CloudflareRuntimeOptions { readonly db:D1DatabaseLike; }
export const createCloudflarePlatformRuntime=(options:CloudflareRuntimeOptions):PlatformRuntime=>{
 const usage=createD1KeyValueStore(options.db,"analytics.usage");
 const outcomes=createD1KeyValueStore(options.db,"analytics.outcomes");
 const feedback=createD1KeyValueStore(options.db,"analytics.feedback");
 const promptStore=createD1KeyValueStore(options.db,"prompt.templates");
 const storage=createD1KeyValueStore<Readonly<Record<string,unknown>>>(options.db,"runtime.storage");
 return createPlatformRuntime({analytics:createStoredAnalyticsRepository({usage,outcomes,feedback}),prompt:createPromptTemplateRuntime(createStoredPromptTemplateRepository(promptStore)),storage});
};
