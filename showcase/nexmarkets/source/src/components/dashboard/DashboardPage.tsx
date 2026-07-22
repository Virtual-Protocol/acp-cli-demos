"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { EmptyState, LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";
import { formatDate } from "@/components/product/format";
import { reputationData } from "@/components/reputation/reputation-data";

export function DashboardPage() {
  const router = useRouter();
  const { data, loading, error, notify, setConnectWalletOpen } = useProduct();
  const [activityFilter, setActivityFilter] = useState<"all" | "studio" | "work" | "money">("all");

  if (loading || error || !data) return <LoadState />;
  if (!data.authenticated) return <GuestStart />;

  const name = data.user?.displayName || data.user?.handle || "there";
  const usdcVal = data.wallet?.usdcAtomic ? parseFloat(data.wallet.usdcAtomic) / 1000000 : 0.00;
  const nexVal = data.wallet?.nexAtomic ? parseFloat(data.wallet.nexAtomic) / 1000000 : 0;
  const walletConnected = data.wallet?.address !== null && data.wallet?.address !== undefined;

  const userId = data.user?.id;
  const hiringActive = data.workrooms.filter(w => w.founderUserId === userId && ["FUNDED", "ASSIGNED", "ACCEPTED", "DELIVERED", "APPROVED", "DISPUTED"].includes(w.status));
  const hiringEscrow = hiringActive.reduce((sum, w) => sum + (w.listing?.budgetAtomic ? parseFloat(w.listing.budgetAtomic) : 0), 0) / 1e6;
  const doingActive = data.workrooms.filter(w => w.workerUserId === userId && ["FUNDED", "ASSIGNED", "ACCEPTED", "DELIVERED", "APPROVED", "DISPUTED"].includes(w.status));
  const doingEscrow = doingActive.reduce((sum, w) => sum + (w.listing?.budgetAtomic ? parseFloat(w.listing.budgetAtomic) : 0), 0) / 1e6;
  const inEscrowVal = hiringEscrow + doingEscrow;

  const completedWork = data.workrooms.filter(w => w.workerUserId === userId && ["RELEASED", "COMPLETED"].includes(w.status));
  const earnedVal = completedWork.reduce((sum, w) => sum + (w.listing?.budgetAtomic ? parseFloat(w.listing.budgetAtomic) : 0), 0) / 1e6;

  const pendingActive = data.workrooms.filter(w => w.workerUserId === userId && ["APPROVED", "DELIVERED"].includes(w.status));
  const pendingVal = pendingActive.reduce((sum, w) => sum + (w.listing?.budgetAtomic ? parseFloat(w.listing.budgetAtomic) : 0), 0) / 1e6;

  const creationRows = data.creations.slice(0, 3).map((item) => ({
    id: item.id,
    group: "studio" as const,
    icon: "studio" as const,
    eyebrow: "Studio",
    title: item.title,
    copy: item.headline || item.status,
    meta: item.edited || "Recently",
    status: item.status || item.state,
    action: "Open",
    onClick: () => router.push(`/studio/${item.id}`),
  }));

  const workRows = data.myWork.slice(0, 5).map((item) => {
    const listingSlug = item.listingId ? data.listings.find((listing) => listing.id === item.listingId)?.slug : null;
    return {
      id: item.id,
      group: "work" as const,
      icon: item.route === "workroom" ? ("workroom" as const) : ("market" as const),
      eyebrow: item.side === "doing" ? "Your application" : (item.side === "offering" ? "Active delivery" : "Posted by you"),
      title: item.title,
      copy: item.detail,
      meta: item.submitted || "Recently",
      status: item.status,
      action: "Open",
      onClick: () => {
        if (item.route === "workroom") {
          router.push(`/workrooms/${item.entityId}`);
        } else {
          router.push(listingSlug ? `/marketplace/${listingSlug}` : "/marketplace?tab=my-work");
        }
      },
    };
  });

  const cardReady = data.integrations?.x?.connected || false;
  const cardTitle = cardReady ? "NexCard version 02" : "NexCard not created";
  const cardCopy = cardReady ? "Public profile live · 3 relevant opportunities" : "Connect X to build your card and public profile.";

  const connectedReputation = {
    id: "reputation-status",
    group: "reputation" as const,
    icon: "reputation" as const,
    eyebrow: "NexCard",
    title: cardReady ? "Your public profile is live" : "Your NexCard has not been created",
    copy: cardCopy,
    meta: cardReady ? "Updated 2 days ago" : "Not started",
    status: cardReady ? "Public" : "Set up",
    action: cardReady ? "View profile" : "Create",
    onClick: () => router.push("/reputation"),
  };

  const allRows = [...creationRows, ...workRows, connectedReputation];

  const hasWork = data.myWork.length > 0;

  const rowsToRender = allRows;
  const filteredRows = rowsToRender.filter(
    (row) => activityFilter === "all" || row.group === activityFilter
  );

  const nextActivity = rowsToRender[0] || null;

  function dashboardGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  // Creations Card Stats
  const producingCount = data.creations.filter(c => c.state === 'production').length;
  const draftsCount = data.creations.filter(c => c.state === 'draft').length;
  const readyCount = data.creations.filter(c => c.state === 'completed' || c.state === 'review').length;

  const firstCreation = data.creations[0];
  const renderWorkList = () => {
    if (hasWork) {
      return data.myWork.slice(0, 3).map((item) => {
        const initials = item.side?.slice(0, 2).toUpperCase() || "WK";
        const sideLabel = item.side === "doing" ? "Your application" : (item.side === "offering" ? "Active delivery" : "Posted by you");
        const listingSlug = item.listingId ? data.listings.find((listing) => listing.id === item.listingId)?.slug : null;
        return (
          <button key={item.id} onClick={() => {
            if (item.route === "workroom") {
              router.push(`/workrooms/${item.entityId}`);
            } else {
              router.push(listingSlug ? `/marketplace/${listingSlug}` : "/marketplace?tab=my-work");
            }
          }}>
            <i>{initials}</i>
            <span>
              <small>{sideLabel}</small>
              <b>{item.title}</b>
              <em>{item.detail}</em>
            </span>
            <strong>{item.status}</strong>
          </button>
        );
      });
    }

    return (
      <div className="market-empty" style={{ padding: "20px 10px", textAlign: "center" }}>
        <h2>No active work found.</h2>
        <p style={{ color: "var(--muted-2)", fontSize: "11px", margin: 0 }}>Browse marketplace listings or post a new request.</p>
      </div>
    );
  };

  const avatarLetters = data.user?.displayName
    ? data.user.displayName.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : (data.user?.handle?.slice(0, 2).toUpperCase() || "KM");
  const userName = data.user?.displayName || data.user?.handle || "Kamli Mary";

  return (
    <section className="account-dashboard">
      <header className="account-dashboard-head">
        <div className="account-dashboard-intro">
          <span className="page-kicker">Dashboard</span>
          <h1>{dashboardGreeting()}, {name}.</h1>
          <p>
            {nextActivity
              ? `${nextActivity.title} · ${nextActivity.copy}`
              : "Your account is ready. Start a creation, post work or build your NexCard."}
          </p>
        </div>
        <aside className="balance-brief">
          <span>Available balance</span>
          <div>
            <strong>{walletConnected ? usdcVal.toFixed(2) : "—"}</strong>
            <small>USDC</small>
          </div>
          <button
            className="btn text"
            onClick={() => setConnectWalletOpen(true)}
          >
            {walletConnected ? "Refresh wallet" : "Connect wallet"} <Icon name="arrow" size="sm" />
          </button>
        </aside>
      </header>

      <nav className="account-actions" aria-label="Start in NexMarkets">
        <button onClick={() => router.push("/studio?mode=video")}>
          <i><Icon name="play" size="sm" /></i>
          <span>Create video</span>
        </button>
        <button onClick={() => router.push("/studio?mode=infographic")}>
          <i><Icon name="studio" size="sm" /></i>
          <span>Create infographic</span>
        </button>
        <button onClick={() => router.push("/marketplace/post")}>
          <i><Icon name="plus" size="sm" /></i>
          <span>Post work</span>
        </button>
        <button onClick={() => router.push("/marketplace?tab=discover")}>
          <i><Icon name="search" size="sm" /></i>
          <span>Find work</span>
        </button>
        <button onClick={() => router.push("/reputation")}>
          <i><Icon name="reputation" size="sm" /></i>
          <span>Open NexCard</span>
        </button>
      </nav>

      <div className="account-dashboard-grid">
        <main className="account-dashboard-main">
          <section className="dashboard-surface activity-surface">
            <header className="surface-head">
              <div>
                <h2>Your activity</h2>
              </div>
              <nav className="activity-filters" aria-label="Filter account activity">
                {(["all", "studio", "work", "money"] as const).map((filterVal) => (
                  <button
                    key={filterVal}
                    className={activityFilter === filterVal ? "active" : ""}
                    onClick={() => setActivityFilter(filterVal)}
                  >
                    {filterVal.charAt(0).toUpperCase() + filterVal.slice(1)}
                  </button>
                ))}
              </nav>
            </header>
            <div className="account-activity-list">
              {filteredRows.length > 0 ? (
                filteredRows.map((item) => (
                  <article className="account-activity-row" key={item.id}>
                    <i className="activity-mark"><Icon name={item.icon} size="sm" /></i>
                    <span className="activity-copy">
                      <small>{item.eyebrow}</small>
                      <b>{item.title}</b>
                      <span>{item.copy}</span>
                    </span>
                    <span className="activity-state">
                      <b>{item.status}</b>
                      <small>{item.meta}</small>
                    </span>
                    <button className="btn text activity-action" onClick={item.onClick}>
                      {item.action} <Icon name="arrow" size="sm" />
                    </button>
                  </article>
                ))
              ) : (
                <div className="market-empty">
                  <h2>No activity matches this filter.</h2>
                  <p>Your creations and work records will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <div className="dashboard-work-grid">
            <section className="dashboard-surface studio-summary-card">
              <header className="surface-head compact">
                <div>
                  <span className="surface-kicker">Studio</span>
                  <h2>Your creations</h2>
                </div>
                <button className="btn text" onClick={() => router.push("/studio")}>
                  View Studio <Icon name="arrow" size="sm" />
                </button>
              </header>
              {firstCreation ? (
              <button className="studio-current" onClick={() => router.push(`/studio/${firstCreation.id}`)}>
                  <span className="studio-current-frame">
                    <small>{firstCreation.type?.toUpperCase() || "PRODUCT FILM"}</small>
                    <b>{firstCreation.headline || firstCreation.title}</b>
                    <i><Icon name="play" /></i>
                  </span>
                  <span className="studio-current-copy">
                    <small>{firstCreation.status}</small>
                    <b>{firstCreation.title}</b>
                    <span>{firstCreation.format || "Recently edited"}</span>
                  </span>
                </button>
              ) : (
                <div className="studio-current empty-creations-placeholder" style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: "40px 20px", textAlign: "center", background: "rgba(255,255,255,0.01)", border: "1px dashed var(--line)", borderRadius: "14px", margin: "0 16px" }}>
                  <i style={{ color: "var(--gold)", fontSize: "28px", marginBottom: "12px" }}><Icon name="studio" size="lg" /></i>
                  <b style={{ fontSize: "14px", display: "block", marginBottom: "6px" }}>No creations yet</b>
                  <p style={{ color: "var(--muted-2)", fontSize: "11px", margin: 0, maxWidth: "240px" }}>Use NexStudios to generate videos and infographics for your products.</p>
                </div>
              )}
              <div className="compact-stats">
                <div>
                  <span>Producing</span>
                  <b>{producingCount}</b>
                </div>
                <div>
                  <span>Drafts</span>
                  <b>{draftsCount}</b>
                </div>
                <div>
                  <span>Ready</span>
                  <b>{readyCount}</b>
                </div>
              </div>
              <div className="surface-actions">
                <button className="btn primary" onClick={() => router.push(firstCreation ? `/studio/${firstCreation.id}` : "/studio")}>
                  Review version
                </button>
                <button className="btn ghost" onClick={() => router.push("/studio?mode=video")}>
                  New creation
                </button>
              </div>
            </section>

            <section className="dashboard-surface work-summary-card">
              <header className="surface-head compact">
                <div>
                  <span className="surface-kicker">Marketplace</span>
                  <h2>Your work</h2>
                </div>
                <button className="btn text" onClick={() => router.push("/marketplace?tab=my-work")}>
                  Open My work <Icon name="arrow" size="sm" />
                </button>
              </header>
              <div className="work-summary-list">
                {renderWorkList()}
              </div>
              <div className="surface-actions">
                <button className="btn primary" onClick={() => router.push("/marketplace/post")}>
                  Post work
                </button>
                <button className="btn ghost" onClick={() => router.push("/marketplace?tab=discover")}>
                  Find work
                </button>
              </div>
            </section>
          </div>
        </main>

        <aside className="account-dashboard-rail">
          <section className="dashboard-surface money-summary-card">
            <header className="surface-head compact">
              <div>
                <span className="surface-kicker">Money</span>
                <h2>Balance and earnings</h2>
              </div>
              <button className="btn text" onClick={() => router.push("/wallet")}>
                Open wallet
              </button>
            </header>
            <div className="money-available">
              <span>Available</span>
              <strong>{walletConnected ? usdcVal.toFixed(2) : "0.00"}</strong>
              <small>USDC</small>
            </div>
             <div className="money-lines">
               <div>
                 <span>Earned</span>
                 <b>{earnedVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>
               </div>
               <div>
                 <span>In escrow</span>
                 <b>{inEscrowVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>
               </div>
               <div>
                 <span>Pending release</span>
                 <b>{pendingVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</b>
               </div>
             </div>
            <div className="surface-actions">
              <button className="btn primary" onClick={() => notify("Add Funds", "Use the connect/funding options in settings or wallet to fund your account.")}>
                Add funds
              </button>
              <button className="btn ghost" onClick={() => router.push("/wallet")}>
                Transactions
              </button>
            </div>
          </section>

          <section className="dashboard-surface nexcard-summary-card">
            <header className="surface-head compact">
              <div>
                <span className="surface-kicker">Reputation</span>
                <h2>Your NexCard</h2>
              </div>
              <button className="btn text" onClick={() => router.push("/reputation")}>
                Open
              </button>
            </header>
            <div className="dashboard-nexcard-preview">
              <div className="dashboard-card-avatar">{avatarLetters}</div>
              <div>
                <small>{cardReady ? "PUBLIC NEXCARD" : "NEXCARD"}</small>
                <b>{userName}</b>
                <span>{data.reputation ? (reputationData(data.reputation).identity.description || "No description set") : "No connected accounts · Build your NexCard reputation profile"}</span>
              </div>
              <i className={cardReady ? "ready" : ""}>
                {cardReady ? <Icon name="check" size="sm" /> : "—"}
              </i>
            </div>
            <div className="card-state-copy">
              <b>{cardTitle}</b>
              <span>{cardCopy}</span>
            </div>
            <div className="card-benefit-line">
              <i><Icon name="reputation" size="sm" /></i>
              <span>
                <b>{nexVal.toLocaleString()} NEX detected</b>
                <small>
                  {cardReady
                    ? "Live refinement is available."
                    : "Live refinement becomes available after your base card."}
                </small>
              </span>
            </div>
            <div className="surface-actions">
              {cardReady ? (
                <>
                  <button className="btn primary" onClick={() => router.push(`/reputation`)}>
                    View profile
                  </button>
                  <button className="btn ghost" onClick={() => router.push("/reputation")}>
                    Edit card
                  </button>
                </>
              ) : (
                <button className="btn primary full" onClick={() => router.push("/reputation")}>
                  Create NexCard
                </button>
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function GuestStart() {
  const router = useRouter();
  const { data } = useProduct();
  if (!data) return null;
  return (
    <section className="guest-start">
      <header className="guest-hero">
        <span className="page-kicker">NexMarkets</span>
        <h1>What do you need to get done?</h1>
        <p>Choose the work in front of you. Sign in only when it is time to save, fund, publish or apply.</p>
      </header>
      <section className="guest-route-grid">
        <button className="guest-route" onClick={() => router.push("/studio")}>
          <i><Icon name="studio" size="lg" /></i>
          <span>
            <small>Create media</small>
            <h2>Create a video or make information visual.</h2>
            <b>Open Studio <Icon name="arrow" size="sm" /></b>
          </span>
        </button>
        <button className="guest-route" onClick={() => router.push("/reputation")}>
          <i><Icon name="reputation" size="lg" /></i>
          <span>
            <small>Build reputation</small>
            <h2>Turn your X history into a reputation people can use.</h2>
            <b>Create your NexCard <Icon name="arrow" size="sm" /></b>
          </span>
        </button>
        <button className="guest-route" onClick={() => router.push("/marketplace")}>
          <i><Icon name="market" size="lg" /></i>
          <span>
            <small>Find or offer work</small>
            <h2>Browse opportunities, post work or offer a service.</h2>
            <b>Explore Marketplace <Icon name="arrow" size="sm" /></b>
          </span>
        </button>
      </section>
      <div className="section-top">
        <h2>Open work</h2>
        <span>Browse every Listing without signing in</span>
      </div>
      {data.listings.length ? (
        <section className="guest-listings">
          {data.listings.slice(0, 3).map((item) => (
            <button key={item.id} className="guest-listing" onClick={() => router.push(`/marketplace/${item.slug}`)}>
              <i>{item.type.slice(0, 2).toUpperCase()}</i>
              <span>
                <small>{item.type} · {item.owner}</small>
                <b>{item.title}</b>
                <em>{item.skills.slice(0, 3).join(" · ") || item.outcome}</em>
              </span>
              <strong>{item.budget}<small>{formatDate(item.deadline)}</small></strong>
            </button>
          ))}
        </section>
      ) : (
        <EmptyState
          icon="market"
          title="No open work yet."
          text="Funded public Listings will appear here as soon as they are published."
          action={<button className="btn ghost" onClick={() => router.push("/marketplace")}>Open Marketplace</button>}
        />
      )}
      <section className="guest-showcase">
        <div>
          <div className="section-top">
            <h2>Made in Studio</h2>
            <button className="btn text" onClick={() => router.push("/studio")}>
              Open Studio <Icon name="arrow" size="sm" />
            </button>
          </div>
          <div className="market-empty">
            <h2>No public Studio work yet.</h2>
            <p>Published creations will appear here when their owners make them public.</p>
          </div>
        </div>
        <aside className="guest-card-sample">
          <span className="page-kicker">Public NexCard</span>
          <div className="sample-person">
            <i>NC</i>
            <span>
              <b>Your professional signal</b>
              <small>Built from verified public evidence</small>
            </span>
          </div>
          <p>NexCard turns public X work into evidence-led reputation while keeping private context under your control.</p>
          <div className="card-tags">
            <span>Product storytelling</span>
            <span>Launch direction</span>
            <span>Explainer video</span>
          </div>
          <button className="btn ghost full" onClick={() => router.push("/reputation")}>
            See how Reputation works
          </button>
        </aside>
      </section>
    </section>
  );
}
