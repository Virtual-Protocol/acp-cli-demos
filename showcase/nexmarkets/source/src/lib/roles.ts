import { env } from "./env";

export function isDisputeResolver(user: { wallets: Array<{ address: string }> }) {
  return Boolean(env.disputeResolverAddress && user.wallets.some((wallet) => wallet.address.toLowerCase() === env.disputeResolverAddress));
}

export function isProductionOperator(user: { wallets: Array<{ address: string }> }) {
  return Boolean(env.productionOperatorAddress && user.wallets.some((wallet) => wallet.address.toLowerCase() === env.productionOperatorAddress));
}
