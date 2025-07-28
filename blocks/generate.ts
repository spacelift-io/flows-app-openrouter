import { AppBlock, events } from "@slflows/sdk/v1";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { jsonSchema, generateText, generateObject, tool } from "ai";
import { generateFlowSecret, signRequest } from "../lib/security";
import { SECURITY_HEADERS } from "../lib/headers";
import { withRetry } from "../lib/retry";

export const generate: AppBlock = {
  name: "Generate",
  description:
    "Generate text or a structured message using one of the OpenRouter models",
  inputs: {
    default: {
      config: {
        model: {
          name: "Model",
          description: "The model to use for generation",
          type: "string",
          required: true,
        },
        schema: {
          name: "Schema",
          description:
            "The JSON schema to generate the object from. If not provided, returns simple content object.",
          type: {
            type: "object",
            additionalProperties: true,
          },
          required: false,
        },
        messages: {
          name: "Messages",
          description:
            "Array of messages to provide context for the generation. Mutually exclusive with 'prompt'.",
          type: {
            type: "array",
            items: {
              type: "object",
              properties: {
                role: { type: "string" },
                content: { type: "string" },
              },
              required: ["role", "content"],
            },
          },
          required: false,
        },
        prompt: {
          name: "Prompt",
          description:
            "The user prompt for generation. Mutually exclusive with 'messages'.",
          type: "string",
          required: false,
        },
        system: {
          name: "System prompt",
          description: "The system prompt to guide the model's behavior",
          type: "string",
          required: false,
        },
        maxRetries: {
          name: "Max retries",
          description: "Maximum number of retries for generation",
          type: "number",
          required: false,
          default: 3,
        },
        maxSteps: {
          name: "Max steps",
          description: "Maximum number of steps to generate",
          type: "number",
          required: false,
          default: 5,
        },
        maxTokens: {
          name: "Max tokens",
          description: "Maximum number of tokens to generate",
          type: "number",
          required: false,
        },
        temperature: {
          name: "Temperature",
          description: "Controls randomness in generation (0.0-2.0)",
          type: "number",
          required: false,
          default: 0,
        },
        tools: {
          name: "Tools",
          description: "Array of tool blocks to use",
          type: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Name of the tool",
                },
                description: {
                  type: "string",
                  description: "Description of the tool",
                },
                schema: {
                  type: "object",
                  description: "Schema of the tool",
                },
                url: {
                  type: "string",
                  description: "HTTP endpoint URL for the tool",
                },
              },
              required: ["name", "description", "schema", "url"],
            },
          },
          required: false,
          default: [],
        },
      },
      async onEvent({ app, event }) {
        const { apiKey } = app.config;
        const secretKey = app.signals.toolSecuritySecret;

        if (!secretKey) {
          throw new Error(
            "Tool security secret not available. App may not be synchronized properly.",
          );
        }
        const {
          model,
          schema,
          messages,
          prompt,
          system,
          maxSteps,
          maxRetries,
          maxTokens,
          temperature,
          tools,
        } = event.inputConfig;

        const openrouter = createOpenRouter({
          apiKey,
          compatibility: "strict",
        });

        const pendingEventId = await events.createPending({
          statusDescription: "Working...",
        });

        try {
          const promptOrMessages: any = {};
          if (prompt) {
            promptOrMessages.prompt = prompt;
          } else if (messages) {
            promptOrMessages.messages = messages || [];
          } else {
            throw new Error("Either 'prompt' or 'messages' must be provided.");
          }

          const tooling = createToolsFromConfig(
            tools,
            event.id,
            pendingEventId,
            secretKey,
          );

          const { text, usage } = await generateText({
            ...promptOrMessages,
            model: openrouter(model),
            maxSteps,
            maxRetries,
            maxTokens,
            temperature,
            system,
            tools: tooling,
            toolChoice: "auto",
          });

          const output: Record<string, any> = {};

          if (schema) {
            await events.updatePending(pendingEventId, {
              statusDescription: "Generating object...",
            });

            // Use generateObject to structure the text response according to schema
            const { object, usage: objectUsage } = await generateObject({
              model: openrouter(model),
              prompt: text,
              schema: jsonSchema(schema),
            });

            output.object = object;

            // Combine usage from both calls
            usage.promptTokens += objectUsage.promptTokens;
            usage.completionTokens += objectUsage.completionTokens;
            usage.totalTokens += objectUsage.totalTokens;
          } else {
            output.text = text;
          }

          await events.emit(
            { ...output, model, usage },
            { complete: pendingEventId },
          );
        } catch (error: any) {
          let errorMessage = error.message || "Unknown error";

          // Extract responseBody if available and parse it cleanly
          if (error.responseBody) {
            try {
              const responseData = JSON.parse(error.responseBody);
              errorMessage = `${errorMessage}\n\nOpenRouter Error: ${JSON.stringify(responseData, null, 2)}`;
            } catch {
              // If parsing fails, show raw responseBody
              errorMessage = `${errorMessage}\n\nOpenRouter Response: ${error.responseBody}`;
            }
          }

          events.cancelPending(pendingEventId, `Error: ${errorMessage}`);
          throw new Error(errorMessage);
        }
      },
    },
  },
  outputs: {
    default: {
      description: "The generated object and usage statistics",
      default: true,
      possiblePrimaryParents: ["default"],
      type: {
        type: "object",
        properties: {
          object: {
            type: "object",
            additionalProperties: true,
          },
          text: { type: "string" },
          model: { type: "string" },
          usage: {
            type: "object",
            properties: {
              promptTokens: { type: "number" },
              completionTokens: { type: "number" },
              totalTokens: { type: "number" },
            },
            required: ["promptTokens", "completionTokens", "totalTokens"],
          },
        },
        required: ["model", "usage"],
      },
    },
  },
};

function createToolsFromConfig(
  tools: any[],
  eventId: string,
  pendingEventId: string,
  secretKey: string,
) {
  return Object.fromEntries(
    tools.map((t: any) => [
      t.slug,
      tool({
        description: t.description,
        parameters: jsonSchema(t.schema),
        execute: async (parameters) => {
          return await withRetry(
            async () => {
              const body = JSON.stringify({ parameters, eventId });
              const timestamp = Math.floor(Date.now() / 1000);
              const flowSecret = generateFlowSecret(t.blockId, secretKey);
              const signature = signRequest(body, timestamp, flowSecret);

              const response = await fetch(t.url, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  [SECURITY_HEADERS.EVENT_ID]: eventId,
                  [SECURITY_HEADERS.TIMESTAMP]: timestamp.toString(),
                  [SECURITY_HEADERS.SIGNATURE]: signature,
                },
                body,
              });

              if (!response.ok) {
                throw new Error(
                  `HTTP ${response.status}: ${response.statusText}`,
                );
              }

              const { result } = await response.json();
              return JSON.stringify(result);
            },
            {
              pendingEventId,
              operationName: `Calling tool "${t.name}"`,
            },
          );
        },
      }),
    ]),
  );
}
