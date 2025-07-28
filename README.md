# OpenRouter Flows App

A Flows app that provides text generation capabilities using OpenRouter's API, which gives access to various AI models including OpenAI, Anthropic, Google, and more.

## Features

- **Text Generation**: Generate text using any OpenRouter-supported model
- **Structured Output**: Generate JSON objects matching a provided schema
- **Custom Tools**: Define custom tools that can be called by generation blocks
- **Security**: Built-in request security with HMAC signatures
- **Retry Logic**: Automatic retry on transient failures

## Quick Start

1. **Install the app** in your Flows workspace
2. **Configure your API key**:
   - Sign up for an OpenRouter [https://openrouter.ai/](https://openrouter.ai/) account
   - Generate an API key from your dashboard
   - Enter your API key in the app configuration
3. **Start using the blocks** in your flows

## Blocks

### Generate Block

Generates text or structured data using OpenRouter models.

**Inputs:**

- **Model**: The OpenRouter model to use (e.g., `openai/gpt-4`, `anthropic/claude-3-sonnet`)
- **Schema** (optional): JSON schema for structured output generation
- **Messages** (optional): Array of conversation messages for context
- **Prompt** (optional): Simple text prompt (mutually exclusive with messages)
- **System Message** (optional): System instruction for the model
- **Tools** (optional): Array of tool definitions for function calling
- **Max Tokens** (optional): Maximum tokens to generate
- **Temperature** (optional): Control randomness (0.0-2.0)
- **Top P** (optional): Nucleus sampling parameter
- **Stream** (optional): Enable streaming responses

**Outputs:**

- **Content**: Generated text or structured data
- **Usage**: Token usage information
- **Tool Calls** (optional): Any tool calls made by the model

### Tool Block

Defines a custom tool that can be called by generation blocks.

**Configuration:**

- **Name**: Tool name (auto-generated from block name)
- **Description**: What the tool does
- **Parameters**: JSON schema defining tool parameters
- **Implementation**: JavaScript code that executes when the tool is called

**Security**: All tool calls are secured with HMAC signatures to prevent unauthorized access.

## Configuration

The app requires one configuration value:

- **OpenRouter API Key** (required, sensitive): Your API key from OpenRouter

The app automatically generates a security secret for tool communications during setup.

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Available Scripts

```bash
npm run typecheck    # Type checking
npm run format       # Code formatting
npm run bundle       # Create deployment bundle
```

### Project Structure

```text
├── main.ts                    # App definition and configuration
├── blocks/
│   ├── generate.ts           # Text generation block
│   └── tool.ts               # Custom tool definition block
├── lib/
│   ├── headers.ts            # Security header constants
│   ├── retry.ts              # Retry utility functions
│   └── security.ts           # Security utilities (HMAC, etc.)
├── package.json              # Dependencies and scripts
└── tsconfig.json            # TypeScript configuration
```

## Usage Examples

### Simple Text Generation

Use the Generate block with:

- Model: `openai/gpt-4`
- Prompt: "Write a short story about a robot learning to paint."

### Structured Data Generation

Use the Generate block with:

- Model: `anthropic/claude-3-sonnet`
- Schema:

  ```json
  {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "age": { "type": "number" },
      "skills": { "type": "array", "items": { "type": "string" } }
    }
  }
  ```

- Prompt: "Generate a character profile for a fantasy RPG."

### Using Custom Tools

1. Create a Tool block with:
   - Name: "Weather Lookup"
   - Description: "Get current weather for a city"
   - Parameters: `{"type": "object", "properties": {"city": {"type": "string"}}}`
   - Implementation: Your weather API logic

2. Use the Generate block with:
   - Model: `openai/gpt-4`
   - Tools: Reference your tool block
   - Prompt: "What's the weather like in San Francisco?"

## Supported Models

The app supports 400+ models available through OpenRouter. Visit the [OpenRouter models page](https://openrouter.ai/models) for the complete up-to-date list of available models from providers like OpenAI, Anthropic, Google, Meta, Amazon, Mistral, and many others.

## Security

- API keys are stored securely and marked as sensitive
- Tool communications use HMAC signatures for authentication
- Request timestamps prevent replay attacks
- All sensitive data is properly handled and not logged

## Error Handling

The app includes comprehensive error handling:

- API errors are caught and returned with descriptive messages
- Network issues trigger automatic retries with exponential backoff
- Invalid configurations are validated during app setup
- Tool security violations are blocked and logged

## Troubleshooting

### Invalid API key

- Verify your OpenRouter API key is correct
- Check that your OpenRouter account has sufficient credits

### Tool calls failing

- Ensure tool security is properly configured
- Check that tool parameters match the defined schema
- Verify the tool implementation code is valid

### Generation timeouts

- Try reducing max_tokens parameter
- Consider using a faster model for real-time applications
- Check OpenRouter service status

## License

This app is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
