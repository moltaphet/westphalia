"use client";

import { useEffect, useState } from "react";
import type { NetworkConfig } from "./types";
import { genlayerChain, type GenLayerChain } from "./networks";
import type { TransactionKit } from "@genlayer/transaction-kit";

// The injected wallet, as EIP-1193. The kit routes every signing call to it, so
// the key stays inside the extension and never enters this bundle.
interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

// The kit factory's own option type, read off the package rather than
// re-declared here, so a version bump that changes the shape is a compile error
// instead of a runtime surprise.
type KitOptions = Parameters<
  typeof import("@genlayer/transaction-kit")["createTransactionKit"]
>[0];

export interface KitBinding {
  kit: TransactionKit | null;
  // Set when no kit could be built. The caller decides whether that is a hard
  // error or simply "there is no wallet behind this session".
  error: string | null;
}

// Read the wallet's account without prompting when this origin is already
// authorized. `eth_accounts` never opens the extension; only a wallet that has
// not yet granted an account falls through to the request call, which does.
async function currentAccount(provider: Eip1193Provider): Promise<string | null> {
  const existing = (await provider.request({ method: "eth_accounts" })) as
    | string[]
    | undefined;
  if (existing?.[0]) return existing[0];
  const requested = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[] | undefined;
  return requested?.[0] ?? null;
}

/**
 * Build a Transaction Kit bound to the injected wallet, for as long as `active`
 * is true.
 *
 * The kit is loaded lazily rather than imported at module scope. Its core
 * reaches `ethers` and `genlayer-js` on the first line of the bundle, and this
 * module is part of the server-rendered tree -- a static import would pull
 * browser-only wallet code into the build and the server render. lib/contract.ts
 * keeps genlayer-js behind the same discipline, for the same reason.
 *
 * (The React adapter is different: it imports only `react`, so components may
 * import it directly.)
 */
export function useTransactionKit(
  network: NetworkConfig,
  active: boolean
): KitBinding {
  const [binding, setBinding] = useState<KitBinding>({ kit: null, error: null });

  useEffect(() => {
    if (!active || typeof window === "undefined") {
      setBinding({ kit: null, error: null });
      return;
    }
    let live = true;
    void (async () => {
      try {
        const provider = (window as unknown as { ethereum?: Eip1193Provider })
          .ethereum;
        if (!provider) {
          if (live) {
            setBinding({ kit: null, error: "No injected wallet detected." });
          }
          return;
        }
        const [kitModule, sdk] = await Promise.all([
          import("@genlayer/transaction-kit"),
          import("genlayer-js") as Promise<Record<string, unknown>>,
        ]);
        const chain = genlayerChain(
          network,
          sdk.chains as Record<string, GenLayerChain> | undefined
        );
        if (!chain) {
          if (live) {
            setBinding({
              kit: null,
              error: `genlayer-js ships no chain definition for ${network.label}.`,
            });
          }
          return;
        }
        const account = await currentAccount(provider);
        if (!account) {
          if (live) {
            setBinding({ kit: null, error: "The wallet returned no account." });
          }
          return;
        }
        // genlayerChain() spreads the SDK's own chain object and overrides only
        // the RPC endpoint, so at runtime this is the SDK's chain. The local
        // GenLayerChain interface is a narrower view of it than the SDK
        // enumerates, hence the cast -- the extra consensus fields the kit needs
        // are carried through untouched by the spread.
        const kit = kitModule.createTransactionKit({
          chain: chain as unknown as KitOptions["chain"],
          provider,
          account: account as `0x${string}`,
        });
        if (live) setBinding({ kit, error: null });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (live) setBinding({ kit: null, error: message });
      }
    })();
    return () => {
      live = false;
    };
  }, [network, active]);

  return binding;
}
