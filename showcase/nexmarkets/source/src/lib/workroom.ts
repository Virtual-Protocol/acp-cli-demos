import { keccak256, toBytes } from "viem";
import { serialize } from "./http";

export function workroomPayloadHash(value: unknown) {
  return keccak256(toBytes(JSON.stringify(serialize(value))));
}
