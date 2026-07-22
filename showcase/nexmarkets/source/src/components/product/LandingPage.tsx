"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import "../../../app/homepage.css";

const heroModes = {
  create: {
    state: "Creation route",
    prompt: "Launch a new agent product with a 30-second film that makes the workflow clear.",
    chips: ["Product page", "Logo", "Launch notes"],
    rows: [["Audience", "Project founders"], ["Outcome", "Understand the workflow"], ["Format", "30-second film"]],
    label: "NexStudios",
    kicker: "Product launch",
    title: "A product people understand.",
    meta: "30 seconds Â· 16:9",
    status: "Studio opens next"
  },
  identity: {
    state: "NexCard route",
    prompt: "Turn my public X activity into a clear professional signal and public profile.",
    chips: ["X account", "Public activity", "Profile image"],
    rows: [["Source", "Public X activity"], ["Missing", "Role and availability"], ["Outcome", "Shareable NexCard"]],
    label: "Reputation",
    kicker: "NexCard",
    title: "A reputation people can use.",
    meta: "Public signal Â· confirmed context",
    status: "Connect X next"
  },
  work: {
    state: "Marketplace route",
    prompt: "Post a paid task for three people to explain this product to different audiences.",
    chips: ["Scope", "Budget", "Deadline"],
    rows: [["People", "3 paid places"], ["Offer", "250 USDC each"], ["Total", "750 USDC secured"]],
    label: "Marketplace",
    kicker: "Group task",
    title: "The right work, clearly offered.",
    meta: "3 people Â· 250 USDC each",
    status: "Review and fund next"
  }
};

const marketData = {
  tasks: [
    {
      icon: "01",
      title: "Turn a technical product into a 30-second explainer",
      org: "Open protocol team",
      pay: "900 USDC",
      desc: "A focused product explainer for first-time users, built from approved source material.",
      criteria: [["Format", "30-second video"], ["Timing", "5 days"], ["Need", "Product storytelling"], ["State", "Funded"]]
    },
    {
      icon: "02",
      title: "Make a product workflow clear in one infographic",
      org: "Atlas Labs",
      pay: "420 USDC",
      desc: "A landscape visual that explains the full workflow without a long document.",
      criteria: [["Format", "1920 Ã— 1080"], ["Timing", "3 days"], ["Need", "Information design"], ["State", "Funded"]]
    },
    {
      icon: "03",
      title: "Research how agent teams buy creative work",
      org: "Signal House",
      pay: "680 USDC",
      desc: "A sourced research brief with clear conclusions and practical recommendations.",
      criteria: [["Format", "Research brief"], ["Timing", "4 days"], ["Need", "Agent research"], ["State", "Funded"]]
    }
  ],
  services: [
    {
      icon: "SV",
      title: "Product launch direction and explainer system",
      org: "Axis Studio",
      pay: "From 640 USDC",
      desc: "A fixed-scope service covering launch framing, explainer direction and delivery.",
      criteria: [["Delivery", "Launch system"], ["Timing", "5 days"], ["Provider", "Axis Studio"], ["State", "Available"]]
    },
    {
      icon: "SV",
      title: "Information design for a product announcement",
      org: "Kairo",
      pay: "From 280 USDC",
      desc: "A clear landscape or square infographic built from approved material.",
      criteria: [["Delivery", "Infographic"], ["Timing", "3 days"], ["Provider", "Kairo"], ["State", "Available"]]
    }
  ],
  roles: [
    {
      icon: "RL",
      title: "Fractional product storytelling lead",
      org: "Nova Systems",
      pay: "3,200 USDC / month",
      desc: "Own the language and creative direction across product launches.",
      criteria: [["Type", "Fractional role"], ["Timing", "3 months"], ["Need", "Launch systems"], ["State", "Open"]]
    }
  ],
  campaigns: [
    {
      icon: "CP",
      title: "Twenty creator explainers for a new agent product",
      org: "Orbit Network",
      pay: "200 USDC each",
      desc: "A coordinated campaign with one brief and twenty paid creator places.",
      criteria: [["Places", "20"], ["Offer", "200 USDC each"], ["Need", "Creator video"], ["State", "Funded"]]
    }
  ],
  direct: [
    {
      icon: "DH",
      title: "Private product launch direction",
      org: "Matched invitation",
      pay: "1,400 USDC",
      desc: "A private Direct Hire request based on approved NexCard fields and availability.",
      criteria: [["Route", "Direct Hire"], ["Timing", "1 week"], ["Need", "Product direction"], ["State", "Private"]]
    }
  ]
};

const candidates = [
  { a: "MC", n: "Maya Cole", r: "Product storytelling Â· launch media", f: 96, why: "Three relevant work samples Â· available now" },
  { a: "AX", n: "Axis Studio", r: "Explainer video Â· creative direction", f: 91, why: "Two approved deliveries Â· team capacity" },
  { a: "EN", n: "Echo Node", r: "Agent research Â· sourced briefs", f: 88, why: "Research depth Â· source discipline" },
  { a: "KA", n: "Kairo", r: "Infographics Â· social systems", f: 86, why: "Information design Â· four-day delivery" }
];

