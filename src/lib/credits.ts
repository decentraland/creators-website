// credits-server client (shop credits, USD-denominated: 1 credit = 10 US cents). Requests are
// ADR-44 signed through the lib/auth chokepoint.
import { config } from '~/config'
import { signedFetch } from '~/lib/auth'

export type CreditsBalance = {
  credits: number
  balanceCents: number
}

/** The CreditsManager `ExternalCall` struct, as the server co-signs it. */
export type ExternalCall = {
  target: string
  selector: string
  data: string
  /** Unix seconds; the server schema rejects a string here. */
  expiresAt: number
  salt: string
}

export type PublicationAuthorization = {
  credit: {
    id: string
    amount: string
    expiresAt: string
    signature: string
  }
  externalCallSignature: string
}

export type CreditsServerErrorCode = 'insufficient_credits' | 'generic'

export class CreditsServerError extends Error {
  status: number
  code: CreditsServerErrorCode

  constructor(message: string, status: number) {
    super(message)
    this.name = 'CreditsServerError'
    this.status = status
    this.code = status === 402 ? 'insufficient_credits' : 'generic'
  }
}

const baseUrl = () => config.get('CREDITS_SERVER_URL')

async function parseError(response: Response, fallback: string): Promise<CreditsServerError> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return new CreditsServerError(body?.error ?? `${fallback} (${response.status})`, response.status)
}

/** The creator's shop-credit balance: GET /users/{address}/credits (the `usd` block). */
export async function fetchCreditsBalance(address: string): Promise<CreditsBalance> {
  const response = await signedFetch(address, baseUrl(), `/users/${address}/credits`)
  if (!response.ok) throw await parseError(response, 'credits-server request failed')
  const data = (await response.json()) as { usd?: { balanceCents: number; credits: number } }
  return { credits: data.usd?.credits ?? 0, balanceCents: data.usd?.balanceCents ?? 0 }
}

export type AuthorizePublicationParams = {
  usdPriceCents: number
  chainId: number
  creditsManagerAddress: string
  externalCall: ExternalCall
}

/**
 * Pays a publication fee with shop credits: POST /credits/authorize-publication. The server
 * reserves the USD amount and answers a signed ephemeral MANA credit plus the co-signed external
 * call, both consumed by a single CreditsManager.useCredits transaction. 402 = not enough credits.
 */
export async function authorizePublication(
  address: string,
  params: AuthorizePublicationParams
): Promise<PublicationAuthorization> {
  const response = await signedFetch(address, baseUrl(), '/credits/authorize-publication', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  })
  if (!response.ok) throw await parseError(response, 'Failed to authorize the publication')
  const data = (await response.json()) as Partial<PublicationAuthorization>
  const credit = data.credit
  if (!credit?.id || !credit.amount || !credit.expiresAt || !credit.signature || !data.externalCallSignature) {
    throw new CreditsServerError('credits-server answered an incomplete authorization', response.status)
  }
  return { credit, externalCallSignature: data.externalCallSignature }
}
