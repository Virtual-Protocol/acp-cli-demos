"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { useSendTransaction } from "wagmi";
import { formatDate, formatUsdcAtomic } from "@/components/product/format";
import type { ListingView } from "@/components/product/types";

type ChainCall = { to: string; data: string; value: string };
type FundingPreparation = {
  totalAtomic: string;
  usdcBalanceAtomic: string;
  sufficientBalance: boolean;
  chainId: number;
  places: number;
  calls: { approval: ChainCall; funding: ChainCall };
};
type ApplicationRecord = {
  id: string;
  response: string;
  deliveryPlan: string | null;
  availability: string | null;
  proposedFeeAtomic: string | null;
  status: string;
  createdAt: string;
  applicant: {
    id: string;
    displayName: string | null;
    handle: string | null;
    bio: string | null;
    location: string | null;
    wallets: Array<{ address: string }>;
    reputationProfiles: Array<{ publicSlug: string; evidence: Array<{ id: string; sourceType: string; excerpt: string | null }> }>;
  };
};

async function waitForReceipt(hash: string) {
  if (!window.ethereum) throw new Error("The wallet provider is unavailable.");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("The wallet transaction reverted.");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error("The transaction is still pending. Reopen this Listing after it confirms.");
}

export function ListingDetailPage({ slug }: { slug: string }) {
  const router = useRouter();
  const { data, loading: bootstrapLoading, error: bootstrapError, api, connectWallet, refresh, notify, walletConnected, setConnectWalletOpen } = useProduct();
  const { sendTransactionAsync } = useSendTransaction();
  const [item, setItem] = useState<ListingView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [response, setResponse] = useState("");
  const [deliveryPlan, setDeliveryPlan] = useState("");
  const [availability, setAvailability] = useState("");
  const [proposedFee, setProposedFee] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [funding, setFunding] = useState<FundingPreparation | null>(null);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItem(await api<ListingView>(`/api/v1/listings/${encodeURIComponent(slug)}`));
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Listing could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [api, slug]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const owned = Boolean(item && (data?.user?.id === item.ownerUserId || data?.ownedListings.some((listing) => listing.id === item.id)));
  const serviceOffer = item?.type === "Service" && item.detail.serviceOffer === true;
  const serviceRequest = item?.type === "Service" && item.detail.serviceRequest === true;
  const providerInvite = Boolean(serviceRequest && item?.invitedUserId && item.invitedUserId === data?.user?.id);
  const serviceRequestId = typeof item?.detail.serviceRequestId === "string" ? item.detail.serviceRequestId : null;

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!item || !owned || serviceOffer) {
        setApplications([]);
        return;
      }
      void api<{ items: ApplicationRecord[] }>(`/api/v1/listings/${item.id}/applications`)
        .then((result) => { if (!cancelled) setApplications(result.items); })
        .catch(() => { if (!cancelled) setApplications([]); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [api, item, owned, serviceOffer]);

  if (bootstrapLoading || bootstrapError || !data) return <LoadState label="Loading the Listing" />;
  if (loading) return <section className="empty-state"><div><span className="empty-mark"><Icon name="refresh" /></span><h2>Loading Listing</h2><p>Reading the published record.</p></div></section>;
  if (error || !item) return <section className="empty-state"><div><span className="empty-mark"><Icon name="close" /></span><h2>Listing unavailable.</h2><p>{error}</p><button className="btn primary" onClick={() => router.push("/marketplace")}>Return to Marketplace</button></div></section>;

  const ensureAccount = async () => {
    if (!data.authenticated) await connectWallet();
  };

  const submitResponse = async () => {
    setSubmitting(true);
    try {
      await ensureAccount();
      if (serviceOffer) {
        const requested = await api<ListingView>(`/api/v1/services/${item.id}/requests`, {
          method: "POST",
          headers: { "idempotency-key": crypto.randomUUID() },
          body: JSON.stringify({ message: response, inputs: deliveryPlan.split(/\n+/).map((value) => value.trim()).filter(Boolean) }),
        });
        await refresh();
        setApplyOpen(false);
        router.push(`/marketplace/${requested.slug}`);
        notify("Service request saved", "Secure the fixed amount from the private request before the provider decides it.");
        return;
      }
      if (providerInvite && serviceRequestId) {
        await api(`/api/v1/service-requests/${serviceRequestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "accept", note: response || undefined }) });
        await Promise.all([load(), refresh()]);
        setApplyOpen(false);
        notify("Service request accepted", "The buyer can now allocate the secured amount into your Workroom.");
        return;
      }
      const atomic = proposedFee.trim() ? BigInt(Math.round(Number(proposedFee) * 1_000_000)).toString() : undefined;
      await api(`/api/v1/listings/${item.id}/applications`, {
        method: "POST",
        body: JSON.stringify({ response, deliveryPlan: deliveryPlan || undefined, availability: availability || undefined, proposedFeeAtomic: atomic, evidenceIds: (data.reputation?.evidence || []).map((evidence) => evidence.id).filter((id): id is string => typeof id === "string") }),
      });
      await refresh();
      setApplyOpen(false);
      notify("Application submitted", "The persisted application now appears in My work.");
    } catch (reason) {
      notify(serviceOffer ? "Service request not saved" : "Response not submitted", reason instanceof Error ? reason.message : "Review the response and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const declineServiceRequest = async () => {
    if (!serviceRequestId) return;
    const note = window.prompt("Why are you declining this request? The buyer will see this reason.");
    if (!note?.trim()) return;
    setSubmitting(true);
    try {
      await api(`/api/v1/service-requests/${serviceRequestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "decline", note }) });
      await refresh();
      router.push("/marketplace?tab=my-work");
      notify("Service request declined", "The buyer was notified and can refund the secured request amount.");
    } catch (reason) {
      notify("Request was not declined", reason instanceof Error ? reason.message : "The decision could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const setServiceAvailability = async (status: "OPEN" | "PAUSED") => {
    setSubmitting(true);
    try {
      await api(`/api/v1/listings/${encodeURIComponent(item.slug)}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await Promise.all([load(), refresh()]);
      notify(status === "OPEN" ? "Service available" : "Service paused", status === "OPEN" ? "Buyers can request this fixed offer again." : "New requests are paused; existing Workrooms are unchanged.");
    } catch (reason) {
      notify("Service availability unchanged", reason instanceof Error ? reason.message : "The offer could not be updated.");
    } finally {
      setSubmitting(false);
    }
  };

  const prepareFunding = async () => {
    setSubmitting(true);
    try {
      if (!data.wallet.address) await connectWallet();
      setFunding(await api<FundingPreparation>(`/api/v1/listings/${item.id}/funding`, { method: "POST", body: JSON.stringify({ mode: "prepare" }) }));
    } catch (reason) {
      notify("Funding unavailable", reason instanceof Error ? reason.message : "The Listing reserve could not be prepared.");
    } finally {
      setSubmitting(false);
    }
  };

  const fundListing = async () => {
    if (!walletConnected) {
      setConnectWalletOpen(true);
      return;
    }
    if (!funding) return;
    setSubmitting(true);
    try {
      const approvalHash = await sendTransactionAsync({
        to: funding.calls.approval.to as `0x${string}`,
        data: funding.calls.approval.data as `0x${string}`,
        value: funding.calls.approval.value ? BigInt(funding.calls.approval.value) : undefined
      });
      await waitForReceipt(approvalHash);
      const fundingHash = await sendTransactionAsync({
        to: funding.calls.funding.to as `0x${string}`,
        data: funding.calls.funding.data as `0x${string}`,
        value: funding.calls.funding.value ? BigInt(funding.calls.funding.value) : undefined
      });
      await waitForReceipt(fundingHash);
      await api(`/api/v1/listings/${item.id}/funding`, { method: "POST", body: JSON.stringify({ mode: "confirm", txHash: fundingHash }) });
      setFunding(null);
      await Promise.all([load(), refresh()]);
      notify(serviceRequest ? "Service request funded" : "Listing funded", serviceRequest ? "The provider can now accept or decline the secured request." : "The verified reserve is secured and the Listing is open.");
    } catch (reason) {
      notify("Funding not confirmed", reason instanceof Error ? reason.message : "The chain event did not match this Listing.");
    } finally {
      setSubmitting(false);
    }
  };

  const hire = async (applicationId: string) => {
    if (!walletConnected) {
      setConnectWalletOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const prepared = await api<{ workroomId: string; call: ChainCall }>(`/api/v1/listings/${item.id}/hire`, { method: "POST", body: JSON.stringify({ mode: "prepare", applicationId, autoRelease: false }) });
      const hash = await sendTransactionAsync({
        to: prepared.call.to as `0x${string}`,
        data: prepared.call.data as `0x${string}`,
        value: prepared.call.value ? BigInt(prepared.call.value) : undefined
      });
      await waitForReceipt(hash);
      const room = await api<{ id: string }>(`/api/v1/listings/${item.id}/hire`, { method: "POST", body: JSON.stringify({ mode: "confirm", applicationId, workroomId: prepared.workroomId, txHash: hash, autoRelease: false }) });
      await refresh();
      router.push(`/workrooms/${room.id}`);
      notify("Workroom funded", "The selected person now has an on-chain allocated Workroom.");
    } catch (reason) {
      notify("Workroom not opened", reason instanceof Error ? reason.message : "The funded place was not assigned.");
    } finally {
      setSubmitting(false);
    }
  };

  const cancelAndRefund = async () => {
    if (!walletConnected) {
      setConnectWalletOpen(true);
      return;
    }
    if (!window.confirm("Cancel this Listing and return every unused funded place to your wallet? Active Workrooms will continue.")) return;
    setSubmitting(true);
    try {
      const prepared = await api<{ amountAtomic: string; remainingPlaces: number; call: ChainCall }>(`/api/v1/listings/${item.id}/cancel`, { method: "POST", body: JSON.stringify({ mode: "prepare" }) });
      const hash = await sendTransactionAsync({
        to: prepared.call.to as `0x${string}`,
        data: prepared.call.data as `0x${string}`,
        value: prepared.call.value ? BigInt(prepared.call.value) : undefined
      });
      await waitForReceipt(hash);
      await api(`/api/v1/listings/${item.id}/cancel`, { method: "POST", body: JSON.stringify({ mode: "confirm", txHash: hash }) });
      await Promise.all([load(), refresh()]);
      notify("Listing cancelled", `${formatUsdcAtomic(prepared.amountAtomic, 6)} USDC from ${prepared.remainingPlaces} unused place${prepared.remainingPlaces === 1 ? "" : "s"} was returned.`);
    } catch (reason) {
      notify("Listing was not cancelled", reason instanceof Error ? reason.message : "The reserve refund could not be verified.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmitModal = providerInvite ? true : response.trim().length >= 20;
  const headerState = serviceOffer ? (item.status === "OPEN" ? "Available" : "Paused") : item.funded ? "Funding secured" : item.status.replaceAll("_", " ");

  return <>
    <header className="page-head">
      <div className="page-head-copy">
        <button className="btn text" onClick={() => router.push("/marketplace")}><Icon name="arrowleft" size="sm" /> Back to results</button>
        <span className="page-kicker">{item.type} · {headerState}</span>
        <h1>{item.title}</h1>
        <p>{item.outcome}</p>
      </div>
      <div className="head-actions"><span className={`pill ${(item.funded || serviceOffer && item.status === "OPEN") ? "green" : ""}`}>{headerState}</span></div>
    </header>

    <section className="listing-dialog-body">
      <main>
        <div className="dialog-section"><span>{serviceOffer ? "Service result" : "Finished result"}</span><b>{item.outcome}</b></div>
        <div className="dialog-section"><span>Deliverables</span><b>{item.deliverables}</b></div>
        <div className="dialog-section"><span>{serviceOffer ? "What the buyer supplies" : "Who this is for"}</span><b>{item.who}</b></div>
        <div className="dialog-section"><span>Required capability</span><b>{item.skills.join(" · ") || "The published scope determines fit."}</b></div>
        <div className="dialog-section"><span>Approval requirements</span><b>{item.approval}</b></div>
        {serviceOffer && typeof item.detail.deliveryDays === "number" ? <div className="dialog-section"><span>Delivery time</span><b>{item.detail.deliveryDays} day{item.detail.deliveryDays === 1 ? "" : "s"} after the Workroom opens</b></div> : null}
        {data.reputation && !serviceOffer ? <section className="why-fit"><span>Your evidence</span><h2>Your persisted NexCard evidence can be attached to the application.</h2><p>NexMarkets does not invent a match percentage. The owner reviews the actual evidence and response.</p></section> : null}
      </main>
      <aside>
        <section className="listing-terms">
          <div><span>{serviceOffer ? "Fixed price" : "Offer"}</span><b>{item.budget}</b></div>
          <div><span>Timeline</span><b>{serviceOffer && typeof item.detail.deliveryDays === "number" ? `${item.detail.deliveryDays} days` : formatDate(item.deadline)}</b></div>
          {!serviceOffer ? <div><span>Places</span><b>{item.places}</b></div> : null}
          {!serviceOffer ? <div><span>Applications</span><b>{item.applicants}</b></div> : null}
          <div><span>{serviceOffer ? "Provider" : "Owner"}</span><b>{item.owner}</b></div>
          <div><span>Status</span><b>{headerState}</b></div>
        </section>

        {owned && serviceOffer ? <div className="resource-actions" style={{ marginTop: 12 }}>
          <button className="btn primary full" disabled={submitting} onClick={() => void setServiceAvailability(item.status === "OPEN" ? "PAUSED" : "OPEN")}>{item.status === "OPEN" ? "Pause new requests" : "Resume Service"}</button>
          <button className="btn ghost full" onClick={() => router.push("/marketplace?tab=my-work")}>Manage in My work</button>
        </div> : owned && !item.funded ? funding ? <section className="payment-confirm" style={{ marginTop: 12 }}>
          <div><span>Per place</span><b>{item.budget}</b></div>
          <div><span>Places</span><b>{funding.places}</b></div>
          <div><span>Total reserve</span><b>{formatUsdcAtomic(funding.totalAtomic, 6)} USDC</b></div>
          <div><span>Wallet balance</span><b>{formatUsdcAtomic(funding.usdcBalanceAtomic, 6)} USDC</b></div>
          <button className="btn primary full" disabled={submitting || !funding.sufficientBalance} onClick={() => void fundListing()}>{submitting ? "Waiting for wallet…" : funding.sufficientBalance ? serviceRequest ? "Approve USDC and fund request" : "Approve USDC and fund Listing" : "Insufficient USDC balance"}</button>
          <button className="btn ghost full" onClick={() => setFunding(null)}>Close</button>
        </section> : <button className="btn primary full" style={{ marginTop: 12 }} disabled={submitting} onClick={() => void prepareFunding()}>{submitting ? "Reading wallet…" : serviceRequest ? "Fund Service request" : "Fund and publish Listing"}</button> : owned ? <div className="resource-actions" style={{ marginTop: 12 }}>
          {serviceRequest && item.status === "PAUSED" ? <button className="btn danger full" disabled={submitting} onClick={() => void cancelAndRefund()}>Refund declined request</button> : null}
          <button className="btn ghost full" onClick={() => router.push("/marketplace?tab=my-work")}>Manage in My work</button>
        </div> : providerInvite ? <div className="resource-actions" style={{ marginTop: 12 }}>
          <button className="btn primary full" disabled={submitting || item.status !== "OPEN"} onClick={() => setApplyOpen(true)}>Accept Service request</button>
          <button className="btn danger full" disabled={submitting || item.status !== "OPEN"} onClick={() => void declineServiceRequest()}>Decline request</button>
        </div> : <button className="btn primary full" style={{ marginTop: 12 }} disabled={item.status !== "OPEN"} onClick={() => setApplyOpen(true)}>{serviceOffer ? "Request service" : item.type === "Direct Hire" ? "Respond to private offer" : "Apply"}</button>}
      </aside>
    </section>

    {owned && item.funded && !serviceOffer ? <section className="settings-section">
      <header className="settings-head">
        <div><h2>{serviceRequest ? "Provider response" : "Applications"}</h2><p>{serviceRequest ? "The named provider can accept after the fixed price is secured." : "Each hire allocates one already-funded place into an active on-chain Workroom."}</p></div>
        {item.status === "OPEN" && !serviceRequest ? <button className="btn danger" disabled={submitting} onClick={() => void cancelAndRefund()}>Cancel and refund unused reserve</button> : null}
      </header>
      {applications.length ? applications.map((application) => <div className="setting-row" key={application.id}>
        <span className="setting-copy"><b>{application.applicant.displayName || (application.applicant.handle ? `@${application.applicant.handle}` : "NexMarkets applicant")}</b><span>{application.response}</span><small>{application.deliveryPlan || application.availability || `Submitted ${new Date(application.createdAt).toLocaleDateString()}`}</small></span>
        <span className={`pill ${application.status === "ACCEPTED" ? "green" : application.status === "DECLINED" ? "red" : ""}`}>{application.status}</span>
        {new Set(["SUBMITTED", "SHORTLISTED"]).has(application.status) ? <button className="btn primary" disabled={submitting} onClick={() => void hire(application.id)}>{serviceRequest ? "Open funded Workroom" : "Hire and open Workroom"}</button> : null}
      </div>) : <div className="market-empty"><h2>{serviceRequest && item.status === "PAUSED" ? "Provider declined this request." : serviceRequest ? "Awaiting the provider." : "No applications yet."}</h2><p>{serviceRequest && item.status === "PAUSED" ? "Use Refund declined request to return the secured amount." : serviceRequest ? "The request is funded and private to the named provider." : "The Listing is open and its reserve is secured."}</p></div>}
    </section> : null}

    {applyOpen ? <>
      <div className="backdrop open" onClick={() => setApplyOpen(false)} />
      <section className="modal open" role="dialog" aria-modal="true">
        <header className="modal-head"><div><span className="page-kicker">{serviceOffer ? "Service request" : providerInvite ? "Provider decision" : "Application"}</span><h2>{item.title}</h2></div><button className="close-button" onClick={() => setApplyOpen(false)}><Icon name="close" size="sm" /></button></header>
        <div className="modal-body">
          <div className="field"><label>{serviceOffer ? "What do you need from this fixed Service?" : providerInvite ? "Acceptance note (optional)" : "Why are you right for this work?"}</label><textarea className="textarea" value={response} onChange={(event) => setResponse(event.target.value)} placeholder={serviceOffer ? "Describe the specific result while staying inside the published offer." : providerInvite ? "Confirm timing or the first material you need from the buyer." : "Connect your actual experience to the published result."} /></div>
          {serviceOffer ? <div className="field"><label>Material you will supply <small>One item per line</small></label><textarea className="textarea" value={deliveryPlan} onChange={(event) => setDeliveryPlan(event.target.value)} placeholder="Product brief&#10;Brand assets&#10;Approved facts" /></div> : providerInvite ? null : <>
            <div className="field"><label>Delivery plan <small>Optional</small></label><textarea className="textarea" value={deliveryPlan} onChange={(event) => setDeliveryPlan(event.target.value)} placeholder="Explain how you would move from source to approval." /></div>
            <div className="direction-split"><div className="field"><label>Availability</label><input className="input" value={availability} onChange={(event) => setAvailability(event.target.value)} /></div><div className="field"><label>Proposed fee in USDC <small>Optional</small></label><input className="input" type="number" min="0" step="0.01" value={proposedFee} onChange={(event) => setProposedFee(event.target.value)} /></div></div>
          </>}
        </div>
        <footer className="modal-actions"><button className="btn ghost" onClick={() => setApplyOpen(false)}>Cancel</button><button className="btn primary" disabled={submitting || !canSubmitModal} onClick={() => void submitResponse()}>{submitting ? "Saving…" : serviceOffer ? "Create private request" : providerInvite ? "Accept request" : "Submit application"}</button></footer>
      </section>
    </> : null}
  </>;
}
