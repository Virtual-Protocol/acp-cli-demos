import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NexMarkets", (module) => {
  const admin = module.getParameter("admin");
  const operator = module.getParameter("operator");
  const resolver = module.getParameter("resolver");
  const treasury = module.getParameter("treasury");
  const usdc = module.getParameter("usdc");
  const nex = module.getParameter("nex");
  const platformFeeBps = module.getParameter("platformFeeBps", 250n);

  const registry = module.contract("NexPricingRegistry", [admin, admin]);
  module.call(registry, "configure", [
    usdc,
    nex,
    treasury,
    5_000_000n,
    4_000_000n,
    100_000n,
    50_000n * 10n ** 18n
  ]);

  const productionPayments = module.contract("NexProductionPayments", [
    admin,
    operator,
    registry
  ]);
  const workEscrow = module.contract("NexWorkEscrow", [
    admin,
    operator,
    resolver,
    usdc,
    treasury,
    platformFeeBps
  ]);

  return { registry, productionPayments, workEscrow };
});