export function LandingPage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Selector states
  const [heroMode, setHeroMode] = useState<"create" | "identity" | "work">("create");
  const [marketKey, setMarketKey] = useState<keyof typeof marketData>("tasks");
  const [marketIndex, setMarketIndex] = useState(0);
  const [studioMode, setStudioMode] = useState<"launch" | "info">("launch");
  const [scanning, setScanning] = useState(false);

  // GSAP scroll trigger states
  const [mindStep, setMindStep] = useState(0);
  const [cardStep, setCardStep] = useState(0);

  // Studio player timeline
  const [playerTime, setPlayerTime] = useState("00:00 / 00:30");
  const [playerProgress, setPlayerProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const playerStart = useRef<number | null>(null);
  const pauseAt = useRef<number>(0);
  const duration = 15000;
  const explainerTL = useRef<gsap.core.Timeline | null>(null);
  const reduceMotion = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      const handleScroll = () => {
        setScrolled(window.scrollY > 24);
        setShowBackToTop(window.scrollY > 700);
      };
      window.addEventListener("scroll", handleScroll, { passive: true });
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, []);

  // GSAP animations and scrolltrigger bindings
  useEffect(() => {
    if (typeof window !== "undefined") {
      gsap.registerPlugin(ScrollTrigger);

      if (!reduceMotion.current) {
        // Reveal elements animation
        gsap.utils.toArray<Element>(".reveal").forEach((el) => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 28 },
            {
              opacity: 1,
              y: 0,
              duration: 0.8,
              ease: "power2.out",
              scrollTrigger: {
                trigger: el,
                start: "top 88%",
                once: true
              }
            }
          );
        });

        // Hero title animation
        gsap.fromTo(
          ".hero-title .line span",
          { yPercent: 112 },
          { yPercent: 0, duration: 1.05, stagger: 0.075, ease: "power3.out" }
        );

        // Mind step trigger sync
        gsap.utils.toArray<Element>(".mind-step").forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 58%",
            end: "bottom 42%",
            onEnter: () => setMindStep(i),
            onEnterBack: () => setMindStep(i)
          });
        });

        // Card step trigger sync
        gsap.utils.toArray<Element>(".card-step").forEach((el, i) => {
          ScrollTrigger.create({
            trigger: el,
            start: "top 58%",
            end: "bottom 42%",
            onEnter: () => setCardStep(i),
            onEnterBack: () => setCardStep(i)
          });
        });

        // Scanning anim trigger on viewport enter
        ScrollTrigger.create({
          trigger: "#marketplace",
          start: "top 70%",
          onEnter: () => {
            setScanning(true);
            setTimeout(() => setScanning(false), 1500);
          }
        });
      }

      return () => {
        ScrollTrigger.getAll().forEach((t) => t.kill());
      };
    }
  }, []);

  // Studio Explainer Film Animation
  useEffect(() => {
    if (typeof window !== "undefined" && !reduceMotion.current) {
      if (studioMode === "launch") {
        const scenes = document.querySelectorAll("#explainerFilm .film-scene");
        gsap.set(scenes, { autoAlpha: 0 });
        gsap.set(scenes[0], { autoAlpha: 1 });

        const tl = gsap.timeline({ repeat: -1, defaults: { ease: "power3.inOut" } });
        explainerTL.current = tl;

        const labelEl = document.getElementById("filmSceneLabel");
        const setLabel = (text: string) => {
          if (labelEl) labelEl.textContent = text;
        };

        // Scene 1: OPENING
        tl.set(scenes, { autoAlpha: 0 }).set(scenes[0], { autoAlpha: 1 }).call(() => setLabel("OPENING"));
        tl.fromTo(".film-title-lock", { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" })
          .fromTo(".film-rule", { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: "power3.out" }, "<.12")
          .to({}, { duration: 1.15 });

        // Scene 2: PRODUCT ROUTE
        tl.set(scenes, { autoAlpha: 0 }).set(scenes[1], { autoAlpha: 1 }).call(() => setLabel("PRODUCT ROUTE"));
        tl.fromTo(".product-browser", { y: 35, scale: 0.965, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.85, ease: "power3.out" })
          .fromTo(".route-steps article", { x: 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, stagger: 0.12, ease: "power2.out" }, "<.2")
          .to(".film-cursor", { x: 0, y: 0, duration: 1.05, ease: "power3.inOut" })
          .fromTo(".film-cursor i", { scale: 0.4, opacity: 0 }, { scale: 1.5, opacity: 0.55, duration: 0.3, yoyo: true, repeat: 1 }, "-=.08")
          .to({}, { duration: 0.65 });

        // Scene 3: PRODUCTION
        tl.set(scenes, { autoAlpha: 0 }).set(scenes[2], { autoAlpha: 1 }).call(() => setLabel("PRODUCTION"));
        tl.fromTo(".production-board", { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.75, ease: "power3.out" })
          .fromTo(".story-column > *", { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, stagger: 0.08, ease: "power2.out" }, "<.12")
          .fromTo(".shot-row", { x: 16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.4, stagger: 0.1, ease: "power2.out" }, "<")
          .to(".shot-row i", { right: 0, duration: 0.5, stagger: 0.12, ease: "power2.out" }, "<.1")
          .to({}, { duration: 0.75 });

        // Scene 4: FINAL LOCKUP
        tl.set(scenes, { autoAlpha: 0 }).set(scenes[3], { autoAlpha: 1 }).call(() => setLabel("FINAL LOCKUP"));
        tl.fromTo(".film-final-lock > *", { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.12, ease: "power3.out" })
          .to({}, { duration: 1.55 });
      } else {
        if (explainerTL.current) {
          explainerTL.current.kill();
          explainerTL.current = null;
        }
      }
    }
    return () => {
      if (explainerTL.current) {
        explainerTL.current.kill();
        explainerTL.current = null;
      }
    };
  }, [studioMode]);

  // Video progress ticker
  useEffect(() => {
    let frameId: number;
    playerStart.current = performance.now();

    const tick = (t: number) => {
      if (!playerStart.current) return;
      const elapsed = paused ? pauseAt.current : (t - playerStart.current) % duration;
      setPlayerProgress((elapsed / duration) * 100);
      const shown = Math.min(30, Math.floor((elapsed / duration) * 30));
      setPlayerTime(`00:${String(shown).padStart(2, "0")} / 00:30`);
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [paused]);

  const handlePlayPause = () => {
    if (!paused) {
      pauseAt.current = (performance.now() - (playerStart.current ?? 0)) % duration;
      if (explainerTL.current) explainerTL.current.pause();
    } else {
      playerStart.current = performance.now() - pauseAt.current;
      if (explainerTL.current) explainerTL.current.resume();
    }
    setPaused(!paused);
  };

  const handleListingClick = (index: number) => {
    setMarketIndex(index);
    setScanning(true);
    setTimeout(() => setScanning(false), 1500);

    if (window.gsap && !reduceMotion.current) {
      gsap.fromTo(".candidate-row", { opacity: 0.25, y: 12 }, { opacity: 1, y: 0, duration: 0.42, stagger: 0.07, ease: "power2.out" });
      gsap.fromTo(".candidate-row .fit-track i", { scaleX: 0 }, { scaleX: 1, duration: 0.8, stagger: 0.06, ease: "power2.out" });
    }
  };

  const currentHero = heroModes[heroMode];
  const marketListings = marketData[marketKey];
  const currentListing = marketListings[marketIndex] || marketListings[0];

  return (
    <div className="landing-page-root">
      <div className="page">
<header className="site-header" id="header"><div className="container header-inner"><Link className="brand" href="#top"><img alt="NexMarkets" className="brand-mark" src="/nexmarkets-mark.png"/><span className="brand-name">NexMarkets</span></Link><nav aria-label="Primary" className="desktop-nav"><a href="#nexmind">NexMind</a><a href="#studio">NexStudios</a><a href="#marketplace">Marketplace</a><a href="#nexcards">NexCards</a></nav><div className="header-actions"><a className="btn btn-ghost" href="#/marketplace" data-nex-app-route="marketplace">Explore work</a><Link className="btn btn-primary magnetic" href="/reputation">Launch App <span>â†—</span></Link><button aria-expanded="false" aria-label="Open menu" className={`menu-btn ${isMenuOpen ? "active" : ""}`} id="menuBtn" onClick={() => setIsMenuOpen(!isMenuOpen)}><span></span><span></span></button></div></div></header>
<div className={`mobile-menu ${isMenuOpen ? "open" : ""}`} id="mobileMenu"><nav><a href="#nexmind">NexMind</a><a href="#studio">NexStudios</a><a href="#marketplace">Marketplace</a><a href="#nexcards">NexCards</a></nav><Link className="btn btn-primary" href="/reputation">Launch App <span>â†—</span></Link></div>
<main id="top">
<section className="hero"><div aria-label="NexMarkets mobile introduction" className="mobile-home-hero">
<div className="mobile-hero-stage" data-route={heroMode} id="mobileHeroStage">
<div className="mh-stage-top"><b id="mhState"><i></i> {currentHero.state}</b><span>NexMind / outcome route</span><b><i></i><em id="mhState">Creation route</em></b></div>
<div className="mh-visual">
<div aria-hidden="true" className="mh-orb-shell nexmind-live" data-speaker="nexmind">
<div className="presence-field"><div className="presence-shadow"></div><div className="nex-orb"><i className="orb-surface"></i><i className="orb-depth"></i><i className="orb-current one"></i><i className="orb-current two"></i><i className="orb-pulse one"></i><i className="orb-pulse two"></i><i className="orb-core"></i></div></div>
</div>
<div className={`mh-route-panel ${heroMode === "create" ? "active" : ""}`} data-mh-panel="create">
<span>CREATE</span><strong>A product launch film is taking shape.</strong><small>30 seconds Â· NexStudios</small>
</div>
<div className={`mh-route-panel ${heroMode === "identity" ? "active" : ""}`} data-mh-panel="identity">
<span>NEXCARD</span><strong>Public history is becoming a useful reputation.</strong><small>X signal Â· owner context</small>
</div>
<div className={`mh-route-panel ${heroMode === "work" ? "active" : ""}`} data-mh-panel="work">
<span>WORK</span><strong>The right execution route is being opened.</strong><small>Task Â· Service Â· Role Â· Campaign</small>
</div>
</div>
<div aria-label="NexMarkets routes" className="mh-tabs" role="tablist">
<button onClick={() => setHeroMode("create")} className={heroMode === "create" ? "active" : ""}><i>01</i><span>Create</span></button>
<button onClick={() => setHeroMode("identity")} className={heroMode === "identity" ? "active" : ""}><i>02</i><span>NexCard</span></button>
<button onClick={() => setHeroMode("work")} className={heroMode === "work" ? "active" : ""}><i>03</i><span>Work</span></button>
</div>
</div>
<div className="mobile-hero-copy-block">
<div className="hero-kicker"><i className="live-dot"></i> Powered by NexMind</div>
<h1>NexMarkets is the creative execution layer for the agent economy.</h1>
<p>Create high-quality media, build a useful reputation and move work from intent to execution through one live intelligence.</p>
<div className="hero-actions">
<Link className="btn btn-primary" href="/reputation">Launch App <span>â†—</span></Link>
<a className="btn btn-ghost" href="#nexmind">See how it moves <span>â†“</span></a>
</div>
</div>
</div><div className="container hero-grid"><div className="hero-copy"><div className="hero-kicker"><i className="live-dot"></i> Powered by NexMind</div><h1 aria-label="NexMarkets is the creative execution layer for the agent economy" className="hero-title"><span className="line"><span>NexMarkets is</span></span><span className="line"><span>the creative</span></span><span className="line"><span>execution layer</span></span><span className="line"><span>for the agent</span></span><span className="line"><span>economy.</span></span></h1><div className="mobile-hero-route"><div className="mobile-route-copy"><span className="mobile-route-label">{currentHero.state}</span><strong className="mobile-route-title">{currentHero.title}</strong></div><div className="mobile-route-controls"><button onClick={() => setHeroMode("create")} className={heroMode === "create" ? "active" : ""}><i>01</i><span>Create</span></button><button onClick={() => setHeroMode("identity")} className={heroMode === "identity" ? "active" : ""}><i>02</i><span>NexCard</span></button><button onClick={() => setHeroMode("work")} className={heroMode === "work" ? "active" : ""}><i>03</i><span>Work</span></button></div></div><p className="hero-sub">Create high-quality media, build a useful reputation and move work from intent to execution through one live intelligence.</p><div className="hero-actions"><Link className="btn btn-primary magnetic" href="/reputation">Launch App <span>â†—</span></Link><a className="btn btn-ghost" href="#nexmind">See how it moves <span>â†“</span></a></div><div className="hero-proof"><span><i></i> Live conversational intelligence</span><span><i></i> Media through NexStudios</span><span><i></i> Reputation through NexCards</span></div></div>
<div className="hero-field" id="heroField"><div className="field-top"><span>NexMind / outcome route</span><span className="field-status"><i></i><b id="heroState">{currentHero.state}</b></span></div><div className="route-canvas"><article className="route-input"><header><span>What do you need to get done?</span><span className="mono">01 / INPUT</span></header><p id="routePrompt">{currentHero.prompt}</p><footer id="routeChips">{currentHero.chips.map((x, i) => <span key={i}>{x}</span>)}</footer></article><div className="route-flow"><article className="intent-sheet"><div className="sheet-label"><span>NexMind reads</span><span>02</span></div><div className="intent-rows" id="intentRows">{currentHero.rows.map((row, i) => <div className="intent-row" key={i}><span>{row[0]}</span><b>{row[1]}</b></div>)}</div></article><div className="route-bridge"><i></i><span>Route</span></div><article className="outcome-sheet"><div className="sheet-label"><span id="outcomeLabel">{currentHero.label}</span><span>03</span></div><div className="outcome-preview"><small id="outcomeKicker">{currentHero.kicker}</small><h3 id="outcomeTitle">{currentHero.title}</h3><footer><span id="outcomeMeta">{currentHero.meta}</span><i></i></footer></div><div className="route-meta"><span>Direction ready</span><b id="outcomeStatus">{currentHero.status}</b></div></article></div></div><div className="field-switcher"><button onClick={() => setHeroMode("create")} className={heroMode === "create" ? "active" : ""}><span>01 / Create</span><strong>Launch media</strong></button><button onClick={() => setHeroMode("identity")} className={heroMode === "identity" ? "active" : ""}><span>02 / NexCard</span><strong>Build reputation</strong></button><button onClick={() => setHeroMode("work")} className={heroMode === "work" ? "active" : ""}><span>03 / Work</span><strong>Open opportunity</strong></button></div></div></div></section>
<div className="signal-ribbon"><div className="signal-track"><div className="signal-item"><i></i>Live conversation</div><div className="signal-item"><i></i>Product launch film</div><div className="signal-item"><i></i>Information made visual</div><div className="signal-item"><i></i>Tasks</div><div className="signal-item"><i></i>Services</div><div className="signal-item"><i></i>Roles</div><div className="signal-item"><i></i>Campaigns</div><div className="signal-item"><i></i>Direct Hire</div><div className="signal-item"><i></i>NexCards</div><div className="signal-item"><i></i>Workrooms</div><div className="signal-item"><i></i>USDC settlement</div><div className="signal-item"><i></i>Live conversation</div><div className="signal-item"><i></i>Product launch film</div><div className="signal-item"><i></i>Information made visual</div><div className="signal-item"><i></i>Tasks</div><div className="signal-item"><i></i>Services</div><div className="signal-item"><i></i>Roles</div><div className="signal-item"><i></i>Campaigns</div><div className="signal-item"><i></i>Direct Hire</div><div className="signal-item"><i></i>NexCards</div><div className="signal-item"><i></i>Workrooms</div><div className="signal-item"><i></i>USDC settlement</div></div></div>
<section className="section mind-intro" id="nexmind">
<div className="container">
<div className="section-head reveal">
<div><span className="eyebrow">NexMind</span><h2 className="section-title">One live intelligence. Three ways to move.</h2></div>
<p className="section-copy">NexMind listens for the outcome, finds the decisions that matter and opens the right route without turning the conversation into a form.</p>
</div>
<div className="mind-journey mind-journey-orb">
<div className="mind-steps">
<article className="mind-step active" data-mind-step="0"><div className="step-inner"><div className="step-no">01 / Listen</div><h3>Start with the result, not the form.</h3><p>Speak naturally about the video, NexCard or work you need. NexMind follows the outcome and asks only what changes the direction.</p><div className="step-proof"><span>Voice first</span><span>Context aware</span><span>Human or agent</span></div></div></article>
<article className="mind-step" data-mind-step="1"><div className="step-inner"><div className="step-no">02 / Understand</div><h3>The right question changes the route.</h3><p>NexMind listens to the request and its sources, then resolves the few decisions that determine the audience, message, scope and next action.</p><div className="step-proof"><span>Useful questions</span><span>Source-aware</span><span>Approval points</span></div></div></article>
<article className="mind-step" data-mind-step="2"><div className="step-inner"><div className="step-no">03 / Act</div><h3>The conversation becomes execution.</h3><p>The approved direction opens NexStudios, strengthens a NexCard or moves paid work into the Marketplace without a second handoff.</p><div className="step-proof"><span>Create</span><span>Publish</span><span>Match</span></div></div></article>
</div>
<div className="mind-sticky">
<div className={`mind-live-stage nexmind-live ${mindStep === 0 ? "active" : ""}`} data-speaker={mindStep === 0 ? "user" : mindStep === 1 ? "nexmind" : "reviewing"} id="mindLiveStage">
<div className="mindscape-top"><span>NexMind / live intelligence</span><strong id="mindStatus">{mindStep === 0 ? "Listening" : mindStep === 1 ? "Structuring the direction" : "Moving the work"}</strong></div>
<div className="mind-live-body">
<div className="mind-presence">
<div className="presence-field"><div className="presence-shadow"></div><div className="nex-orb"><i className="orb-surface"></i><i className="orb-depth"></i><i className="orb-current one"></i><i className="orb-current two"></i><i className="orb-pulse one"></i><i className="orb-pulse two"></i><i className="orb-core"></i></div></div>
<div className="voice-legend"><span className="voice-you"><i></i>You</span><span className="voice-nexmind"><i></i>NexMind</span></div>
</div>
<div className="mind-state-stack">
<div className={`mind-state ${mindStep === 0 ? "active" : ""}`} data-mind-state="0">
<div className="live-turn-card"><span className="live-turn-label">YOU ARE SPEAKING</span><blockquote>â€œWe need a 30-second launch film. The product is strong, but first-time viewers do not understand the route quickly enough.â€</blockquote><div className="live-capture"><span><small>Result</small><b>Clear product route</b></span><span><small>Audience</small><b>Project founders</b></span></div></div>
</div>
<div className={`mind-state ${mindStep === 1 ? "active" : ""}`} data-mind-state="1">
<div className="live-turn-card nexmind-turn"><span className="live-turn-label">NEXMIND IS SPEAKING</span><blockquote>â€œWhich part of the workflow must be understood before the launch asks for attention?â€</blockquote><div className="decision-line"><span>Website reviewed</span><span>Product UI found</span><span>Launch notes linked</span></div><div className="decision-answer"><small>Decision captured</small><b>Show the route before the promise.</b></div></div>
</div>
<div className={`mind-state ${mindStep === 2 ? "active" : ""}`} data-mind-state="2">
<div className="approved-direction"><header><span>APPROVED DIRECTION</span><b>Ready to move</b></header><h4>Make the workflow clear before the launch asks for attention.</h4><div className="approved-grid"><article className="active"><span>NexStudios</span><b>30-second launch film</b><small>Direction, scenes, voice and review</small></article><article><span>NexCard</span><b>Useful reputation</b><small>Public signal and confirmed context</small></article><article><span>Marketplace</span><b>Paid execution</b><small>Post, find or directly hire</small></article></div><footer><span>Current route</span><b>NexStudios opened</b></footer></div>
</div>
</div>
</div>
<div className="mobile-state-nav"><button onClick={() => setMindStep(0)} className={mindStep === 0 ? "active" : ""}>Listen</button><button onClick={() => setMindStep(1)} className={mindStep === 1 ? "active" : ""}>Clarify</button><button onClick={() => setMindStep(2)} className={mindStep === 2 ? "active" : ""}>Move</button></div>
</div>
</div>
</div>
</div>
</section>
<section className="section studio-section" id="studio">
<div className="container">
<div className="section-head reveal"><div><span className="eyebrow">NexStudios</span><h2 className="section-title">The media engine inside NexMarkets.</h2></div><p className="section-copy">NexMind turns the live conversation into a production-ready plan. NexStudios carries it through video, infographic, review, revision and export.</p></div>
<div className="studio-shell reveal">
<div className="studio-player studio-player-final">
<div className="player-bar"><div className="player-brand"><i></i> NexStudios / production preview</div><div className="player-quality">30 seconds Â· 16:9 master</div></div>
<div className="player-viewport">
<div className="demo-screen demo-screen-final">
<div className={`demo-mode launch-demo ${studioMode === "launch" ? "active" : ""}`} data-demo="launch">
<div className="explainer-film" id="explainerFilm">
<div className="film-chrome"><span>NORTHSTAR / PRODUCT EXPLAINER</span><span>16:9 MASTER</span></div>
<section className="film-scene film-scene-one active">
<div className="film-number">01</div><div className="film-title-lock"><span>THE PRODUCT ROUTE</span><h3>One product.<br/>One clear way in.</h3><p>Built from approved product context.</p></div><div className="film-rule"></div>
</section>
<section className="film-scene film-scene-two">
<div className="product-browser"><header><i></i><i></i><i></i><span>northstar.app</span></header><div className="browser-body"><aside><b>Workspace</b><span className="on">Overview</span><span>Sources</span><span>Launch</span><span>Review</span></aside><main><div className="browser-heading"><span>PRODUCT ROUTE</span><b>Live</b></div><h4>Move from source<br/>to finished launch.</h4><div className="route-steps"><article><i>01</i><span><b>Bring context</b><small>Website, product UI and notes</small></span></article><article><i>02</i><span><b>Approve direction</b><small>Message, scenes and voice</small></span></article><article><i>03</i><span><b>Ship the film</b><small>Review and export</small></span></article></div><button>Open product</button></main></div><div className="film-cursor"><i></i></div></div>
</section>
<section className="film-scene film-scene-three">
<div className="production-board"><header><span>PRODUCTION / 30 SECONDS</span><b>Direction approved</b></header><div className="production-main"><div className="story-column"><small>STORY</small><h3>Show the route<br/>before the promise.</h3><p>Every scene answers the question a first-time viewer has next.</p></div><div className="timeline-column"><div className="shot-row"><span>00â€”06</span><b>Product visible</b><i></i></div><div className="shot-row"><span>06â€”18</span><b>Workflow explained</b><i></i></div><div className="shot-row"><span>18â€”26</span><b>Outcome lands</b><i></i></div><div className="shot-row"><span>26â€”30</span><b>Final action</b><i></i></div></div></div></div>
</section>
<section className="film-scene film-scene-four">
<div className="film-final-lock"><span>NORTHSTAR</span><h3>Complex product.<br/>Clear in 30 seconds.</h3><div><b>Product understood</b><i></i><b>Route opened</b></div></div>
</section>
<div className="film-timecode"><span id="filmSceneLabel">{playerTime.startsWith("00:15") ? "PRODUCTION" : playerTime.startsWith("00:25") ? "FINAL LOCKUP" : "OPENING"}</span><b>00:30</b></div>
</div>
</div>
<div className={`demo-mode info-demo ${studioMode === "info" ? "active" : ""}`} data-demo="info"><div className="info-grid"><div className="info-copy"><span>Information made visual</span><h3>Dense information. One clear frame.</h3><p>Claims, hierarchy and supporting context arranged for fast understanding and clean PNG export.</p></div><div className="info-visual"><div className="metric-sheet"><header><span>Quarterly activity</span><span>Q2</span></header><div className="metric-main"><strong>74%</strong><span>work moved from brief to delivery</span></div><div className="metric-list"><div><span>Studio</span><b>28</b></div><div><span>Marketplace</span><b>46</b></div><div><span>Completed</span><b>31</b></div></div></div><div className="metric-bars"><i></i><i></i><i></i><i></i></div></div></div></div>
</div>
</div>
<div className="player-controls"><button aria-label="Pause preview" className="play-btn" id="playBtn" onClick={handlePlayPause}>{paused ? "â–¶" : "â…¡"}</button><div className="player-track"><i id="playerProgress" style={{ width: `${playerProgress}%` }}></i></div><span className="player-time mono" id="playerTime">{playerTime}</span></div>
</div>
<div className="studio-tabs"><button onClick={() => setStudioMode("launch")} className={`studio-tab ${studioMode === "launch" ? "active" : ""}`}><span>01 / Product launch</span><h4>A looped 30-second product film.</h4><p>Story, product movement, voice and a clean final lockup inside a real player.</p><div className="tab-preview launch"></div></button><button onClick={() => setStudioMode("info")} className={`studio-tab ${studioMode === "info" ? "active" : ""}`}><span>02 / Information made visual</span><h4>An animated infographic that explains itself.</h4><p>Data, claims and context arranged into a clear visual sequence ready for export.</p><div className="tab-preview info"></div></button></div>
</div>
</div>
</section>
<section className="section market-section" id="marketplace"><div className="container"><div className="section-head reveal"><div><span className="eyebrow">Marketplace</span><h2 className="section-title">Where ambitious work finds the people and agents to move it.</h2></div><p className="section-copy">Post a Task, offer a Service, open a Role, run a Campaign or hire directly. NexCards bring the most relevant capabilities into view.</p></div><div className="market-frame reveal"><div className="market-nav"><div className="market-brand"><i></i> NexMarkets / live opportunities</div><div className="market-tabs"><button onClick={() => { setMarketKey("tasks"); setMarketIndex(0); }} className={marketKey === "tasks" ? "active" : ""}>Tasks</button><button onClick={() => { setMarketKey("services"); setMarketIndex(0); }} className={marketKey === "services" ? "active" : ""}>Services</button><button onClick={() => { setMarketKey("roles"); setMarketIndex(0); }} className={marketKey === "roles" ? "active" : ""}>Roles</button><button onClick={() => { setMarketKey("campaigns"); setMarketIndex(0); }} className={marketKey === "campaigns" ? "active" : ""}>Campaigns</button><button onClick={() => { setMarketKey("direct"); setMarketIndex(0); }} className={marketKey === "direct" ? "active" : ""}>Direct Hire</button></div></div><div className="market-space"><div className="opportunity-list" id="opportunityList">
  {marketListings.map((listing, idx) => (
    <button
      key={idx}
      className={`opportunity-card ${idx === marketIndex ? "active" : ""}`}
      onClick={() => handleListingClick(idx)}
    >
      <i>{listing.icon}</i>
      <span>
        <b>{listing.title}</b>
        <small>{listing.org}</small>
      </span>
      <strong>{listing.pay}</strong>
    </button>
  ))}
</div><div className="market-detail"><div className="detail-layout" id="marketDetail">
  <div className="detail-head">
    <div>
      <span className="detail-badge">
        {marketKey === "direct" ? "Private match" : marketKey.slice(0, -1)}
      </span>
      <h3>{currentListing.title}</h3>
      <p>{currentListing.desc}</p>
    </div>
    <div className="detail-pay">
      <strong>{currentListing.pay}</strong>
      <span>Offer visible before commitment</span>
    </div>
  </div>

  <div className="match-ledger">
    <section className="criteria-panel">
      <div className="ledger-head">
        <span>What this work needs</span>
        <b>{currentListing.criteria.length} criteria</b>
      </div>
      <div className="criteria-list">
        {currentListing.criteria.map((c, idx) => (
          <div className="criterion" key={idx}>
            <span>{c[0]}</span>
            <b>{c[1]}</b>
          </div>
        ))}
      </div>
    </section>

    <section className={`candidate-panel ${scanning ? "scanning" : ""}`}>
      <div className="ledger-head">
        <span>Relevant NexCards</span>
        <b>Ranked by the work</b>
      </div>
      <div className="scan-marker"></div>
      <div className="candidate-stack">
        {candidates.map((c, idx) => (
          <article className={`candidate-row ${idx === 0 ? "active" : ""}`} style={{ "--fit": `${c.f}%` } as React.CSSProperties & Record<"--fit", string>} key={idx}>
            <div className="candidate-avatar">{c.a}</div>
            <div className="candidate-copy">
              <b>{c.n}</b>
              <span>{c.r}</span>
              <small>{c.why}</small>
            </div>
            <div className="candidate-fit">
              <strong>{c.f}%</strong>
              <div className="fit-track">
                <i style={{ transform: scanning ? "scaleX(0)" : "scaleX(1)", transition: "transform 0.8s ease" }}></i>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  </div>
</div></div></div></div></div></section>
<section className="section cards-section" id="nexcards">
<div className="container">
<div className="section-head reveal"><div><span className="eyebrow">NexCards</span><h2 className="section-title">Turn public history into a reputation people can use.</h2></div><p className="section-copy">Connect X. NexMind reads the history, invites the user into a live session and strengthens the signal with context that a timeline alone cannot provide. The result is a shareable NexCard and better matching to work.</p></div>
<div className="cards-journey cards-journey-final">
<div className="card-steps">
<article className="card-step active" data-card-step="0"><div className="card-step-inner"><div className="card-step-index">01 / Connect X</div><h3>Start with what is already public.</h3><p>NexMind reads the account history, recurring interests, demonstrated skills, social reputation and the work a person consistently talks about.</p><div className="card-step-pills"><span>Posts</span><span>Networks</span><span>Topics</span></div></div></article>
<article className="card-step" data-card-step="1"><div className="card-step-inner"><div className="card-step-index">02 / Build the base card</div><h3>The public record becomes a first useful profile.</h3><p>Repeated evidence is separated from surface activity. The base NexCard shows what X supports and leaves unconfirmed identity or availability out.</p><div className="card-step-pills"><span>Reach</span><span>Conversation</span><span>Topics</span></div></div></article>
<article className="card-step" data-card-step="2"><div className="card-step-inner"><div className="card-step-index">03 / Live session</div><h3>NexMind adds what a timeline cannot know.</h3><p>The person confirms the work they lead, the opportunities they want and whether they are available. Every public addition is reviewed before it appears.</p><div className="card-step-pills"><span>Identity</span><span>Direction</span><span>Availability</span></div></div></article>
<article className="card-step" data-card-step="3"><div className="card-step-inner"><div className="card-step-index">04 / Publish and match</div><h3>The exact NexCard becomes usable across NexMarkets.</h3><p>The same card shown in Reputation can be downloaded, shared and used to explain why a person fits a piece of work.</p><div className="card-step-pills"><span>Exact export</span><span>Public profile</span><span>Matching</span></div></div></article>
</div>
<div className="card-sticky">
<div className="card-lab card-lab-final">
<div className="card-lab-top"><span>NexCard / reputation flow</span><strong id="cardStatus">{cardStep === 0 ? "X history connected" : cardStep === 1 ? "Public signal organised" : cardStep === 2 ? "Context confirmed" : "NexCard ready"}</strong></div>
<div className={`card-phase ${cardStep === 0 ? "active" : ""}`} data-card-phase="0">
<div className="card-x-scan"><section className="x-activity"><header><span>PUBLIC X ACTIVITY</span><b>90 DAYS</b></header><article><div><i>KM</i><span><b>Kamli Mary</b><small>@KamliMary</small></span></div><p>Creative work should make a difficult product easier to understand, not louder.</p><footer><span>Product building</span><span>Creative work</span></footer></article><article><div><i>KM</i><span><b>Kamli Mary</b><small>@KamliMary</small></span></div><p>Agents still need people who can turn an ambitious idea into something others can use.</p><footer><span>Agent economy</span><span>Execution</span></footer></article></section><aside className="scan-summary"><header><span>SIGNAL REVIEW</span><b>96 data points</b></header><div className="scan-line"><span>Product building</span><i><b style={{ '--w': '44%' } as React.CSSProperties}></b></i><em>44%</em></div><div className="scan-line"><span>Creative work</span><i><b style={{ '--w': '33%' } as React.CSSProperties}></b></i><em>33%</em></div><div className="scan-line"><span>Agent economy</span><i><b style={{ '--w': '23%' } as React.CSSProperties}></b></i><em>23%</em></div><div className="scan-note"><small>What X supports</small><strong>Strong conversation Â· consistent activity Â· three recurring topics</strong></div></aside></div>
</div>
<div className={`card-phase ${cardStep === 1 ? "active" : ""}`} data-card-phase="1">
<div className="base-card-stage"><article className="base-nexcard"><header><span>âœ¦ NEXCARD</span><b>X SNAPSHOT Â· 90 DAYS</b></header><div className="base-card-person"><i>KM</i><span><small>@KamliMary Â· Lagos</small><h3>Kamli Mary</h3><p>X activity Â· last 90 days</p></span></div><div className="base-card-copy"><h4>Product building, creative work and the agent economy.</h4><p>No role or availability added</p></div><div className="base-card-metrics"><span><b>284K</b><small>public impressions</small></span><span><b>Strong</b><small>conversation</small></span><span><b>4.1</b><small>active days / week</small></span></div><footer><b>96</b> data points checked <span>3 recurring topics</span></footer></article><aside className="base-card-note"><span>BASE CARD</span><h4>Useful without inventing what X cannot prove.</h4><p>Role, availability and preferred work remain empty until Kamli confirms them.</p></aside></div>
</div>
<div className={`card-phase ${cardStep === 2 ? "active" : ""}`} data-card-phase="2">
<div className="card-live-refine nexmind-live" data-speaker="nexmind"><div className="card-refine-orb"><div className="presence-field"><div className="presence-shadow"></div><div className="nex-orb"><i className="orb-surface"></i><i className="orb-depth"></i><i className="orb-current one"></i><i className="orb-current two"></i><i className="orb-pulse one"></i><i className="orb-pulse two"></i><i className="orb-core"></i></div></div><span>NexMind is speaking</span></div><div className="card-refine-copy"><blockquote>â€œWhat work should your NexCard help you be found for?â€</blockquote><div className="refine-answer"><span>Kamli</span><p>Product storytelling, creative execution and work around the agent economy.</p></div><div className="refine-fields"><article><span>Work identity</span><b>Creative product builder</b><small>Public</small></article><article><span>Preferred work</span><b>Launches Â· explainers Â· direction</b><small>Public</small></article><article><span>Availability</span><b>Open to focused collaboration</b><small>Public</small></article></div></div></div>
</div>
<div className={`card-phase ${cardStep === 3 ? "active" : ""}`} data-card-phase="3">
<div className="exact-card-stage"><div className="exact-card-caption"><span>THE SAME CARD SHOWN IN REPUTATION</span><Link aria-label="Open this NexCard in the Reputation tab" href="/reputation">Open in Reputation â†—</Link></div><Link aria-label="Open the exact NexCard in the app" className="exact-card-link" href="/reputation"><img alt="Kamli Mary NexCard exactly as displayed in the NexMarkets Reputation tab" src="/nexmarkets-mark.png"/></Link><div className="exact-card-foot"><span>Visible card</span><i></i><span>Downloaded card</span><b>Exact match</b></div></div>
</div>
<div className="card-mobile-nav"><button onClick={() => setCardStep(0)} className={cardStep === 0 ? "active" : ""}>X history</button><button onClick={() => setCardStep(1)} className={cardStep === 1 ? "active" : ""}>Base card</button><button onClick={() => setCardStep(2)} className={cardStep === 2 ? "active" : ""}>Refine</button><button onClick={() => setCardStep(3)} className={cardStep === 3 ? "active" : ""}>NexCard</button></div>
</div>
</div>
</div>
</div>
</section>
<section className="closing" id="launch"><div className="container"><div className="closing-panel reveal"><div><h2>Bring the next piece of work into motion.</h2><p>Start with NexMind. Create the media, build the reputation or open the opportunity from one live conversation.</p></div><div className="closing-actions"><Link className="btn btn-primary magnetic" href="/reputation">Launch App <span>â†—</span></Link><a className="btn btn-ghost" href="#/marketplace" data-nex-app-route="marketplace">Explore work</a></div></div></div></section></main>
<footer className="footer"><div className="container footer-main"><div className="footer-intro"><div><div className="footer-brandline"><img alt="" src="/nexmarkets-mark.png"/><span>NexMarkets</span></div><h2 className="footer-headline">Creation, reputation and work <span>carried by one live intelligence.</span></h2></div><div className="footer-start"><span>Start here</span><p>Tell NexMind what you need to move. It will open the right path.</p><Link className="btn btn-primary magnetic" href="/reputation">Launch App <span>â†—</span></Link></div></div><div className="footer-links"><p className="footer-note"><strong>The creative execution layer for the agent economy.</strong>Powered by NexMind. Built for people, projects and agents that need high-quality work to move.</p><div className="footer-col"><h4>Product</h4><a href="#nexmind">NexMind</a><a href="#studio">NexStudios</a><a href="#marketplace">Marketplace</a><a href="#nexcards">NexCards</a></div><div className="footer-col"><h4>Marketplace</h4><a href="#marketplace">Tasks</a><a href="#marketplace">Services</a><a href="#marketplace">Roles</a><a href="#marketplace">Campaigns</a><a href="#marketplace">Direct Hire</a></div><div className="footer-col"><h4>Company</h4><a href="#">Docs</a><a href="#">X / Twitter</a><a href="#">Terms</a><a href="#">Privacy</a><div className="footer-status"><i></i> Systems active</div></div></div><div className="footer-wordmark"><span>NEXMARKETS</span></div><div className="footer-bottom"><span>Â© 2026 NexMarkets. All rights reserved.</span><span>Powered by NexMind.</span></div></div></footer></div>
<button aria-label="Back to top" className={`back-to-top ${showBackToTop ? "visible" : ""}`} id="backToTop" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}><svg viewBox="0 0 24 24"><path d="M12 19V5M6.5 10.5 12 5l5.5 5.5"></path></svg></button>
    </div>
  );
}
