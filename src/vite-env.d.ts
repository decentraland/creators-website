/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DCL_DEFAULT_ENV?: string
  readonly VITE_BASE_URL?: string
  readonly VITE_REACT_APP_WEBSITE_VERSION?: string
  readonly VITE_FEATURE_FLAG_OVERRIDES?: string
}
