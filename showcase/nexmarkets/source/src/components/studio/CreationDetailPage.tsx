"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { formatUsdcAtomic } from "@/components/product/format";
import { useSendTransaction } from "wagmi";

type ProductionRecord = {
  id: string;
  kind: "VIDEO" | "INFOGRAPHIC";
  title: string;
  status: string;
  publicState: string;
  direction: Record<string, unknown>;
  brief?: Record<string, unknown>;
  priceAtomic?: string;
  latestRevisionNote?: string | null;
  owner?: { displayName: string | null; handle: string | null } | null;
  currentVersion?: { outputObjectKey: string | null } | null;
  access?: { owner: boolean; canBrief: boolean; canApproveBrief: boolean; workroomId: string | null; expiresAt: string | null };
  createdAt: string;
  updatedAt: string;
};

type ChainCall = { to: string; data: string; value: string };
type Quote = {
  id: string;
  payer: string;
  standardPriceAtomic: string;
  discountAtomic: string;
  finalPriceAtomic: string;
  payerBalanceAtomic: string;
  nexBalanceAtomic: string;
  nexThresholdAtomic: string;
  eligible: boolean;
  sufficientBalance: boolean;
  expiresAt: string;
  chainId: number;
  calls: { approval: ChainCall; payment: ChainCall };
};

type ControlTab = "description" | "storyboard" | "voice" | "music" | "format" | "brand" | "payment" | "production";

async function waitForReceipt(hash: string) {
  if (!window.ethereum) throw new Error("The wallet provider is no longer available.");
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const receipt = await window.ethereum.request({ method: "eth_getTransactionReceipt", params: [hash] }) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") throw new Error("The wallet transaction reverted.");
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error("The transaction is still pending. Reopen this creation after it confirms.");
}

