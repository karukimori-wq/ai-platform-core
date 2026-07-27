import { type Result, err, ok, platformError } from "@ai-platform-core/kernel";

export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: readonly string[];
}

export interface PluginState {
  readonly manifest: PluginManifest;
  readonly enabled: boolean;
}

export interface PluginRuntime {
  readonly install: (manifest: PluginManifest) => Result<void>;
  readonly enable: (id: string) => Result<void>;
  readonly disable: (id: string) => Result<void>;
  readonly remove: (id: string) => Result<void>;
  readonly list: () => readonly PluginState[];
}

export const createPluginRuntime = (): PluginRuntime => {
  const plugins = new Map<string, PluginState>();
  return {
    install: (manifest) => {
      plugins.set(manifest.id, { manifest, enabled: false });
      return ok(undefined);
    },
    enable: (id) => updatePlugin(plugins, id, true),
    disable: (id) => updatePlugin(plugins, id, false),
    remove: (id) => {
      plugins.delete(id);
      return ok(undefined);
    },
    list: () => [...plugins.values()]
  };
};

const updatePlugin = (plugins: Map<string, PluginState>, id: string, enabled: boolean): Result<void> => {
  const plugin = plugins.get(id);
  if (plugin === undefined) {
    return err(platformError("PLUGIN_NOT_FOUND", `Plugin '${id}' was not installed.`));
  }
  plugins.set(id, { ...plugin, enabled });
  return ok(undefined);
};
