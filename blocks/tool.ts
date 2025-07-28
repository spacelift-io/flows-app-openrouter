import slugify from "slugify";
import { AppBlock, events, http } from "@slflows/sdk/v1";
import { createHmac } from "crypto";
import { generateFlowSecret } from "../lib/security";
import { SECURITY_HEADERS } from "../lib/headers";

export const tool: AppBlock = {
  name: "Tool",
  description:
    "Define a custom tool that can be called by text generation blocks",

  http: {
    onRequest: async ({
      app,
      block,
      request: { body, requestId, headers, rawBody },
    }) => {
      // Get the app's security secret
      const secretKey = app.signals.toolSecuritySecret;
      if (!secretKey) {
        await http.respond(requestId, {
          statusCode: 500,
          body: { error: "App security secret not available" },
        });
        return;
      }

      // Extract security headers
      const eventId = headers[SECURITY_HEADERS.EVENT_ID];
      const timestamp = headers[SECURITY_HEADERS.TIMESTAMP];
      const signature = headers[SECURITY_HEADERS.SIGNATURE];

      // Validate required headers
      if (!eventId || !timestamp || !signature) {
        await http.respond(requestId, {
          statusCode: 401,
          body: { error: "Missing required security headers" },
        });
        return;
      }

      // Validate timestamp (within 5 minutes)
      const now = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp);
      if (Math.abs(now - requestTime) > 300) {
        await http.respond(requestId, {
          statusCode: 401,
          body: { error: "Request timestamp too old" },
        });
        return;
      }

      // Validate HMAC signature using own block ID
      const flowSecret = generateFlowSecret(block.id, secretKey);
      const expectedSignature = createHmac("sha256", flowSecret)
        .update(rawBody + timestamp)
        .digest("hex");

      if (signature !== expectedSignature) {
        await http.respond(requestId, {
          statusCode: 401,
          body: { error: "Invalid request signature" },
        });
        return;
      }

      // Process the validated request
      const { eventId: bodyEventId, parameters } = body;
      await events.emit(
        { requestId, parameters },
        { echo: true, secondaryParentEventIds: [bodyEventId] },
      );
    },
  },

  config: {
    schema: {
      name: "Schema",
      description: "JSON schema defining the parameters this tool accepts",
      type: {
        type: "object",
        properties: {
          type: { type: "string" },
          properties: { type: "object", additionalProperties: true },
          required: { type: "array", items: { type: "string" } },
        },
        additionalProperties: true,
      },
      default: {
        type: "object",
        properties: {
          example: {
            type: "string",
            description: "An example input for this tool",
          },
        },
        required: ["example"],
      },
      required: true,
    },
  },

  inputs: {
    processResult: {
      name: "Process result",
      description: "Send the result back to the tool caller",
      config: {
        result: {
          name: "Result",
          description: "The final result to return",
          type: "string",
          required: true,
        },
      },
      onEvent: async ({ event: { echo, inputConfig } }) => {
        if (!echo) {
          throw new Error("This block should not be called directly");
        }

        await http.respond(echo.body.requestId, {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: { result: inputConfig.result },
        });
      },
    },
  },

  outputs: {
    default: {
      type: {
        type: "object",
        properties: {
          parameters: {
            type: "object",
            additionalProperties: true,
            description: "Tool parameters",
          },
        },
        required: ["parameters"],
      },
    },
  },

  onSync: async ({ block }) => {
    const config = block.config;

    return {
      newStatus: "ready",
      signalUpdates: {
        definition: {
          slug: slugify(block.name, { lower: true, replacement: "_" }),
          name: block.name,
          description: block.description,
          schema: config.schema,
          url: block.http?.url,
          blockId: block.id,
        },
      },
    };
  },
};
