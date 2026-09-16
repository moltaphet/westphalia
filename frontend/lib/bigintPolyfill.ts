// Global BigInt JSON serializer.
//
// JSON.stringify throws "Do not know how to serialize a BigInt" the instant it
// meets a bigint. The write path carries several: a treaty's `expires_at` and
// every treaty-id argument are u256 bigints, and a bond `value` is atto-scale
// bigint. Those reach JSON.stringify both in this app (contract.write hashes a
// seed over its args) and inside the wallet / transaction-kit / JSON-RPC layers
// when they serialize the request envelope.
//
// Teaching BigInt to serialize as its decimal string -- the lossless, canonical
// form a u256 field expects -- makes every one of those envelopes serializable
// without each call site pre-stringifying (which would also be wrong: the SDK's
// calldata encoder needs the real bigint, not a string, to encode a u256, and
// it reads the value directly rather than through JSON, so toJSON never touches
// that path).
//
// Imported for its side effect at the earliest entry points -- lib/contract.ts
// (the client module where writes originate, so it runs before any write) and
// app/layout.tsx (the server/root entry) -- so it is installed on both the
// client and the server before anything serializes a transaction.
if (typeof BigInt !== "undefined") {
  const proto = BigInt.prototype as unknown as { toJSON?: () => string };
  if (typeof proto.toJSON !== "function") {
    proto.toJSON = function (this: bigint): string {
      return this.toString();
    };
  }
}

export {};
