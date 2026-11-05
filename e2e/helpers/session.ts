import { Authenticator } from '@dcl/crypto'
import { ethers } from 'ethers'

// A deterministic, obviously fake key for the test wallet. Never a real account.
const USER_PK = '0x' + '11'.repeat(32)
export const TEST_ADDRESS = new ethers.Wallet(USER_PK).address.toLowerCase()
export const POLYGON_AMOY = 80002

// A structurally valid secp256k1 signature (low s, v = 27). The mocks never verify it.
const CANNED_SIG = '0x' + 'ab'.repeat(32) + '11'.repeat(32) + '1b'
export const FAKE_TX_HASH = '0x' + 'cd'.repeat(32)

export type TestSession = { address: string; identityJson: string }

let cached: Promise<TestSession> | undefined

/** A real AuthIdentity for the test wallet, so signed builder-server requests are well formed. */
export function testSession(): Promise<TestSession> {
  cached ??= (async () => {
    const user = new ethers.Wallet(USER_PK)
    const ephemeral = ethers.Wallet.createRandom()
    const identity = await Authenticator.initializeAuthChain(
      user.address,
      {
        address: ephemeral.address,
        publicKey: ethers.utils.hexlify(ephemeral.publicKey),
        privateKey: ethers.utils.hexlify(ephemeral.privateKey)
      },
      31 * 24 * 60,
      message => user.signMessage(message)
    )
    return { address: TEST_ADDRESS, identityJson: JSON.stringify(identity) }
  })()
  return cached
}

/**
 * Seeds what `lib/auth#restoreSession` reads (decentraland-connect's last connection and the SSO identity)
 * and installs a mock EIP-1193 provider, so the app restores a session through its production code path.
 */
export function sessionInitScript(session: TestSession, chainId: number): string {
  return `(() => {
    localStorage.setItem('decentraland-connect-storage-key', ${JSON.stringify(
      JSON.stringify({ providerType: 'injected', chainId })
    )});
    localStorage.setItem('single-sign-on-${session.address}', ${JSON.stringify(session.identityJson)});
    const ADDR = '${session.address}';
    const CHAIN = '0x${chainId.toString(16)}';
    const TX = '${FAKE_TX_HASH}';
    const receipt = hash => ({ status: '0x1', transactionHash: hash || TX, blockNumber: '0x1', blockHash: '0x' + '00'.repeat(32), transactionIndex: '0x0', from: ADDR, to: null, gasUsed: '0x5208', cumulativeGasUsed: '0x5208', contractAddress: null, logs: [], logsBloom: '0x' + '00'.repeat(256), type: '0x2', effectiveGasPrice: '0x1' });
    const handle = async (method, params) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts': return [ADDR];
        case 'eth_chainId': return CHAIN;
        case 'net_version': return String(parseInt(CHAIN, 16));
        case 'eth_signTypedData_v4':
        case 'eth_signTypedData':
        case 'personal_sign':
        case 'eth_sign': return '${CANNED_SIG}';
        case 'eth_sendTransaction': return TX;
        case 'eth_getTransactionByHash': return { hash: (params && params[0]) || TX, from: ADDR, to: null, blockNumber: '0x1', blockHash: '0x' + '00'.repeat(32), transactionIndex: '0x0', nonce: '0x0', value: '0x0', gas: '0x5208', gasPrice: '0x1', input: '0x' };
        case 'eth_getTransactionReceipt': return receipt(params && params[0]);
        case 'eth_blockNumber': return '0x1';
        case 'eth_call': return '0x';
        case 'eth_estimateGas': return '0x5208';
        case 'eth_gasPrice': return '0x1';
        case 'wallet_switchEthereumChain':
        case 'wallet_addEthereumChain': return null;
        default: return null;
      }
    };
    const eth = {
      isMetaMask: true,
      chainId: CHAIN,
      request: ({ method, params }) => handle(method, params),
      enable: () => handle('eth_requestAccounts'),
      on: () => {}, removeListener: () => {}, removeAllListeners: () => {}
    };
    eth.send = (m, p) => (typeof m === 'string' ? handle(m, p) : handle(m.method, m.params));
    eth.sendAsync = (payload, cb) => handle(payload.method, payload.params)
      .then(result => cb(null, { id: payload.id, jsonrpc: '2.0', result }))
      .catch(err => cb(err));
    window.ethereum = eth;
  })()`
}

/**
 * Request interception can't see WebSockets, so the social RPC (friends) would reach the real service.
 * Off-origin sockets fail at once instead, the way an unreachable host does; Vite's own HMR socket is kept.
 */
export const OFFLINE_WEBSOCKET_SCRIPT = `(() => {
  const RealWebSocket = window.WebSocket;
  class OfflineWebSocket extends EventTarget {
    constructor(url) {
      super();
      this.url = String(url);
      this.readyState = 3;
      setTimeout(() => {
        const error = new Event('error');
        this.onerror && this.onerror(error);
        this.dispatchEvent(error);
        const close = new CloseEvent('close', { code: 1006 });
        this.onclose && this.onclose(close);
        this.dispatchEvent(close);
      }, 0);
    }
    send() {}
    close() {}
  }
  function E2EWebSocket(url, protocols) {
    return new URL(String(url), location.href).hostname === location.hostname
      ? new RealWebSocket(url, protocols)
      : new OfflineWebSocket(url);
  }
  Object.assign(E2EWebSocket, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
  E2EWebSocket.prototype = RealWebSocket.prototype;
  window.WebSocket = E2EWebSocket;
})()`
