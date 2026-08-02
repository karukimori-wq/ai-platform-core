# Basic Capability Example

Applications should register capabilities through the SDK boundary.

```ts
import {
  createCapabilityRegistry,
  createCapabilityRuntime,
  createPermissionChecker,
  ok
} from "@ai-platform-core/sdk";

const registry = createCapabilityRegistry();

registry.register({
  id: "Text.Uppercase",
  name: "Uppercase text",
  description: "Converts text to uppercase.",
  permission: "text.uppercase",
  input: "string",
  output: "string",
  execute: async (input: string) => ok(input.toUpperCase())
});

const runtime = createCapabilityRuntime(registry, createPermissionChecker());
```