export function CreationDetailPage({ id }: { id: string }) {
  const router = useRouter();
  const { data, loading: bootstrapLoading, error: bootstrapError, api, refresh, notify, walletConnected, setConnectWalletOpen } = useProduct();
  const { sendTransactionAsync } = useSendTransaction();
  const [production, setProduction] = useState<ProductionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [callToAction, setCallToAction] = useState("Learn more");
  const [revisionNote, setRevisionNote] = useState("");
  const [controlTab, setControlTab] = useState<ControlTab>("description");
  const [renderResult, setRenderResult] = useState<{ still?: { dataUrl: string; width: number; height: number }; renderJob?: { status: string } } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const record = await api<ProductionRecord>(`/api/v1/productions/${id}`);
      setProduction(record);
      const briefMessage = typeof record.brief?.message === "string" ? record.brief.message : record.title;
      setMessage(briefMessage);
      if (record.status === "REVISION_REQUESTED" && record.latestRevisionNote) setRevisionNote(record.latestRevisionNote);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The creation could not be loaded.");
    } finally { setLoading(false); }
  }, [api, id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const creation = data?.creations.find((item) => item.id === id);
  const directionEntries = useMemo(() => Object.entries(production?.direction || {}).filter(([, value]) => typeof value !== "object"), [production?.direction]);

  if (bootstrapLoading || bootstrapError || !data) return <LoadState label="Loading the Studio creation" />;
  if (loading) return <section className="empty-state"><div><span className="empty-mark"><Icon name="refresh" /></span><h2>Loading creation</h2><p>Reading the persisted production record.</p></div></section>;
  if (error || !production) return <section className="empty-state"><div><span className="empty-mark"><Icon name="close" /></span><h2>Creation unavailable.</h2><p>{error || "No production exists with this identifier."}</p><button className="btn primary" onClick={() => router.push("/studio")}>Return to Studio</button></div></section>;

  const requestQuote = async () => {
    if (!data.wallet.address) {
      notify("Verified wallet required", "Connect and verify the wallet that will pay for this creation.");
      return;
    }
    setBusy(true);
    try {
      const next = await api<Quote>(`/api/v1/productions/${id}/quote`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ payer: data.wallet.address }) });
      setQuote(next);
    } catch (reason) { notify("Quote unavailable", reason instanceof Error ? reason.message : "The pricing contract could not be read."); }
    finally { setBusy(false); }
  };

  const pay = async () => {
    if (!walletConnected) {
      setConnectWalletOpen(true);
      return;
    }
    if (!quote) return;
    if (process.env.NODE_ENV === "development") {
      setBusy(true);
      try {
        const simulatedHash = `0x${"1".repeat(64)}`;
        const confirmation = await api<{ status: "SUBMITTED" | "CONFIRMED" }>(`/api/v1/productions/${id}/payment-intents`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ quoteId: quote.id, txHash: simulatedHash }) });
        setQuote(null);
        await Promise.all([load(), refresh()]);
        notify(confirmation.status === "CONFIRMED" ? "Simulated payment confirmed" : "Simulated payment submitted", "Local development only: production payment was confirmed without a live chain transaction.");
      } catch (reason) {
        notify("Payment not completed", reason instanceof Error ? reason.message : "The local simulated payment failed.");
      } finally {
        setBusy(false);
      }
      return;
    }
    setBusy(true);
    try {
      const approvalHash = await sendTransactionAsync({
        to: quote.calls.approval.to as `0x${string}`,
        data: quote.calls.approval.data as `0x${string}`,
        value: quote.calls.approval.value ? BigInt(quote.calls.approval.value) : undefined
      });
      await waitForReceipt(approvalHash);
      const paymentHash = await sendTransactionAsync({
        to: quote.calls.payment.to as `0x${string}`,
        data: quote.calls.payment.data as `0x${string}`,
        value: quote.calls.payment.value ? BigInt(quote.calls.payment.value) : undefined
      });
      await waitForReceipt(paymentHash);
      const confirmation = await api<{ status: "SUBMITTED" | "CONFIRMED" }>(`/api/v1/productions/${id}/payment-intents`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ quoteId: quote.id, txHash: paymentHash }) });
      setQuote(null);
      await Promise.all([load(), refresh()]);
      notify(confirmation.status === "CONFIRMED" ? "Payment confirmed" : "Payment submitted", confirmation.status === "CONFIRMED" ? "The chain event was verified and attached to this production." : "The transaction is persisted and will be reconciled after its required confirmations.");
    } catch (reason) { notify("Payment not completed", reason instanceof Error ? reason.message : "The chain transaction could not be verified."); }
    finally { setBusy(false); }
  };

  const startLive = async () => {
    setBusy(true);
    try {
      const session = await api<{ id: string }>(`/api/v1/productions/${id}/live-sessions`, { method: "POST", body: JSON.stringify({ context: { productionId: id, direction: production.direction, brief: production.brief } }) });
      router.push(`/nexmind?session=${session.id}&production=${id}&live=1`);
    } catch (reason) { notify("NexMind session unavailable", reason instanceof Error ? reason.message : "The configured provider did not accept the session."); }
    finally { setBusy(false); }
  };

  const render = async () => {
    setBusy(true);
    try {
      const aspectRatio = production.direction.aspectRatio === "1:1" || production.direction.aspectRatio === "9:16" ? production.direction.aspectRatio : "16:9";
      const result = await api<{ still?: { dataUrl: string; width: number; height: number }; renderJob?: { status: string } }>(`/api/v1/productions/${id}/render`, {
        method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ message, callToAction, accent: production.direction.primaryColour || "#ffb000", aspectRatio, revisionNote: revisionNote.trim() || undefined }),
      });
      setRenderResult(result);
      await Promise.all([load(), refresh()]);
      notify("Production started", production.kind === "VIDEO" ? "HyperFrames submitted the composition to HeyGen." : "The first infographic version is ready to review.");
    } catch (reason) { notify("Production did not start", reason instanceof Error ? reason.message : "The render provider rejected the request."); }
    finally { setBusy(false); }
  };

  const reviewVersion = async (action: "approve" | "revision") => {
    if (action === "revision" && revisionNote.trim().length < 2) {
      notify("Describe the revision", "Tell Studio exactly what should change in the next persisted version.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/v1/productions/${id}/review`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(action === "approve" ? { action } : { action, note: revisionNote }) });
      await Promise.all([load(), refresh()]);
      notify(action === "approve" ? "Version approved" : "Revision saved", action === "approve" ? "The persisted output is now the approved final version." : "Your note is attached to this version. Update the production fields and render the next version when ready.");
    } catch (reason) { notify("Review was not saved", reason instanceof Error ? reason.message : "The version decision could not be persisted."); }
    finally { setBusy(false); }
  };

  const requestRefund = async () => {
    if (!window.confirm("Request cancellation and a full operator-reviewed refund for this production payment?")) return;
    setBusy(true);
    try {
      await api(`/api/v1/productions/${id}/refund-request`, { method: "POST", body: "{}" });
      notify("Refund requested", "The production operator was notified. Funds move only after the matching on-chain refund event.");
    } catch (reason) { notify("Refund was not requested", reason instanceof Error ? reason.message : "The request could not be persisted."); }
    finally { setBusy(false); }
  };

  const shareCreation = async () => {
    const url = `${window.location.origin}/studio/${id}`;
    if (navigator.share) await navigator.share({ title: production.title, url }).catch(() => null);
    else await navigator.clipboard.writeText(url);
    notify("Share link copied", "Anyone with permission can open this Creation.");
  };

  const ownerAccess = production.access?.owner !== false;
  const devSimulation = process.env.NODE_ENV === "development";
  const canQuote = ownerAccess && ["DIRECTION_READY", "AWAITING_PAYMENT"].includes(production.status);
  const paid = production.status === "PAID";
  const hasConfirmedPayment = Boolean(production.priceAtomic) || paid;
  const canBrief = ownerAccess && production.kind === "VIDEO" && ["DIRECTION_READY", "AWAITING_PAYMENT", "PAID", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "BRIEF_REVIEW"].includes(production.status) && production.access?.canBrief !== false;
  const canRender = ownerAccess && hasConfirmedPayment && (["REVISION_REQUESTED", "FAILED"].includes(production.status) || (production.kind === "INFOGRAPHIC" && paid) || (production.kind === "VIDEO" && production.status === "BRIEF_REVIEW"));
  const telegramReady = devSimulation || (data.integrations.telegram.configured && data.integrations.telegram.connected);
  const producing = ["LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE", "QUEUED", "REVIEWING_SOURCE", "BUILDING_STORY", "PRODUCING_SCENES", "ADDING_AUDIO", "RENDERING"].includes(production.status);
  const ready = ["VERSION_READY", "REVISION_REQUESTED", "APPROVED"].includes(production.status) || Boolean(renderResult?.still);
  const aspect = production.direction.aspectRatio === "1:1" ? "1 / 1" : production.direction.aspectRatio === "9:16" ? "9 / 16" : "16 / 9";
  const hasPersistedOutput = Boolean(creation?.outputKey || production.currentVersion?.outputObjectKey);
  const persistedOutput = hasPersistedOutput ? `/api/v1/productions/${id}/output?disposition=inline` : null;

  if (production.status === "BRIEF_REVIEW" || production.status === "STORYBOARD_REVIEW") {
    const fields = [
      ["Finished piece", production.kind === "VIDEO" ? "30-second product launch video" : "Portrait announcement visual"],
      ["Central message", typeof production.brief?.message === "string" ? production.brief.message : "The product context is ready to move into finished media."],
      ["Audience", "Product founders and technical teams"],
      ["Opening", "Product visible from the first frame"],
      ["Direction", String(production.direction.creativeDirection || "Product-led and minimal")],
      ["Sources", typeof production.direction.source === "string" ? production.direction.source : "Supplied page and approved product copy"],
      ["Formats", production.kind === "VIDEO" ? "16:9 master · 9:16 cutdown" : "1080 × 1350 PNG"],
      ["Notifications", telegramReady ? "In-app and Telegram" : "In-app"]
    ];
    return <section className="studio-approval">
      <header>
        <button className="btn text" onClick={() => void startLive()}><Icon name="arrowleft" size="sm" /> Continue conversation</button>
        <span className="page-kicker">Ready for approval</span>
        <h1>Approve the direction before production.</h1>
        <p>The conversation and source are now one production brief. You can change any field before work starts.</p>
      </header>
      <div className="approval-layout">
        <main className="approval-object">
          {fields.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <b>{value}</b>
              <button className="btn text" onClick={() => notify("Field ready", "Update this decision before production starts.")}>Edit</button>
            </article>
          ))}
        </main>
        <aside className="approval-side">
          <h2>Production permission</h2>
          <p>NexMind may make layout, timing and transition decisions inside this approved direction. New claims, a changed message or a new deliverable always return to you.</p>
          <label className="consent-item">
            <input type="checkbox" defaultChecked />
            <span><b>Use the approved sources only</b><span>Unsupported claims remain excluded.</span></span>
          </label>
          <label className="consent-item">
            <input type="checkbox" defaultChecked />
            <span><b>Prepare the first complete version</b><span>Storyboard appears first when a structural decision needs review.</span></span>
          </label>
          <div className="payment-receipt">
            <span>{hasConfirmedPayment ? "Payment confirmed" : "Payment required before final render"}</span>
            <b>{hasConfirmedPayment ? `${formatUsdcAtomic(production.priceAtomic || "5000000", 6)} USDC` : "Quote next"}</b>
            <small>{hasConfirmedPayment ? "No second charge when production begins." : "The brief can be refined now; final render is submitted only after payment."}</small>
          </div>
          <button className="btn primary full" disabled={busy} onClick={() => hasConfirmedPayment ? void render() : void requestQuote()}>
            {busy ? "Working…" : hasConfirmedPayment ? "Approve and begin production" : "Get quote before render"} <Icon name="arrow" size="sm" />
          </button>
          <button className="btn ghost full" onClick={() => router.push("/studio")}>Return to direction</button>
        </aside>
      </div>
    </section>;
  }

  if (producing) {
    const stages = [
      ["Reviewing source", "Website or text read", "Brand elements collected", "Claims confirmed", "Screenshots prepared"],
      ["Building the story", "Central message", "Script", "Story route", "Storyboard"],
      ["Producing scenes", "Layout", "Interface movement", "Graphics", "Transitions"],
      ["Adding voice and sound", "Voiceover", "Music", "Effects", "Captions"],
      ["Checking and rendering", "Text fit", "Safe areas", "Logo accuracy", "Final render"]
    ];
    const currentStageIndex = ["QUEUED", "REVIEWING_SOURCE", "LIVE_SESSION_READY", "LIVE_SESSION_ACTIVE"].includes(production.status) ? 0 : ["BUILDING_STORY"].includes(production.status) ? 1 : ["PRODUCING_SCENES"].includes(production.status) ? 2 : ["ADDING_AUDIO"].includes(production.status) ? 3 : 4;
    return <>
      <header className="page-head production-head">
        <div className="page-head-copy">
          <span className="page-kicker">Production continues in the background</span>
          <h1>{production.title}</h1>
          <p>You can leave this page. Studio and Telegram will bring you back when a decision or first version is ready.</p>
        </div>
        <button className="btn ghost" onClick={() => router.push("/dashboard")}>Leave safely</button>
      </header>
      <nav className="production-track">
        {stages.map((item, index) => (
          <button key={item[0]} className={index < currentStageIndex ? "done" : index === currentStageIndex ? "current" : ""}>
            <i>{index < currentStageIndex ? <Icon name="check" size="sm" /> : String(index + 1).padStart(2, "0")}</i>
            <span><b>{item[0]}</b><small>{index < currentStageIndex ? "Complete" : index === currentStageIndex ? "In progress" : "Waiting"}</small></span>
          </button>
        ))}
      </nav>
      <section className="production-work">
        <main>
          <div className="section-top">
            <h2>{stages[currentStageIndex][0]}</h2>
            <span>{currentStageIndex === 4 ? "First version preparing" : "Artifacts appear as they are ready"}</span>
          </div>
          <div className="artifact-grid">
            {stages[currentStageIndex].slice(1).map((label, index) => (
              <article className={`artifact-card ${index < 3 || currentStageIndex === 0 ? "ready" : "waiting"}`} key={label}>
                <i><Icon name={index < 3 || currentStageIndex === 0 ? (index === 3 ? "play" : "file") : "more"} /></i>
                <span><b>{label}</b><small>{index < 3 || currentStageIndex === 0 ? "Available to review" : "Waiting on current work"}</small></span>
                {index < 3 || currentStageIndex === 0 ? <button className="btn text" onClick={() => notify("Artifact opened", "Review the current production artifact.")}>Open</button> : null}
              </article>
            ))}
          </div>
          {currentStageIndex >= 1 ? (
            <div className="storyboard-preview">
              <article><span>01 / Opening</span><b>Product visible from frame one.</b></article>
              <article><span>02 / Context</span><b>The core problem, without a generic montage.</b></article>
              <article><span>03 / Workflow</span><b>The central product route in motion.</b></article>
              <article><span>04 / Result</span><b>What changes for the viewer.</b></article>
            </div>
          ) : null}
        </main>
        <aside className="production-status-card">
          <span className="pill gold">{telegramReady ? "Telegram connected" : "In-app only"}</span>
          <h2>What NexMind is doing</h2>
          <p>{["Checking the source against the selected direction.", "Turning the approved message into scenes and a storyboard.", "Building each scene from the approved source and product assets.", "Adding the chosen voice, captions and sound direction.", "Checking fit, safe areas, timing and the final render."][currentStageIndex]}</p>
          <div className="detail-section"><span>Waiting for you</span><b>{currentStageIndex === 1 ? "Storyboard review" : "Nothing right now"}</b></div>
          <div className="detail-section"><span>Estimated completion</span><b>{["18–24 min", "14–20 min", "9–14 min", "5–8 min", "First version soon"][currentStageIndex]}</b></div>
          <div className="detail-section"><span>Payment</span><b>{formatUsdcAtomic(production.priceAtomic || "5000000", 6)} USDC · paid once</b></div>
        </aside>
      </section>
    </>;
  }

  return <>
    <header className="page-head"><div className="page-head-copy"><button className="btn text" onClick={() => router.push(ownerAccess ? "/studio" : production.access?.workroomId ? `/workrooms/${production.access.workroomId}` : "/marketplace?tab=my-work")}><Icon name="arrowleft" size="sm" /> {ownerAccess ? "Your Studio" : "Delegating Workroom"}</button><h1>{production.title}</h1><p>Created by {production.owner?.displayName || (production.owner?.handle ? `@${production.owner.handle}` : "NexMarkets member")} · {production.kind === "VIDEO" ? "Video" : "Infographic"} · persisted {production.status.replaceAll("_", " ").toLowerCase()}</p>{!ownerAccess ? <span className="pill gold">Delegated briefing access · expires {production.access?.expiresAt ? new Date(production.access.expiresAt).toLocaleString() : "soon"}</span> : null}</div><div className="head-actions"><button className="btn ghost" onClick={() => void load()}><Icon name="refresh" size="sm" /> Refresh</button>{hasPersistedOutput ? <a className="btn primary" href={`/api/v1/productions/${id}/output`}><Icon name="download" size="sm" /> Export</a> : null}</div></header>
    <section className="creation-detail"><div className="creation-viewer"><header className="viewer-head"><span className={`pill ${ready ? "green" : "gold"}`}>{production.status.replaceAll("_", " ")}</span><div className="head-actions"><button className="btn ghost" disabled={!persistedOutput} onClick={() => persistedOutput ? window.open(persistedOutput, "_blank", "noopener,noreferrer") : undefined}><Icon name="play" size="sm" /> Preview</button><button className="btn" onClick={() => void shareCreation()}><Icon name="share" size="sm" /> Share</button>{production.priceAtomic ? <span className="pill">{formatUsdcAtomic(production.priceAtomic, 6)} USDC paid</span> : null}</div></header><div className="viewer-stage">{renderResult?.still ? <img src={renderResult.still.dataUrl} alt={`Rendered ${production.title}`} /> : persistedOutput && production.kind === "INFOGRAPHIC" ? <img src={persistedOutput} alt={`Rendered ${production.title}`} /> : persistedOutput ? <video src={persistedOutput} controls playsInline aria-label={`Rendered ${production.title}`} /> : production.kind === "INFOGRAPHIC" ? <div className="no-preview"><span className="page-kicker">Paid output only</span><h2>No final infographic preview is generated before payment.</h2><p>The approved task and source are stored. The finished composition appears here after the 0.10 USDC event is confirmed.</p></div> : <div className="film-frame" style={{ "--creation-ratio": aspect } as React.CSSProperties}><span>NEXMARKETS / PRODUCT FILM</span><strong>{message || production.title}</strong><span>{String(production.direction.duration || "30 seconds")}</span></div>}</div></div>
      <aside className="creation-controls">
        <div className="control-tabs" role="tablist" aria-label="Creation record sections">{(["description", "storyboard", "voice", "music", "format", "brand", "payment", "production"] as ControlTab[]).map((value) => <button key={value} role="tab" aria-selected={controlTab === value} className={controlTab === value ? "active" : ""} onClick={() => setControlTab(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
        {controlTab === "description" ? <div className="field"><label>Approved description</label><div className="creation-description-readonly">{typeof production.brief?.message === "string" ? production.brief.message : "No description was stored."}</div></div> : null}
        {(["storyboard", "voice", "music", "format", "brand"] as ControlTab[]).includes(controlTab) ? <div className="field"><label>{controlTab[0].toUpperCase() + controlTab.slice(1)} direction</label><textarea className="textarea" value={directionEntries.map(([label, value]) => `${label}: ${String(value)}`).join("\n") || "Keep the product visible and the language direct. Use only approved source material."} readOnly /></div> : null}
        {controlTab === "payment" ? <div className="direction-review-list"><div className="detail-section"><span>Payment state</span><b>{production.priceAtomic ? `${formatUsdcAtomic(production.priceAtomic, 6)} USDC confirmed` : "Not paid"}</b></div><div className="detail-section"><span>Network</span><b>Robinhood Chain</b></div></div> : null}
        {controlTab === "production" ? <div className="direction-review-list">{devSimulation ? <div className="detail-section"><span>Local simulation</span><b>Payment, Telegram and HeyGen gates are bypassed only on the dev server.</b></div> : null}<div className="detail-section"><span>Production state</span><b>{production.status.replaceAll("_", " ")}</b></div><div className="detail-section"><span>Output</span><b>{hasPersistedOutput ? "Persisted version available" : "No output version yet"}</b></div></div> : null}
        {canQuote && !quote ? <button className="btn primary full" disabled={busy} onClick={() => void requestQuote()}>{busy ? "Reading contract…" : devSimulation ? "Get simulated chain quote" : "Get live chain quote"}</button> : null}
        {quote ? <section className="payment-confirm"><div><span>Standard price</span><b>{formatUsdcAtomic(quote.standardPriceAtomic, 6)} USDC</b></div><div><span>$NEX benefit</span><b>{quote.eligible ? `−${formatUsdcAtomic(quote.discountAtomic, 6)} USDC` : "Not eligible"}</b></div><div><span>Final price</span><b>{formatUsdcAtomic(quote.finalPriceAtomic, 6)} USDC</b></div><div><span>Wallet balance</span><b>{formatUsdcAtomic(quote.payerBalanceAtomic, 6)} USDC</b></div><small>Quote expires {new Date(quote.expiresAt).toLocaleTimeString()} · Robinhood Chain {quote.chainId}</small><button className="btn primary full" disabled={busy || !quote.sufficientBalance} onClick={() => void pay()}>{busy ? "Waiting for wallet…" : quote.sufficientBalance ? "Approve USDC and pay" : "Insufficient USDC balance"}</button><button className="btn ghost full" onClick={() => setQuote(null)}>Close quote</button></section> : null}
        {canBrief ? <button className="btn primary full" disabled={busy} onClick={() => void startLive()}><Icon name="mic" size="sm" /> {busy ? "Opening…" : hasConfirmedPayment ? "Speak with NexMind" : "Refine brief with NexMind"}</button> : null}
        {ownerAccess && new Set(["PAID", "LIVE_SESSION_READY", "BRIEF_REVIEW", "FAILED"]).has(production.status) ? <button className="btn danger full" disabled={busy} onClick={() => void requestRefund()}>Request cancellation and refund</button> : null}
        {canRender ? <section className="render-approval">{production.status === "REVISION_REQUESTED" ? <div className="field"><label>Approved revision request</label><textarea className="textarea" value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} /></div> : null}<div className="field"><label>Message</label><textarea className="textarea" value={message} onChange={(event) => setMessage(event.target.value)} /></div><div className="field"><label>Call to action</label><input className="input" value={callToAction} onChange={(event) => setCallToAction(event.target.value)} /></div>{production.kind === "VIDEO" && !telegramReady ? <div className="signal-entry-assurance"><i><Icon name="bell" size="sm" /></i><span><b>Telegram confirmation required</b><small>Video production continues after you leave, so a verified delivery destination is required.</small></span><button className="btn ghost compact" onClick={() => router.push("/settings?tab=connections")}>Open Settings</button></div> : null}<button className="btn ghost full" disabled={busy || production.kind === "VIDEO" && !telegramReady} onClick={() => void render()}>{busy ? "Starting production…" : production.status === "FAILED" ? "Retry production" : production.kind === "VIDEO" ? devSimulation ? "Run simulated HyperFrames + HeyGen render" : "Approve brief and submit to HyperFrames + HeyGen" : "Approve brief and create infographic"}</button>{production.kind === "VIDEO" ? <small>{devSimulation ? "Local simulation will persist a completed video artifact without calling Telegram or HeyGen." : telegramReady ? "Verified Telegram updates are ready for this background production." : "Connect Telegram before submitting this video."}</small> : null}</section> : null}
        {ownerAccess && production.status === "VERSION_READY" ? <section className="render-approval"><div className="field"><label>Revision note <small>Only needed if something must change</small></label><textarea className="textarea" value={revisionNote} onChange={(event) => setRevisionNote(event.target.value)} placeholder="Describe the exact change for the next version." /></div><button className="btn primary full" disabled={busy} onClick={() => void reviewVersion("approve")}>{busy ? "Saving…" : "Approve final version"}</button><button className="btn ghost full" disabled={busy} onClick={() => void reviewVersion("revision")}>Request revision</button></section> : null}
        {producing ? <section className="production-status-card"><span className="pill gold">Provider job active</span><h2>Production continues in the background.</h2><p>Refresh this real production record for the latest provider or webhook state.</p></section> : null}
      </aside>
    </section>
  </>;
}
