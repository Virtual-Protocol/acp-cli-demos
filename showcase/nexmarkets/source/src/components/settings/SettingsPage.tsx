"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/product/Icon";
import { LoadState } from "@/components/product/LoadState";
import { useProduct } from "@/components/product/ProductProvider";

type Tab = "account" | "workspace" | "connections" | "privacy" | "accessibility";
type Modal = "profile" | "email" | "delete" | null;

function tabFromParam(value: string | null): Tab {
  return value === "workspace" || value === "connections" || value === "privacy" || value === "accessibility" ? value : "account";
}

function shortAddress(value: string | null) { return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "Not connected"; }
function object(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function applyDocumentPreference(key: "text" | "contrast" | "motion", value: string) { document.documentElement.dataset[key] = value; }

export function SettingsPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { data, loading, error, api, connectWallet, refresh, signOut, notify } = useProduct();
  const requestedTab = params.get("tab");
  const tab = tabFromParam(requestedTab);
  const [modal, setModal] = useState<Modal>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [textSize, setTextSize] = useState("default");
  const [contrast, setContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextText = localStorage.getItem("nex-text") || "default";
      const nextContrast = localStorage.getItem("nex-contrast") === "high";
      const nextMotion = localStorage.getItem("nex-motion") === "reduced";
      setTextSize(nextText); setContrast(nextContrast); setReducedMotion(nextMotion);
      applyDocumentPreference("text", nextText);
      applyDocumentPreference("contrast", nextContrast ? "high" : "normal");
      applyDocumentPreference("motion", nextMotion ? "reduced" : "full");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const settings = object(data?.user?.settings);
  const privacy = object(settings.privacy);
  const activeWorkspaceId = typeof settings.activeWorkspaceId === "string" ? settings.activeWorkspaceId : data?.workspaces[0]?.id;
  const privacyRows = [
    ["sourceVisibility", "Source visibility", "Show the public source behind every supported reputation field", privacy.sourceVisibility !== false],
    ["availabilityMatching", "Availability", "Allow approved availability to inform private matches", privacy.availabilityMatching !== false],
    ["workspaceMemory", "Workspace memory", "Let NexMind use approved context inside this workspace", privacy.workspaceMemory !== false],
    ["crossWorkspace", "Cross-workspace context", "Keep human, project and agent context separate", privacy.crossWorkspace === true],
    ["productImprovement", "Product improvement", "Share anonymised interaction quality signals", privacy.productImprovement === true],
  ] as const;
  if (loading || error || !data) return <LoadState label="Loading Settings" />;
  if (!data.authenticated || !data.user) return <section className="empty-state"><div><span className="empty-mark"><Icon name="gear" /></span><h2>Sign in to manage Settings.</h2><p>Account, connection and privacy controls belong to a verified account.</p><button className="btn primary" onClick={() => void connectWallet()}>Connect wallet</button></div></section>;

  const saveAccount = async () => {
    setBusy(true);
    try { await api("/api/v1/account", { method: "PATCH", body: JSON.stringify({ displayName, handle: handle || undefined, bio: bio || null, location: location || null }) }); await refresh(); setModal(null); notify("Account updated", "Your persisted identity details are current."); }
    catch (reason) { notify("Account not updated", reason instanceof Error ? reason.message : "Review the fields and try again."); }
    finally { setBusy(false); }
  };
  const saveSettings = async (patch: Record<string, unknown>) => {
    setBusy(true);
    try { await api("/api/v1/account", { method: "PATCH", body: JSON.stringify({ settings: { ...settings, ...patch } }) }); await refresh(); }
    catch (reason) { notify("Setting not saved", reason instanceof Error ? reason.message : "The account setting could not be persisted."); }
    finally { setBusy(false); }
  };
  const requestEmailLink = async () => {
    setBusy(true);
    try { await api("/api/v1/auth/email/request", { method: "POST", body: JSON.stringify({ email }) }); setEmailSent(true); notify("Email link sent", "Open the one-time link in the same browser to finish linking this address."); }
    catch (reason) { notify("Email link not sent", reason instanceof Error ? reason.message : "The email provider did not accept the request."); }
    finally { setBusy(false); }
  };
  const setPrivacy = (key: string, value: boolean) => void saveSettings({ privacy: { ...privacy, [key]: value } });
  const setPreference = (key: "text" | "contrast" | "motion", value: string) => {
    localStorage.setItem(`nex-${key}`, value); applyDocumentPreference(key, value);
    if (key === "text") setTextSize(value); else if (key === "contrast") setContrast(value === "high"); else setReducedMotion(value === "reduced");
  };
  const openProfile = () => {
    setDisplayName(data.user!.displayName || ""); setHandle(data.user!.handle || ""); setBio(data.user!.bio || ""); setLocation(data.user!.location || "");
    setModal("profile");
  };
  const openEmail = () => { setEmail(data.user!.email || ""); setEmailSent(false); setModal("email"); };
  const telegram = async () => {
    if (data.integrations.telegram.connected) {
      setBusy(true); try { await api("/api/v1/telegram/connect", { method: "DELETE" }); await refresh(); notify("Telegram disconnected", "In-app notifications remain available."); } catch (reason) { notify("Connection unchanged", reason instanceof Error ? reason.message : "Try again."); } finally { setBusy(false); }
    } else {
      setBusy(true); try { const result = await api<{ url: string }>("/api/v1/telegram/connect", { method: "POST", body: "{}" }); window.open(result.url, "_blank", "noopener,noreferrer"); notify("Finish in Telegram", "Open the bot link and return here after confirming the connection."); } catch (reason) { notify("Telegram unavailable", reason instanceof Error ? reason.message : "The provider could not start the connection."); } finally { setBusy(false); }
    }
  };
  const deleteAccount = async () => {
    setBusy(true); try { await api("/api/v1/account/delete", { method: "POST", body: "{}" }); window.location.assign("/dashboard"); } catch (reason) { notify("Account not deleted", reason instanceof Error ? reason.message : "Open obligations may still need to be resolved."); } finally { setBusy(false); }
  };
  const tabs: Array<[Tab, string]> = [["account", "Account"], ["workspace", "Workspace"], ["connections", "Connections"], ["privacy", "Privacy"], ["accessibility", "Accessibility"]];
  const chooseTab = (value: Tab) => router.push(value === "account" ? "/settings?tab=account" : `/settings?tab=${value}`);

  return <><header className="page-head"><div className="page-head-copy"><span className="page-kicker">Settings</span><h1>Control the experience around the work.</h1><p>Account, workspace, connection, privacy and accessibility choices remain explicit.</p></div></header><section className="utility-grid"><nav className="utility-nav">{tabs.map(([value, label]) => <button className={tab === value ? "active" : ""} key={value} onClick={() => chooseTab(value)}>{label}</button>)}</nav><div className="utility-content">
    {tab === "account" ? <><section className="settings-section"><header className="settings-head"><h2>Account</h2><p>The identity saved for this NexMarkets account.</p></header><div className="setting-row"><span className="setting-copy"><b>Name</b><span>{data.user.displayName || "Not set"}</span></span><button className="btn ghost" onClick={openProfile}>Edit</button></div><div className="setting-row"><span className="setting-copy"><b>Handle</b><span>{data.user.handle ? `@${data.user.handle}` : "No public handle"}</span></span><button className="btn ghost" onClick={openProfile}>Manage</button></div><div className="setting-row"><span className="setting-copy"><b>Email</b><span>{data.user.email || "No email connected"}</span></span><button className="btn ghost" disabled={!data.integrations.email.configured} onClick={openEmail}>{data.user.email ? "Change" : "Connect"}</button></div></section><section className="settings-section"><header className="settings-head"><h2>Session</h2><p>Control account access on this device.</p></header><div className="setting-row"><span className="setting-copy"><b>Current session</b><span>Protected by an opaque, HTTP-only session cookie</span></span><button className="btn danger" onClick={() => void signOut()}>Sign out</button></div></section></> : null}
    {tab === "workspace" ? <section className="settings-section"><header className="settings-head"><h2>Workspaces</h2><p>Only memberships returned by the account API are shown.</p></header>{data.workspaces.length ? <div className="choice-grid">{data.workspaces.map((workspace) => <button className={`choice ${workspace.id === activeWorkspaceId ? "active" : ""}`} key={String(workspace.id)} disabled={busy} onClick={() => void saveSettings({ activeWorkspaceId: workspace.id })}><b>{String(workspace.name || "Workspace")}</b><span>{String(workspace.type || workspace.role || "Member")}</span></button>)}</div> : <p>No workspace membership found.</p>}<div className="setting-row"><span className="setting-copy"><b>Default Project Vault</b><span>Use the resources attached to your selected workspace.</span></span><button className="btn ghost" onClick={() => router.push("/resources")}>Open resources</button></div></section> : null}
    {tab === "connections" ? <section className="settings-section"><header className="settings-head"><h2>Connections</h2><p>Provider state is read from the account, never from local toggles.</p></header><div className="setting-row"><span className="setting-copy"><b>X</b><span>{data.integrations.x.connected ? `@${data.reputation?.handle || data.user.handle || "account"} connected` : data.integrations.x.configured ? "Not connected" : "Provider not configured"}</span></span><button className="btn ghost" disabled={!data.integrations.x.configured} onClick={() => data.integrations.x.connected ? router.push("/reputation") : window.location.assign("/api/v1/x/connect")}>{data.integrations.x.connected ? "Review" : "Connect"}</button></div><div className="setting-row"><span className="setting-copy"><b>Wallet</b><span>{shortAddress(data.wallet.address)}</span></span><button className="btn ghost" onClick={() => data.wallet.address ? router.push("/wallet") : void connectWallet()}>{data.wallet.address ? "Manage" : "Connect"}</button></div><div className="setting-row"><span className="setting-copy"><b>Telegram</b><span>{data.integrations.telegram.connected ? "Connected" : data.integrations.telegram.configured ? "Not connected" : "Provider not configured"}</span></span><button className="btn ghost" disabled={busy || !data.integrations.telegram.configured} onClick={() => void telegram()}>{data.integrations.telegram.connected ? "Disconnect" : "Connect"}</button></div></section> : null}
    {tab === "privacy" ? <><section className="settings-section"><header className="settings-head"><h2>Privacy</h2><p>These defaults apply before individual project or NexCard choices.</p></header>{privacyRows.map(([key, title, copy, enabled]) => <div className="setting-row" key={key}><span className="setting-copy"><b>{title}</b><span>{copy}</span></span><button className={`switch ${enabled ? "on" : ""}`} disabled={busy} onClick={() => setPrivacy(key, !enabled)} aria-pressed={enabled}><i /></button></div>)}</section><section className="settings-section"><header className="settings-head"><h2>Data controls</h2><p>Exports are generated from persisted account records. Deletion is blocked while obligations remain.</p></header><div className="setting-row"><span className="setting-copy"><b>Export account data</b><span>Workspaces, sources, productions, work and reputation records.</span></span><a className="btn ghost" href="/api/v1/account/export"><Icon name="download" size="sm" /> Download export</a></div><div className="setting-row"><span className="setting-copy"><b>Delete account</b><span>Active Workrooms and unresolved payments must be resolved first.</span></span><button className="btn danger" onClick={() => setModal("delete")}>Review</button></div></section></> : null}
    {tab === "accessibility" ? <><section className="settings-section"><header className="settings-head"><h2>Text size</h2><p>Increase interface text without reducing available touch space.</p></header><div className="choice-grid">{[["default", "Default", "Balanced information density"], ["large", "Large", "One step larger throughout"], ["larger", "Larger", "Maximum supported app text"]].map(([value, label, copy]) => <button className={`choice ${textSize === value ? "active" : ""}`} key={value} onClick={() => setPreference("text", value)}><b>{label}</b><span>{copy}</span></button>)}</div></section><section className="settings-section"><header className="settings-head"><h2>Display and motion</h2><p>Keep the visual hierarchy while matching your reading and motion needs.</p></header><div className="setting-row"><span className="setting-copy"><b>Higher contrast</b><span>Strengthens dividers and secondary text.</span></span><button className={`switch ${contrast ? "on" : ""}`} onClick={() => setPreference("contrast", contrast ? "normal" : "high")} aria-pressed={contrast}><i /></button></div><div className="setting-row"><span className="setting-copy"><b>Reduce motion</b><span>Removes non-essential route, modal and live-presence movement.</span></span><button className={`switch ${reducedMotion ? "on" : ""}`} onClick={() => setPreference("motion", reducedMotion ? "full" : "reduced")} aria-pressed={reducedMotion}><i /></button></div></section></> : null}
  </div></section>
    <div className={`backdrop ${modal ? "open" : ""}`} onClick={() => setModal(null)} />
    <section className={`modal ${modal === "profile" ? "open" : ""}`} role="dialog" aria-modal="true"><header className="modal-head"><h2>Edit account</h2><button className="close-button" onClick={() => setModal(null)}><Icon name="close" size="sm" /></button></header><div className="modal-body"><div className="post-fields"><div className="field"><label>Name</label><input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></div><div className="field"><label>Handle</label><input className="input" value={handle} onChange={(event) => setHandle(event.target.value.replace(/^@/, ""))} /></div><div className="field full"><label>Bio</label><textarea className="textarea" value={bio} onChange={(event) => setBio(event.target.value)} /></div><div className="field full"><label>Location</label><input className="input" value={location} onChange={(event) => setLocation(event.target.value)} /></div></div></div><footer className="modal-actions"><button className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy || displayName.trim().length < 2} onClick={() => void saveAccount()}>{busy ? "Saving…" : "Save account"}</button></footer></section>
    <section className={`modal ${modal === "email" ? "open" : ""}`} role="dialog" aria-modal="true"><header className="modal-head"><h2>{emailSent ? "Check your email" : "Connect recovery email"}</h2><button className="close-button" onClick={() => setModal(null)}><Icon name="close" size="sm" /></button></header><div className="modal-body">{emailSent ? <p>A one-time link was sent to <b>{email}</b>. It expires in 15 minutes.</p> : <div className="field"><label>Email address</label><input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>}</div><footer className="modal-actions"><button className="btn ghost" onClick={() => setModal(null)}>{emailSent ? "Done" : "Cancel"}</button>{!emailSent ? <button className="btn primary" disabled={busy || !/^\S+@\S+\.\S+$/.test(email)} onClick={() => void requestEmailLink()}>{busy ? "Sending…" : "Send verification link"}</button> : null}</footer></section>
    <section className={`modal ${modal === "delete" ? "open" : ""}`} role="dialog" aria-modal="true"><header className="modal-head"><h2>Delete account</h2><button className="close-button" onClick={() => setModal(null)}><Icon name="close" size="sm" /></button></header><div className="modal-body"><p>Deletion removes account identity and revokes sessions. It will not proceed while active Workrooms or unresolved payments remain.</p></div><footer className="modal-actions"><button className="btn ghost" onClick={() => setModal(null)}>Keep account</button><button className="btn danger" disabled={busy} onClick={() => void deleteAccount()}>{busy ? "Checking obligations…" : "Delete account"}</button></footer></section>
  </>;
}
