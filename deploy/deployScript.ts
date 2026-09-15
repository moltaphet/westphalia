/**
 * Deployment script for contracts/westphalia.py.
 *
 * `genlayer deploy` runs this file with a client already bound to whichever
 * network `genlayer network` selected, so this script never builds a chain
 * object or holds a key. It is the scripted form of the manual deploy in
 * README.md section 7.
 *
 * Two receipt shapes matter. On the local simulator (`genlayer up`) the
 * contract address lands on `receipt.data`; on a hosted network it is carried
 * in the decoded transaction data instead. Both are read below rather than
 * assuming one, because assuming the hosted shape silently yields `undefined`
 * on the simulator.
 *
 * Types are declared structurally rather than imported from genlayer-js: the
 * CLI resolves the SDK from its own installation, and this file has no
 * runtime dependency of its own to resolve.
 */

import { readFileSync } from "fs";
import path from "path";

const CONTRACT_PATH = "contracts/westphalia.py";

// The GenLayer local simulator's chain id. Inlined instead of imported from
// genlayer-js/chains so this script stays dependency-free.
const LOCALNET_CHAIN_ID = 61127;

// The consensus round is slow by design: a deploy waits for the transaction to
// be decided, not merely submitted.
const RETRIES = 200;

interface DeployReceipt {
  status?: number | string;
  statusName?: string;
  data?: { contract_address?: string };
  txDataDecoded?: { contractAddress?: string };
}

interface DeployClient {
  chain: { id: number };
  initializeConsensusSmartContract(): Promise<void>;
  deployContract(input: { code: Uint8Array; args: unknown[] }): Promise<string>;
  waitForTransactionReceipt(input: {
    hash: string;
    waitUntil: "decided" | "finalized";
    retries: number;
  }): Promise<DeployReceipt>;
}

/**
 * A decided deploy is not automatically a successful one -- a contract whose
 * `__init__` reverts still produces a decided transaction. Status 5 and 7 are
 * the accepted/finalized protocol codes; the named forms cover chains that
 * report the lifecycle name instead of the number.
 */
function isSuccessfulDeploymentReceipt(receipt: DeployReceipt): boolean {
  const numericStatus = Number(receipt.status);
  return (
    numericStatus === 5 ||
    numericStatus === 7 ||
    receipt.statusName === "ACCEPTED" ||
    receipt.statusName === "FINALIZED"
  );
}

function contractAddressFrom(receipt: DeployReceipt, chainId: number): string | undefined {
  return chainId === LOCALNET_CHAIN_ID
    ? receipt.data?.contract_address
    : receipt.txDataDecoded?.contractAddress;
}

export default async function main(client: DeployClient): Promise<string> {
  const filePath = path.resolve(process.cwd(), CONTRACT_PATH);
  const code = new Uint8Array(readFileSync(filePath));

  // Registers the consensus contract's address and ABI on the client. Without
  // it the deploy has nowhere to be sent.
  await client.initializeConsensusSmartContract();

  const hash = await client.deployContract({ code, args: [] });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    retries: RETRIES,
  });

  if (!isSuccessfulDeploymentReceipt(receipt)) {
    throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
  }

  const address = contractAddressFrom(receipt, client.chain.id);
  if (!address) {
    throw new Error(
      `Deployment receipt carried no contract address. Receipt: ${JSON.stringify(receipt)}`,
    );
  }

  console.log(`Westphalia deployed at ${address}`);
  console.log("Next steps:");
  console.log(`  1. Set NEXT_PUBLIC_DIPLOMATIC_CONTRACT_ADDRESS=${address} in frontend/.env.local`);
  console.log("  2. Point CONTRACT in agent/chain.py at the same address");
  console.log("  3. Record the deployment in deployments/studio-dev.json");
  return address;
}
