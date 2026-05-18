/**
 * Centralized service configuration for Copernicus.
 * All URL defaults are overridable via environment variables.
 */

export const config = {
  /** Flask backend API */
  backend: {
    url: process.env.COPERNICUS_BACKEND_URL ?? 'http://127.0.0.1:5001',
    port: parseInt(process.env.COPERNICUS_BACKEND_PORT ?? '5001', 10),
  },

  /** Ollama local inference server */
  ollama: {
    url: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434',
  },

  /** OpenTelemetry collector */
  otel: {
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
  },

  /** Vite dev server (development only) */
  vite: {
    devUrl: process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5173',
  },

  /** MLX local inference (Apple Silicon) */
  mlx: {
    url: process.env.MLX_PROVIDER_URL ?? 'http://localhost:8080/v1',
  },
} as const
