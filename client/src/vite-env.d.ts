/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_ENABLE_OFFLINE_MODE: string;
  readonly VITE_ENABLE_HISTORY: string;
  readonly VITE_CURSOR_THROTTLE_MS: string;
  readonly VITE_MAX_QUEUED_OPERATIONS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
