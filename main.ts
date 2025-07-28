import { defineApp } from "@slflows/sdk/v1";
import { generate } from "./blocks/generate";
import { tool } from "./blocks/tool";
import { randomBytes } from "crypto";

export const app = defineApp({
  name: "OpenRouter",
  installationInstructions: `To use this app, you need an OpenRouter API key.

1. Sign up at https://openrouter.ai/
2. Generate an API key from your dashboard
3. Enter your API key in the configuration below`,
  config: {
    apiKey: {
      name: "OpenRouter API Key",
      description: "Your OpenRouter API key",
      type: "string",
      required: true,
      sensitive: true,
    },
  },
  signals: {
    toolSecuritySecret: {
      name: "Tool Security Secret",
      description: "Auto-generated secret for securing tool communications",
      sensitive: true,
    },
  },
  blocks: { generate, tool },
  async onSync({ app }) {
    // Generate tool security secret if not already set
    let signalUpdates: any = {};
    if (!app.signals.toolSecuritySecret) {
      const secret = randomBytes(32).toString("hex");
      signalUpdates.toolSecuritySecret = secret;
    }

    // Test API key by making a simple request to OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${app.config.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.log(
        "Failed to validate OpenRouter API key: ",
        response.status,
        response.statusText,
      );
      return {
        newStatus: "failed",
        customStatusDescription: "See logs for details",
        signalUpdates,
      };
    }

    return {
      newStatus: "ready",
      signalUpdates,
    };
  },
});
