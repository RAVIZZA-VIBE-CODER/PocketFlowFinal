import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';

export default defineConfig(() => {
  const previewHost = process.env.VITE_PREVIEW_HOST || 'localhost';
  const forceLanRedirect = process.env.VITE_FORCE_LAN_REDIRECT === '1';
  return {
    base: './',
    plugins: [
      wasm(),
      topLevelAwait(),
      {
        name: 'pocketflow-newsflow-feed-proxy',
        configureServer(server) {
          const isPrivateOrLocalHost = (hostname: string) => {
            const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
            if (
              normalized === 'localhost' ||
              normalized.endsWith('.localhost') ||
              normalized === '127.0.0.1' ||
              normalized === '0.0.0.0' ||
              normalized === '::1' ||
              normalized === 'metadata.google.internal' ||
              normalized.endsWith('.local')
            ) return true;
            const ipv4 = normalized.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
            if (!ipv4) return false;
            const octets = ipv4.slice(1).map(Number);
            const [a, b] = octets;
            return (
              a === 10 ||
              a === 127 ||
              a === 169 && b === 254 ||
              a === 172 && b >= 16 && b <= 31 ||
              a === 192 && b === 168
            );
          };

          const fetchViaProxy = async (url: string, timeoutMs = 12000) => {
            const parsed = new URL(url);
            const allowedHosts = new Set(['www.viaggiatreno.it', 'viaggiatreno.it']);
            if (!/^https?:$/i.test(parsed.protocol) || !allowedHosts.has(parsed.hostname)) {
              throw new Error('Host not allowed');
            }
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
              const upstream = await fetch(parsed.toString(), {
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                  accept: 'application/json,text/plain,*/*;q=0.7',
                  'user-agent': 'PocketFlow-Baloss/1.0 (+https://example.com)',
                },
              });
              const text = await upstream.text();
              if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
              return {
                status: upstream.status,
                contentType: upstream.headers.get('content-type') || '',
                text,
              };
            } finally {
              clearTimeout(timer);
            }
          };

          server.middlewares.use('/api/baloss/fetch', async (req, res) => {
            const requestUrl = new URL(req.url || '', 'http://pocketflow.local');
            const targetUrl = requestUrl.searchParams.get('url') || '';
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            if (!/^https?:\/\//i.test(targetUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Missing valid url' }));
              return;
            }

            try {
              const payload = await fetchViaProxy(targetUrl);
              res.end(JSON.stringify({ ok: true, url: targetUrl, ...payload }));
            } catch (error) {
              res.statusCode = 502;
              res.end(JSON.stringify({
                ok: false,
                url: targetUrl,
                error: error instanceof Error ? error.message : String(error),
              }));
            }
          });

          server.middlewares.use('/api/newsflow/rss', async (req, res) => {
            const requestUrl = new URL(req.url || '', 'http://pocketflow.local');
            const feedUrl = requestUrl.searchParams.get('url') || '';
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');

            if (!/^https?:\/\//i.test(feedUrl)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: 'Missing valid feed url' }));
              return;
            }

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 22000);
            try {
              const upstream = await fetch(feedUrl, {
                redirect: 'follow',
                signal: controller.signal,
                headers: {
                  accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.7,*/*;q=0.5',
                  'user-agent': 'PocketFlow-NewsFlow/1.0 (+https://example.com)',
                },
              });
              const text = await upstream.text();
              if (!upstream.ok) throw new Error(`HTTP ${upstream.status}`);
              res.end(JSON.stringify({
                ok: true,
                status: upstream.status,
                contentType: upstream.headers.get('content-type') || '',
                url: feedUrl,
                text: text.slice(0, 2_000_000),
              }));
            } catch (error) {
              res.statusCode = 502;
              res.end(JSON.stringify({
                ok: false,
                url: feedUrl,
                error: error instanceof Error ? error.message : String(error),
              }));
            } finally {
              clearTimeout(timer);
            }
          });
        },
      },
      {
        name: 'pocketflow-preview-host-redirect',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const host = req.headers.host || '';
            if (forceLanRedirect && (host.startsWith('127.0.0.1:3000') || host.startsWith('localhost:3000'))) {
              res.statusCode = 302;
              res.setHeader('Location', `http://${previewHost}:3000${req.url || '/'}`);
              res.end();
              return;
            }
            next();
          });
        },
      },
      react({ fastRefresh: false } as Parameters<typeof react>[0] & { fastRefresh: boolean }),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Disable Fast Refresh for this local preview; the bundled React runtime
      // fails in the in-app browser before the app can mount.
      hmr: false,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('@noble/hashes') ||
              id.includes('bs58') ||
              id.includes('base-x') ||
              id.includes('bech32') ||
              id.includes('wif')
            ) {
              return 'vendor-crypto-encoding';
            }
            if (id.includes('tiny-secp256k1')) return 'vendor-crypto-secp';
            if (id.includes('bip39')) return 'vendor-crypto-mnemonic';
            if (id.includes('bitcoinjs-lib')) return 'vendor-crypto-core';
            if (id.includes('bip32') || id.includes('ecpair') || id.includes('ed25519-hd-key') || id.includes('@noble/curves') || id.includes('@noble/ed25519')) {
              return 'vendor-crypto-core';
            }
            if (id.includes('@solana/web3.js') || id.includes('rpc-websockets')) return 'vendor-solana';
            if (id.includes('ethers')) return 'vendor-ethers';
            if (id.includes('qrcode')) return 'vendor-qrcode';
            if (id.includes('jszip')) return 'vendor-zip';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('scheduler')) return 'vendor-react';
            return undefined;
          },
        },
      },
      chunkSizeWarningLimit: 550,
    },
  };
});
