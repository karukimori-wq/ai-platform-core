import { createPlatformRuntime } from "@ai-platform-core/sdk";

const runtime = createPlatformRuntime();
runtime.logger.info("AI Platform Core playground started.", {
  now: runtime.clock.now().toISOString()
});
