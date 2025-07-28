/**
 * Type Definitions for {{APP_NAME}}
 */

export interface AppConfig {
  apiKey: string;
  baseUrl: string;
}

export interface BlockOutput {
  success: boolean;
  message?: string;
  originalMessage?: string;
  error?: string;
}
