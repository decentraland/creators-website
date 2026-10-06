const ANONYMOUS_ID_KEY = 'ajs_anonymous_id'
const DOMAIN_PROBE_KEY = '__dcl_segment_domain__'
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
    const random = Math.floor(Math.random() * 16)
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16)
  })
}

function safeParseStoredId(value: string): string | undefined {
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' && parsed !== '' ? parsed : undefined
  } catch {
    return value || undefined
  }
}

function readCookie(key: string): string | undefined {
  try {
    const entry = document.cookie.split('; ').find(cookie => cookie.startsWith(`${key}=`))
    return entry ? safeParseStoredId(decodeURIComponent(entry.slice(key.length + 1))) : undefined
  } catch {
    return undefined
  }
}

function readLocalId(): string | undefined {
  try {
    const raw = localStorage.getItem(ANONYMOUS_ID_KEY)
    return raw ? safeParseStoredId(raw) : undefined
  } catch {
    return undefined
  }
}

// Like Analytics.js, probe from the shortest candidate to the full host. Browsers
// reject public suffixes such as vercel.app, so previews stay host-scoped.
function writableCookieDomain(): string | undefined {
  const host = window.location.hostname
  const parts = host.split('.')
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return undefined
  const token = generateUuid()
  for (let index = parts.length - 2; index >= 0; index--) {
    const domain = parts.slice(index).join('.')
    document.cookie = `${DOMAIN_PROBE_KEY}=${token}; domain=.${domain}; path=/; SameSite=Lax`
    if (readCookie(DOMAIN_PROBE_KEY) === token) {
      document.cookie = `${DOMAIN_PROBE_KEY}=; domain=.${domain}; path=/; max-age=0`
      return domain
    }
  }
  return undefined
}

function persist(id: string): boolean {
  let localPersisted = false
  let cookiePersisted = false
  // Each store can fail independently (privacy settings, sandboxed frames).
  try {
    localStorage.setItem(ANONYMOUS_ID_KEY, JSON.stringify(id))
    localPersisted = readLocalId() === id
  } catch {
    // A readable cookie still preserves identity when localStorage is blocked.
  }
  try {
    if (readCookie(ANONYMOUS_ID_KEY) === id) return true
    const domain = writableCookieDomain()
    const domainAttribute = domain ? `; domain=.${domain}` : ''
    document.cookie = `${ANONYMOUS_ID_KEY}=${encodeURIComponent(id)}; path=/; SameSite=Lax; expires=${new Date(Date.now() + ONE_YEAR_MS).toUTCString()}${domainAttribute}`
    cookiePersisted = readCookie(ANONYMOUS_ID_KEY) === id
  } catch {
    // localStorage or the in-page fallback still labels direct events.
  }
  return localPersisted || cookiePersisted
}

/** Matches Analytics.js >=1.84.3 without awaiting its buffered browser facade. */
function createAnonymousIdResolver(getSdkId: () => string | undefined) {
  let memoryId: string | undefined

  function read(): string | undefined {
    let sdkId: string | undefined
    try {
      sdkId = getSdkId()
    } catch {
      // An unavailable SDK must not prevent unload-safe direct events.
    }
    return sdkId || readCookie(ANONYMOUS_ID_KEY) || readLocalId()
  }

  function ensure(): string {
    const id = read() || memoryId || generateUuid()
    // Cache only when neither store works; do not resurrect an id deleted
    // from otherwise usable stores before the SDK has loaded.
    memoryId = persist(id) ? undefined : id
    return id
  }

  return { read, ensure }
}

export { createAnonymousIdResolver, generateUuid, safeParseStoredId }
