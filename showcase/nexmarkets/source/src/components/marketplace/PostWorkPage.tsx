"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";

const typeCopy = {
  TASK: "One defined result with a clear finish.",
  ROLE: "Ongoing responsibility with a recurring payment.",
  CAMPAIGN: "The same brief filled by several paid participants.",
  DIRECT_HIRE: "A private offer sent to one specific person.",
  SERVICE: "A defined service another member can request.",
} as const;

type ListingType = keyof typeof typeCopy;

export function PostWorkPage() {
  const router = useRouter();
  const params = useSearchParams();
  const invitedUserId = params.get("invite") || "";
  const requestedType = params.get("type")?.toLowerCase();
  const initialType: ListingType = requestedType === "directhire" ? "DIRECT_HIRE" : requestedType === "service" ? "SERVICE" : "TASK";
  const { data, loading, error, api, connectWallet, refresh, notify } = useProduct();
  const [step, setStep] = useState(1);
  const [type, setType] = useState<ListingType>(initialType);
  const [title, setTitle] = useState("");
  const [outcome, setOutcome] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [skills, setSkills] = useState("");
  const [who, setWho] = useState("");
  const [places, setPlaces] = useState(1);
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [deliveryDays, setDeliveryDays] = useState(7);
  const [approval, setApproval] = useState("");
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">(invitedUserId ? "PRIVATE" : "PUBLIC");
  const [saving, setSaving] = useState(false);

  if (loading || error || !data) return <LoadState label="Loading the Listing composer" />;

  const service = type === "SERVICE";
  const directHire = type === "DIRECT_HIRE";
  const effectivePlaces = service || directHire ? 1 : places;
  const total = Math.max(0, Number(amount) || 0) * effectivePlaces;
  const validStep = step === 1
    ? title.trim().length >= 4 && outcome.trim().length >= 10 && deliverables.trim().length >= 4
    : step === 2
      ? who.trim().length > 0 && effectivePlaces >= 1 && (!directHire || Boolean(invitedUserId))
      : step === 3
        ? Number(amount) > 0 && (!service || deliveryDays >= 1)
        : true;

  const chooseType = (next: ListingType) => {
    setType(next);
    if (next === "DIRECT_HIRE") {
      setPlaces(1);
      setVisibility("PRIVATE");
    } else if (next === "SERVICE") {
      setPlaces(1);
      setVisibility("PUBLIC");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (!data.authenticated) await connectWallet();
      const workspaceId = typeof data.workspaces[0]?.id === "string" ? data.workspaces[0].id : undefined;
      const listing = await api<{ slug: string }>("/api/v1/listings", {
        method: "POST",
        headers: { "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({
          workspaceId,
          type,
          title,
          outcome,
          deliverables,
          skills: skills.split(",").map((value) => value.trim()).filter(Boolean),
          who,
          approval: approval || "Final approval follows the published deliverables.",
          budgetAtomic: BigInt(Math.round(Number(amount) * 1_000_000)).toString(),
          deadline: !service && deadline ? new Date(deadline).toISOString() : undefined,
          serviceDeliveryDays: service ? deliveryDays : undefined,
          places: effectivePlaces,
          visibility: directHire ? "PRIVATE" : service ? "PUBLIC" : visibility,
          invitedUserId: directHire ? invitedUserId : undefined,
        }),
      });
      await refresh();
      router.push(`/marketplace/${listing.slug}`);
      notify(
        service ? "Service offer published" : "Listing draft saved",
        service ? "Buyers can now create a private funded request from the fixed offer." : "The exact scope and funding requirement are now persisted.",
      );
    } catch (reason) {
      notify("Listing not saved", reason instanceof Error ? reason.message : "Review the Listing and try again.");
    } finally {
      setSaving(false);
    }
  };

  const steps = [[1, "Work"], [2, "People"], [3, "Offer"], [4, "Review"]] as const;

  return <section className="post-flow-shell">
    <main className="post-main post-flow-main">
      <nav className="post-progress" aria-label="Post work progress">
        {steps.map(([number, label]) => <button key={number} className={step === number ? "active" : step > number ? "done" : ""} disabled={number > step} onClick={() => setStep(number)}><i>{step > number ? "✓" : number}</i><span>{label}</span></button>)}
      </nav>
      <div className="post-step-body">
        {step === 1 ? <>
          <span className="page-kicker">Step 1 of 4 · The work</span>
          <h2>{service ? "What service are you offering?" : "What are you asking someone to complete?"}</h2>
          <p>{service ? "Define the fixed result clearly enough that a buyer knows exactly what can be requested." : "Set the result clearly enough that an applicant can price the time and decide whether they are right for it."}</p>
          <div className="post-type-grid">
            {Object.entries(typeCopy).map(([value, copy]) => <button key={value} className={`post-type-choice ${type === value ? "active" : ""}`} onClick={() => chooseType(value as ListingType)}><i>{value === "DIRECT_HIRE" ? "DH" : value.slice(0, 2)}</i><span><b>{value.replace("_", " ")}</b><small>{copy}</small></span></button>)}
          </div>
          <div className="post-fields post-fields-roomy">
            <div className="field full"><label>Listing title</label><input className="input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={service ? "Create a 30-second product explainer" : "Create a clear product explainer from our launch brief"} /></div>
            <div className="field full"><label>{service ? "What result will the buyer receive?" : "What should be true when the work is finished?"}</label><textarea className="textarea" value={outcome} onChange={(event) => setOutcome(event.target.value)} /></div>
            <div className="field full"><label>What must be delivered?</label><textarea className="textarea" value={deliverables} onChange={(event) => setDeliverables(event.target.value)} /></div>
            <div className="field full"><label>Useful skills or experience</label><input className="input" value={skills} onChange={(event) => setSkills(event.target.value)} placeholder="Product storytelling, motion design, research" /></div>
          </div>
        </> : null}

        {step === 2 ? <>
          <span className="page-kicker">Step 2 of 4 · People</span>
          <h2>{directHire ? "Confirm the private recipient." : service ? "Who is this Service for?" : "Is this for one person or a group?"}</h2>
          <p>{directHire
            ? invitedUserId ? "This offer is tied to the published NexCard you selected and will be visible only to that member." : "Open a published NexCard and choose Invite to create a verified private recipient."
            : service ? "A Service is always a one-provider public offer. Describe the buyer and the inputs they must supply."
            : "The number selected here controls the funding total. Each person sees the amount offered to them."}</p>
          {directHire ? <div className="signal-entry-assurance"><i><Icon name={invitedUserId ? "check" : "close"} size="sm" /></i><span><b>{invitedUserId ? "Published NexCard recipient verified" : "No Direct Hire recipient selected"}</b><small>{invitedUserId ? "The recipient identifier is stored privately with this offer." : "Return to a public profile to begin this offer."}</small></span></div> : service ? <div className="signal-entry-assurance"><i><Icon name="check" size="sm" /></i><span><b>One provider · public offer</b><small>A buyer creates and funds a separate private request before work can be allocated.</small></span></div> : <div className="post-audience-grid">
            <button className={`post-audience-choice ${places === 1 ? "active" : ""}`} onClick={() => setPlaces(1)}><i>01</i><span><b>One person</b><small>Select one applicant or send one private offer.</small></span></button>
            <button className={`post-audience-choice ${places > 1 ? "active" : ""}`} onClick={() => setPlaces(Math.max(2, places))}><i>+</i><span><b>A group</b><small>Several people complete the same brief or fill campaign places.</small></span></button>
          </div>}
          <div className="post-fields post-fields-roomy">
            {!directHire && !service && places > 1 ? <div className="field"><label>How many people?</label><input className="input" type="number" min="2" max="100" value={places} onChange={(event) => setPlaces(Math.max(2, Math.min(100, Number(event.target.value))))} /></div> : null}
            <div className="field full"><label>{service ? "Ideal buyer and required buyer inputs" : "Who should take this on?"}</label><textarea className="textarea" value={who} onChange={(event) => setWho(event.target.value)} /></div>
            {!directHire && !service ? <div className="field"><label>Listing visibility</label><select className="select" value={visibility} onChange={(event) => setVisibility(event.target.value as "PUBLIC" | "PRIVATE")}><option value="PUBLIC">Public</option><option value="PRIVATE">Private</option></select></div> : null}
          </div>
        </> : null}

        {step === 3 ? <>
          <span className="page-kicker">Step 3 of 4 · Offer</span>
          <h2>{service ? "Set the fixed price and delivery time." : "What will each person receive?"}</h2>
          <p>{service ? "You publish this offer without funding it. A buyer secures the fixed price when sending a private request." : "Enter the amount for one person. NexMarkets calculates the full reserve that must be secured before the Listing opens."}</p>
          <div className="offer-composer">
            <label className="offer-amount"><span>{service ? "Fixed Service price" : "Offer per person"}</span><span><input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /><b>USDC</b></span></label>
            {!service ? <div className="offer-math"><span><small>People</small><b>{effectivePlaces}</b></span><i>×</i><span><small>Each</small><b>{Number(amount || 0).toLocaleString()} USDC</b></span><i>=</i><span className="total"><small>Total secured</small><b>{total.toLocaleString()} USDC</b></span></div> : null}
          </div>
          <div className="post-fields post-fields-roomy">
            {service ? <div className="field"><label>Delivery time in days</label><input className="input" type="number" min="1" max="365" value={deliveryDays} onChange={(event) => setDeliveryDays(Math.max(1, Math.min(365, Number(event.target.value))))} /></div> : <div className="field"><label>Applications close</label><input className="input" type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></div>}
            <div className="field full"><label>What will be checked before approval?</label><textarea className="textarea" value={approval} onChange={(event) => setApproval(event.target.value)} /></div>
          </div>
        </> : null}

        {step === 4 ? <>
          <span className="page-kicker">Step 4 of 4 · Review</span>
          <h2>Check the Listing before saving it.</h2>
          <p>{service ? "The fixed offer becomes public now. Each buyer request is private and must be funded before you can accept it." : "The scope becomes a persisted draft. Funding must be confirmed on Robinhood Chain before it can open to applicants."}</p>
          <section className="post-review">
            <article><span>Type</span><b>{type.replace("_", " ")}</b></article>
            <article><span>{service ? "Provider places" : "People"}</span><b>{effectivePlaces}</b></article>
            <article className="wide"><span>Title</span><b>{title}</b></article>
            <article className="wide"><span>Finished result</span><b>{outcome}</b></article>
            <article className="wide"><span>Deliverables</span><b>{deliverables}</b></article>
            <article><span>{service ? "Fixed price" : "Offer per person"}</span><b>{amount} USDC</b></article>
            <article><span>{service ? "Delivery" : "Total reserve"}</span><b>{service ? `${deliveryDays} day${deliveryDays === 1 ? "" : "s"}` : `${total.toLocaleString()} USDC`}</b></article>
            <article><span>Visibility</span><b>{service ? "PUBLIC" : directHire ? "PRIVATE" : visibility}</b></article>
            <article className="wide"><span>Approval</span><b>{approval || "Final approval follows the published deliverables."}</b></article>
          </section>
        </> : null}
      </div>
      <footer className="post-flow-actions">
        {step > 1 ? <button className="btn ghost" onClick={() => setStep((value) => value - 1)}><Icon name="arrowleft" size="sm" /> Back</button> : <button className="btn ghost" onClick={() => router.push("/marketplace")}>Cancel</button>}
        <span />
        {step < 4 ? <button className="btn primary" disabled={!validStep} onClick={() => setStep((value) => value + 1)}>Continue <Icon name="arrow" size="sm" /></button> : <button className="btn primary" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : !data.authenticated ? "Connect wallet and save" : service ? "Publish Service offer" : "Save funding-ready draft"}</button>}
      </footer>
    </main>
    <aside className="post-side post-live-summary">
      <span className="page-kicker">Listing summary</span>
      <h3>{title || "Your new Listing"}</h3>
      <div className="post-summary">
        <div><span>Type</span><b>{type.replace("_", " ")}</b></div>
        <div><span>{service ? "Provider places" : "People"}</span><b>{effectivePlaces}</b></div>
        <div><span>{service ? "Fixed price" : "Offer"}</span><b>{Number(amount || 0).toLocaleString()} USDC{service ? "" : " each"}</b></div>
        <div><span>{service ? "Delivery" : "Total funding"}</span><b>{service ? `${deliveryDays} day${deliveryDays === 1 ? "" : "s"}` : `${total.toLocaleString()} USDC`}</b></div>
      </div>
      <small className="post-funding-note">{service ? "The public offer never holds buyer funds. Each accepted buyer request has its own verified reserve." : "The draft cannot accept applications until its on-chain reserve is verified."}</small>
    </aside>
  </section>;
}
