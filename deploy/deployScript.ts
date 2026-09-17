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
 * The CLI also reads `receipt.data.contract_address` on hosted chains, so the
 * order is: decoded transaction data first, then `data`, then the raw receipt.
 * Reading only the decoded field crashed the script *after* a successful
 * deploy -- the contract was live and the address was in the receipt the whole
 * time, but the script raised on it and the run looked like a failure.
 *
 * The fee preset is built, not implied. Studio Next has no on-chain FeeManager,
 * and the SDK resolves an absent `fees` argument to a deposit of zero rather
 * than deriving one -- which the chain rejects with `FeeValueMustBeNonZero(1)`
 * before the deploy runs. `estimateTransactionFees` reads the live fee policy
 * and derives the deposit from it without simulating anything, which matters
 * here: a simulated deploy would execute `__init__` against a simulation clock
 * that is not the block clock.
 *
 * Types are declared structurally rather than imported from genlayer-js: the
 * CLI resolves the SDK from its own installation, and this file has no
 * runtime dependency of its own to resolve.
 */

import { readFileSync } from "fs";
import path from "path";

const CONTRACT_PATH = "contracts/westphalia.py";

// The consensus round is slow by design: a deploy waits for the transaction to
// be decided, not merely submitted.
const RETRIES = 200;

interface DeployReceipt {
  status?: number | string;
  statusName?: string;
  data?: { contract_address?: string };
  txDataDecoded?: { contractAddress?: string };
}

/**
 * The SDK's policy-derived fee preset. `feeValue` is the deposit the chain
 * charges up front; `distribution` is how it is allocated across the round.
 * Carried opaquely -- this script never inspects or recomputes either.
 */
interface TransactionFees {
  distribution: Record<string, unknown>;
  messageAllocations?: unknown;
  feeValue: bigint;
}

interface DeployClient {
  initializeConsensusSmartContract(): Promise<void>;
  estimateTransactionFees(input: Record<string, never>): Promise<TransactionFees>;
  deployContract(input: {
    code: Uint8Array;
    args: unknown[];
    fees?: TransactionFees;
  }): Promise<string>;
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

function contractAddressFrom(receipt: DeployReceipt): string | undefined {
  // Decoded transaction data is the shape hosted networks return and the
  // simulator does not.
  const decoded = receipt.txDataDecoded?.contractAddress;
  if (decoded) return decoded;

  // `data` is where the simulator puts it, and where this CLI puts it on hosted
  // networks too. Checked for both chain types, because the deploy itself has
  // already succeeded by this point: a missed field here reports a failure for
  // a deploy that worked.
  const fromData = receipt.data?.contract_address;
  if (fromData) return fromData;

  // Last resort, so a future receipt shape is reported rather than silently
  // swallowed as "no address".
  const raw = receipt as unknown as Record<string, unknown>;
  const direct = raw.contractAddress ?? raw.contract_address;
  return typeof direct === "string" ? direct : undefined;
}

export default async function main(client: DeployClient): Promise<string> {
  const filePath = path.resolve(process.cwd(), CONTRACT_PATH);
  const code = new Uint8Array(readFileSync(filePath));

  // Registers the consensus contract's address and ABI on the client. Without
  // it the deploy has nowhere to be sent.
  await client.initializeConsensusSmartContract();

  // Studio Next has no fee manager, so the deposit must come from the chain's
  // live fee policy. Passing no `fees` resolves the deposit to zero and the
  // chain rejects the deploy with FeeValueMustBeNonZero(1).
  const fees = await client.estimateTransactionFees({});

  const hash = await client.deployContract({ code, args: [], fees });
  const receipt = await client.waitForTransactionReceipt({
    hash,
    waitUntil: "decided",
    retries: RETRIES,
  });

  if (!isSuccessfulDeploymentReceipt(receipt)) {
    throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
  }

  const address = contractAddressFrom(receipt);
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
