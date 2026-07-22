import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Activity,
  Archive,
  Blocks,
  Bot,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Github,
  Globe2,
  LockKeyhole,
  LogIn,
  Menu,
  Monitor,
  MonitorUp,
  Newspaper,
  NotebookPen,
  RadioTower,
  RefreshCw,
  Router,
  Send,
  Smartphone,
  SquareTerminal,
  Trophy,
  Twitter,
  Upload,
  Users,
  X,
} from "lucide-react";
import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { githubBase, systemBySlug, systems, type SystemPage } from "./siteData";

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "hello@example.com";
const contactEndpoint = import.meta.env.VITE_CONTACT_FORM_ENDPOINT || "";
const githubUrl = import.meta.env.VITE_GITHUB_URL || githubBase;
const xUrl = import.meta.env.VITE_X_URL || "https://x.com/TanukiLabsAI";
const demoBaseUrl = import.meta.env.VITE_DEMO_BASE_URL || "";
const communityEndpoint = import.meta.env.VITE_COMMUNITY_API_BASE || "/api/community";

type AgentContext = {
  page: string;
  summary: string;
  facts: string[];
  links?: Record<string, string>;
};

type CommunityCampaign = {
  id: string;
  type: "survey" | "event" | "contest";
  title: string;
  summary: string;
  closesAt?: string | null;
  questions: string[];
};

const homeContext: AgentContext = {
  page: "PocketFlow home",
  summary: "PocketFlow is a phone-first, local-first AI operating shell by Tanuki Labs. It turns ordinary Android phones into personal control rooms for models, automations, research, files, and team workflows.",
  facts: [
    "The public repository contains 12 sanitized systems.",
    "PocketFlow is designed for ordinary, reused Android hardware.",
    "Every teammate can personalize workflows while sharing one operating spine.",
    "Routine work stays local when possible; stronger reasoning is routed only when needed.",
  ],
  links: { repository: githubUrl, llms: "/llms.txt" },
};

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, "") || "/");

  useEffect(() => {
    const update = () => setPath(window.location.pathname.replace(/\/+$/, "") || "/");
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);

  const navigate = (next: string) => {
    if (next === path) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.history.pushState({}, "", next);
    setPath(next);
    window.scrollTo({ top: 0 });
  };

  return { path, navigate };
}

function useScrollProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const available = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(available > 0 ? window.scrollY / available : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return progress;
}

function useReveal() {
  useEffect(() => {
    const nodes = [...document.querySelectorAll<HTMLElement>("[data-reveal]")];
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      nodes.forEach((node) => node.dataset.visible = "true");
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  });
}

function AgentBrief({ context }: { context: AgentContext }) {
  useEffect(() => {
    document.title = context.page === "PocketFlow home"
      ? "PocketFlow | AI belongs in your pocket"
      : `${context.page} | PocketFlow`;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = context.summary;

    const id = "pocketflow-route-schema";
    document.getElementById(id)?.remove();
    const script = document.createElement("script");
    script.id = id;
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": context.page === "PocketFlow home" ? "SoftwareApplication" : "WebPage",
      name: context.page,
      description: context.summary,
      keywords: context.facts,
      url: window.location.href,
      isPartOf: { "@type": "WebSite", name: "PocketFlow", url: window.location.origin },
      ...(context.links ? { sameAs: Object.values(context.links) } : {}),
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [context]);

  return (
    <aside className="agent-brief" data-agent-readable="true" data-agent-page={context.page} hidden>
      <h2>{context.page}</h2>
      <p>{context.summary}</p>
      <ul>{context.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>
      {context.links && <pre>{JSON.stringify(context.links, null, 2)}</pre>}
    </aside>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? "brand--compact" : ""}`} aria-label="PocketFlow">
      <span className="brand__mark" aria-hidden="true"><span>P</span></span>
      <span className="brand__word">PocketFlow</span>
    </span>
  );
}

function SiteLink({ to, navigate, className, children, onClick }: {
  to: string;
  navigate: (path: string) => void;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}

function Header({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [open, setOpen] = useState(false);
  const progress = useScrollProgress();

  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <header className="site-header">
        <SiteLink to="/" navigate={navigate} className="site-header__brand"><Brand compact /></SiteLink>
        <nav className="desktop-nav" aria-label="Primary navigation">
          <SiteLink to="/systems" navigate={navigate} className={path.startsWith("/systems") ? "is-active" : ""}>Systems</SiteLink>
          <a href="/#philosophy" onClick={(event) => {
            if (path === "/") return;
            event.preventDefault();
            navigate("/");
            window.setTimeout(() => document.getElementById("philosophy")?.scrollIntoView(), 40);
          }}>Why PocketFlow</a>
          <SiteLink to="/community" navigate={navigate} className={path.startsWith("/community") ? "is-active" : ""}>Join us</SiteLink>
          <SiteLink to="/contact" navigate={navigate} className={path === "/contact" ? "is-active" : ""}>Contact</SiteLink>
          <a className="nav-source" href={githubUrl} target="_blank" rel="noreferrer">Source <ExternalLink size={14} /></a>
        </nav>
        <button className="menu-button" type="button" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((value) => !value)}>
          {open ? <X /> : <Menu />}
        </button>
        <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${progress})` }} />
      </header>
      {open && (
        <div className="mobile-menu">
          <SiteLink to="/systems" navigate={navigate} onClick={() => setOpen(false)}>Systems <ArrowRight /></SiteLink>
          <SiteLink to="/" navigate={navigate} onClick={() => setOpen(false)}>Why PocketFlow <ArrowRight /></SiteLink>
          <SiteLink to="/community" navigate={navigate} onClick={() => setOpen(false)}>Join our community <ArrowRight /></SiteLink>
          <SiteLink to="/contact" navigate={navigate} onClick={() => setOpen(false)}>Contact <ArrowRight /></SiteLink>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub <ExternalLink /></a>
        </div>
      )}
    </>
  );
}

function Footer({ navigate }: { navigate: (path: string) => void }) {
  return (
    <footer className="site-footer">
      <div className="footer__top">
        <Brand />
        <p>Personal intelligence.<br />Shared momentum.</p>
      </div>
      <div className="footer__links">
        <div>
          <span>Explore</span>
          <SiteLink to="/systems" navigate={navigate}>All systems</SiteLink>
          <SiteLink to="/community" navigate={navigate}>Join our community</SiteLink>
          <SiteLink to="/community/contest" navigate={navigate}>Monthly contest</SiteLink>
          <SiteLink to="/contact" navigate={navigate}>Contact</SiteLink>
          <a href="/llms.txt">For AI agents</a>
        </div>
        <div>
          <span>Connect</span>
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          <a href={xUrl} target="_blank" rel="noreferrer">X</a>
          <a href="https://www.tanukilabs.fun" target="_blank" rel="noreferrer">Tanuki Labs</a>
        </div>
      </div>
      <div className="footer__legal">
        <small>Tanuki Corporation</small>
        <small>PocketFlow public competition edition</small>
        <small>© {new Date().getFullYear()} All rights reserved.</small>
      </div>
    </footer>
  );
}

function PageShell({ path, navigate, context, children }: {
  path: string;
  navigate: (path: string) => void;
  context: AgentContext;
  children: ReactNode;
}) {
  useReveal();
  return (
    <div className="site-shell">
      <AgentBrief context={context} />
      <Header path={path} navigate={navigate} />
      <main>{children}</main>
      <Footer navigate={navigate} />
    </div>
  );
}

function PhoneArtwork({ system, priority = false }: { system: SystemPage; priority?: boolean }) {
  if (!system.image) return <WebMonitorPhone />;
  return (
    <figure className="phone-artwork" data-phone-artwork>
      <img src={system.image} alt={`${system.name} running inside the PocketFlow Android shell`} loading={priority ? "eager" : "lazy"} />
    </figure>
  );
}

function SystemIcon({ slug }: { slug: string }) {
  switch (slug) {
    case "router-systemmap": return <Router />;
    case "baloss-llm": return <BrainCircuit />;
    case "builder": return <Blocks />;
    case "archive-reader": return <Archive />;
    case "memopad-calenotes": return <NotebookPen />;
    case "newsflow": return <Newspaper />;
    case "notebook-agent": return <Bot />;
    case "codex-relay": return <RadioTower />;
    case "screen-relay": return <MonitorUp />;
    case "terminal": return <SquareTerminal />;
    case "pocketweb": return <Globe2 />;
    case "web-monitor": return <Activity />;
    default: return <Monitor />;
  }
}

function WebMonitorPhone() {
  return (
    <figure className="phone-artwork phone-artwork--synthetic" aria-label="Web Monitor inside an Android phone shell">
      <div className="android-device">
        <div className="android-device__speaker" />
        <div className="monitor-screen">
          <div className="monitor-screen__bar">
            <button aria-label="Back"><ArrowLeft size={15} /></button>
            <div className="monitor-screen__title"><Globe2 size={20} /><span>Public Monitor<small>PocketFlow web app</small></span></div>
            <button aria-label="Refresh"><RefreshCw size={15} /></button>
            <button className="cyan" aria-label="Open externally"><ExternalLink size={15} /></button>
          </div>
          <div className="monitor-screen__canvas">
            <div className="monitor-kicker">SYSTEM STATUS</div>
            <div className="monitor-orbit"><span /></div>
            <h3>Everything<br />in sight.</h3>
            <div className="monitor-status"><i /> PUBLIC TARGET ONLINE</div>
            <div className="monitor-lines"><span /><span /><span /><span /></div>
          </div>
        </div>
      </div>
    </figure>
  );
}

function HomePage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  return (
    <PageShell path={path} navigate={navigate} context={homeContext}>
      <section className="home-hero">
        <div className="home-hero__copy">
          <div className="hero-kicker"><span /> A local AI operating shell</div>
          <h1><span>Pocket</span><span>Flow</span></h1>
          <p>AI belongs in your pocket.</p>
          <div className="hero-actions">
            <SiteLink to="/systems" navigate={navigate} className="button button--light">Explore the systems <ArrowRight /></SiteLink>
            <a href={githubUrl} target="_blank" rel="noreferrer" className="button button--ghost"><Github /> View source</a>
          </div>
        </div>
        <div className="home-hero__device">
          <img className="home-hero__network" src="/hero-pocketflow-network.png" alt="PocketFlow network connecting a collection of phone-based AI workspaces" fetchPriority="high" />
        </div>
        <a href="#philosophy" className="scroll-cue" aria-label="Scroll to learn more"><ArrowDown /></a>
      </section>

      <section className="manifesto" id="philosophy">
        <p className="section-label" data-reveal>Why we built it</p>
        <h2 data-reveal>The cloud made intelligence scalable.<br /><strong>We make it personal.</strong></h2>
        <p className="manifesto__copy" data-reveal>PocketFlow turns ordinary Android phones into local AI control rooms. Models, automations, files, research, relays, and daily work live in one system that belongs to the person holding it.</p>
      </section>

      <section className="democracy-band">
        <div className="democracy-band__statement" data-reveal>
          <span>01 / AI democracy</span>
          <h2>Useful intelligence should not require expensive hardware, a permanent cloud connection, or someone else’s workflow.</h2>
        </div>
        <div className="democracy-band__metrics" data-reveal>
          <div><strong>2</strong><span>new every month</span></div>
          <div><strong>1</strong><span>shared spine</span></div>
          <div><strong>Any</strong><span>spare Android</span></div>
        </div>
      </section>

      <section className="hardware-story">
        <div className="hardware-story__copy" data-reveal>
          <span className="section-label">Built for the phone you already have</span>
          <h2>Small hardware.<br />Serious agency.</h2>
          <p>A second-hand phone can become a private model interface, an automation dashboard, a team relay, and a portable memory layer. Local-first by design. Cloud-capable by choice.</p>
        </div>
        <div className="hardware-story__object" data-reveal>
          <div className="phone-silhouette"><span>POCKETFLOW</span><i /><b>LOCAL</b></div>
          <div className="hardware-note hardware-note--one"><span>01</span> Reused hardware</div>
          <div className="hardware-note hardware-note--two"><span>02</span> Personal models</div>
          <div className="hardware-note hardware-note--three"><span>03</span> Visible automations</div>
        </div>
      </section>

      <section className="team-story">
        <div className="team-story__intro" data-reveal>
          <span className="section-label">One system. Fully yours.</span>
          <h2>Shared structure without shared sameness.</h2>
        </div>
        <div className="team-story__lanes">
          {[
            ["Plan", "Builder turns rough ideas into clean implementation handoffs."],
            ["Observe", "Router and Relay make the work visible across devices."],
            ["Think", "Baloss keeps routine reasoning close and routes up only when needed."],
            ["Create", "Every teammate can add workflows, tools, hobbies, and experiments."],
          ].map(([title, copy], index) => (
            <div className="team-lane" key={title} data-reveal>
              <span>0{index + 1}</span><h3>{title}</h3><p>{copy}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="systems-preview" id="systems-preview">
        <div className="systems-preview__head" data-reveal>
          <div><span className="section-label">The public system</span><h2>Twelve ways into one idea.</h2></div>
          <SiteLink to="/systems" navigate={navigate} className="text-link">See all systems <ArrowRight /></SiteLink>
        </div>
        <div className="systems-grid">
          {systems.slice(0, 6).map((system, index) => (
            <SiteLink key={system.slug} to={`/systems/${system.slug}`} navigate={navigate} className="system-card" onClick={() => undefined}>
              <div className="system-card__top"><span>0{index + 1}</span><ArrowRight /></div>
              <div className="system-card__icon" style={{ color: system.accent }} aria-hidden="true"><SystemIcon slug={system.slug} /></div>
              <h3>{system.shortName}</h3>
              <p>{system.statement}</p>
              <small>{system.category}</small>
            </SiteLink>
          ))}
        </div>
      </section>

      <section className="home-cta" data-reveal>
        <p>Open source. Local first. Built to be changed.</p>
        <h2>Your phone can do more<br />than wait for notifications.</h2>
        <div className="hero-actions">
          <SiteLink to="/systems" navigate={navigate} className="button button--dark">Meet PocketFlow <ArrowRight /></SiteLink>
          <SiteLink to="/community" navigate={navigate} className="button button--outline-dark">Join the community <Users /></SiteLink>
        </div>
      </section>
    </PageShell>
  );
}

function SystemsPage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const context: AgentContext = {
    page: "PocketFlow systems",
    summary: "Directory of all 12 public PocketFlow systems, each available as a sanitized standalone branch and as part of the shared phone shell.",
    facts: systems.map((system) => `${system.name}: ${system.description}`),
    links: { repository: githubUrl, branchIndex: `${githubUrl}/blob/main/APP_BRANCHES.md` },
  };
  return (
    <PageShell path={path} navigate={navigate} context={context}>
      <section className="directory-hero">
        <span className="section-label">PocketFlow / Public system</span>
        <h1>Twelve systems.<br /><strong>One pocket.</strong></h1>
        <p>Each surface has its own character. Together they form a personal operating layer for AI-native work.</p>
      </section>
      <section className="directory-list">
        {systems.map((system, index) => (
          <SiteLink key={system.slug} to={`/systems/${system.slug}`} navigate={navigate} className="directory-row">
            <span className="directory-row__number">{String(index + 1).padStart(2, "0")}</span>
            <span className="directory-row__dot" style={{ backgroundColor: system.accent }} />
            <span className="directory-row__name">{system.name}</span>
            <span className="directory-row__category">{system.category}</span>
            <ArrowRight />
          </SiteLink>
        ))}
      </section>
    </PageShell>
  );
}

function SystemDetailPage({ system, path, navigate }: { system: SystemPage; path: string; navigate: (path: string) => void }) {
  const index = systems.findIndex((item) => item.slug === system.slug);
  const next = systems[(index + 1) % systems.length];
  const context: AgentContext = {
    page: system.name,
    summary: `${system.description} ${system.teamRole}`,
    facts: [system.statement, ...system.capabilities, ...system.workflow, `Public boundary: ${system.publicBoundary}`],
    links: { sourceBranch: `${githubUrl}/tree/${system.branch}`, repository: githubUrl },
  };
  const accentStyle = { "--accent": system.accent } as CSSProperties;
  const demoUrl = demoBaseUrl && system.appId ? `${demoBaseUrl.replace(/\/$/, "")}/?app=${system.appId}` : "";

  return (
    <PageShell path={path} navigate={navigate} context={context}>
      <article className="system-page" style={accentStyle}>
        <section className="system-hero">
          <div className="system-hero__copy">
            <SiteLink to="/systems" navigate={navigate} className="back-link"><ArrowLeft /> All systems</SiteLink>
            <div className="system-index"><i /> {String(index + 1).padStart(2, "0")} / {String(systems.length).padStart(2, "0")} · {system.category}</div>
            <h1>{system.name}</h1>
            <p className="system-hero__statement">{system.statement}</p>
            <p className="system-hero__description">{system.description}</p>
            <div className="hero-actions">
              <a href={`${githubUrl}/tree/${system.branch}`} target="_blank" rel="noreferrer" className="button button--accent">View source <Github /></a>
              {demoUrl && <a href={demoUrl} target="_blank" rel="noreferrer" className="button button--ghost">Open demo <ExternalLink /></a>}
            </div>
          </div>
          <div className="system-hero__phone">
            {system.slug === "notebook-agent" && <div className="moltbook-corner">M<br /><span>01</span></div>}
            <PhoneArtwork system={system} priority />
          </div>
        </section>

        <section className="system-capabilities">
          <div className="system-capabilities__title" data-reveal><span>What it changes</span><h2>{system.teamRole}</h2></div>
          <div className="capability-list">
            {system.capabilities.map((capability, capabilityIndex) => (
              <div key={capability} data-reveal><span>0{capabilityIndex + 1}</span><h3>{capability}</h3></div>
            ))}
          </div>
        </section>

        <section className="system-workflow">
          <span className="section-label" data-reveal>How it moves</span>
          <div className="workflow-line">
            {system.workflow.map((step, stepIndex) => (
              <div key={step} data-reveal><i>{stepIndex + 1}</i><span>{step}</span>{stepIndex < system.workflow.length - 1 && <ArrowRight />}</div>
            ))}
          </div>
        </section>

        <section className="public-boundary" data-reveal>
          <div><Check /><span>Public-safe by design</span></div>
          <p>{system.publicBoundary}</p>
        </section>

        <section className="next-system">
          <span>Next system</span>
          <SiteLink to={`/systems/${next.slug}`} navigate={navigate}>
            <strong>{next.name}</strong><ArrowRight />
          </SiteLink>
        </section>
      </article>
    </PageShell>
  );
}

function GithubBounce() {
  return (
    <section className="github-runway" id="work-with-us" aria-label="Work with us on GitHub">
      <div className="github-runway__copy">
        <span className="section-label">Work with us</span>
        <h2>Build in public.<br />Move the system forward.</h2>
        <p>Follow the source, fork an idea, or bring something entirely your own.</p>
      </div>
      <div className="github-runway__track" aria-hidden="true"><span /></div>
      <a className="github-ball" href={githubUrl} target="_blank" rel="noreferrer" aria-label="Open PocketFlow on GitHub">
        <Github />
        <span>GitHub</span>
      </a>
    </section>
  );
}

function CommunityPage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [campaigns, setCampaigns] = useState<CommunityCampaign[]>([]);
  useEffect(() => {
    let active = true;
    fetch(`${communityEndpoint}/campaigns`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
        const body = await response.json();
        if (active && Array.isArray(body.campaigns)) setCampaigns(body.campaigns);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const context: AgentContext = {
    page: "Join the PocketFlow community",
    summary: "The PocketFlow community hub connects builders to the monthly open-source app contest, future surveys, events, and collaboration opportunities.",
    facts: [
      "Two community-built apps are selected every month.",
      "Contest entries require a creator name, email address, public GitHub repository, project summary, and optional supporting upload.",
      "Surveys and event signups will be published from the protected community administration system.",
    ],
    links: { contest: "/community/contest", repository: githubUrl },
  };

  return (
    <PageShell path={path} navigate={navigate} context={context}>
      <section className="community-hero">
        <div>
          <span className="section-label">PocketFlow / Community</span>
          <h1>Make something<br /><strong>worth sharing.</strong></h1>
        </div>
        <div className="community-hero__aside">
          <p>PocketFlow grows creator to creator. Bring an app, answer a research call, join an event, or help another builder turn a useful idea into public infrastructure.</p>
          <SiteLink to="/community/contest" navigate={navigate} className="button button--light">Enter this month’s contest <Trophy /></SiteLink>
        </div>
      </section>

      <section className="community-options" aria-label="Community opportunities">
        <article className="community-option community-option--active" data-reveal>
          <div><Trophy /><span>01 / Open now</span></div>
          <h2>Monthly build contest</h2>
          <p>Submit an open-source app that helps people build, think, automate, or collaborate. Two projects join the public PocketFlow collection every month.</p>
          <SiteLink to="/community/contest" navigate={navigate}>See the brief <ArrowRight /></SiteLink>
        </article>
        <article className="community-option" data-reveal>
          <div><FileText /><span>02 / Publishing soon</span></div>
          <h2>Builder surveys</h2>
          <p>Short research calls that shape PocketFlow’s roadmap, accessibility choices, and the next systems released to the community.</p>
          <span className="community-option__status">Survey portal is being connected</span>
        </article>
        <article className="community-option" data-reveal>
          <div><CalendarDays /><span>03 / Publishing soon</span></div>
          <h2>Events and signups</h2>
          <p>Remote build sessions, demos, open reviews, and small gatherings for creators working on practical personal AI.</p>
          <span className="community-option__status">Event calendar is being connected</span>
        </article>
      </section>

      {campaigns.length > 0 && (
        <section className="community-live">
          <div className="community-live__heading"><span className="section-label">Open calls</span><h2>Join what is happening now.</h2></div>
          <div className="community-live__list">
            {campaigns.map((campaign) => (
              <SiteLink key={campaign.id} to={`/community/calls/${campaign.id}`} navigate={navigate} className="community-live__row">
                <span>{campaign.type}</span><strong>{campaign.title}</strong><p>{campaign.summary}</p><ArrowRight />
              </SiteLink>
            ))}
          </div>
        </section>
      )}

      <section className="community-principle" data-reveal>
        <span>From creators, for creators</span>
        <p>No gatekeeping by hardware budget or company size. The strongest idea is the one another builder can understand, run, change, and make useful.</p>
      </section>

      <GithubBounce />
    </PageShell>
  );
}

function ContestPage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [fileName, setFileName] = useState("");
  const context: AgentContext = {
    page: "PocketFlow monthly creator contest",
    summary: "A monthly open-source app contest selecting two creator-built projects for publication in the PocketFlow public collection.",
    facts: [
      "Two projects are selected each month.",
      "Entries should be useful to other builders and available through a public GitHub repository.",
      "Creators submit contact details, a repository link, a project description, and an optional file of up to 10 MB.",
      "Selected projects are reviewed for public safety before publication.",
    ],
    links: { repository: githubUrl, community: "/community" },
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    try {
      const response = await fetch(`${communityEndpoint}/submissions`, {
        method: "POST",
        body: data,
        headers: { Accept: "application/json" },
      });
      const isJson = response.headers.get("content-type")?.includes("application/json");
      if (!response.ok || !isJson) throw new Error("Community backend is not connected");
      form.reset();
      setFileName("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <PageShell path={path} navigate={navigate} context={context}>
      <section className="contest-hero">
        <SiteLink to="/community" navigate={navigate} className="back-link"><ArrowLeft /> Community hub</SiteLink>
        <span className="contest-hero__round">Monthly open call / Two selected</span>
        <h1>Your app could be<br /><strong>next in PocketFlow.</strong></h1>
        <p>Build one focused thing that makes another creator more capable. Show the source. Explain the value. We will select two projects each month to prepare and publish with the public PocketFlow collection.</p>
      </section>

      <section className="contest-brief">
        <div className="contest-brief__lead" data-reveal>
          <span className="section-label">The brief</span>
          <h2>Useful beats enormous.</h2>
          <p>A sharp tool, a thoughtful automation, or an unexpectedly good interface can matter more than a giant platform. We care about usefulness, legibility, originality, and whether another person can build on it.</p>
        </div>
        <div className="contest-criteria">
          {["Public source we can review", "A clear problem and working path", "Respect for user data and consent", "Something other creators can reuse"].map((item, index) => (
            <div key={item} data-reveal><span>0{index + 1}</span><p>{item}</p></div>
          ))}
        </div>
      </section>

      <section className="contest-submit" id="submit-project">
        <div className="contest-submit__intro">
          <span className="section-label">Submit your project</span>
          <h2>Put it on the table.</h2>
          <p>Send the repository and enough context for a fair review. Supporting files are optional; never upload secrets, private datasets, credentials, or personal user data.</p>
        </div>
        <form className="contest-form" name="pocketflow-contest" onSubmit={submit} encType="multipart/form-data">
          <label>Name<input name="name" type="text" autoComplete="name" required placeholder="Your name" /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Project name<input name="projectName" type="text" required maxLength={100} placeholder="What should we call it?" /></label>
          <label>GitHub repository<input name="githubUrl" type="url" required inputMode="url" placeholder="https://github.com/you/project" pattern="https://(www\\.)?github\\.com/.+/.+" /></label>
          <label className="contest-form__wide">What does it make possible?<textarea name="description" required rows={6} maxLength={2000} placeholder="The problem, your approach, and why another creator would use it." /></label>
          <label className="upload-field contest-form__wide">
            <input name="attachment" type="file" accept=".zip,.pdf,.png,.jpg,.jpeg,.webp" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} />
            <Upload />
            <span>{fileName || "Add an optional demo, deck, screenshot, or ZIP"}<small>ZIP, PDF, PNG, JPG, or WEBP · 10 MB maximum</small></span>
          </label>
          <label className="consent-field contest-form__wide"><input name="consent" type="checkbox" required /><span>I own or can share this work, and I agree that Tanuki may review it for the monthly PocketFlow contest.</span></label>
          <button className="button button--light contest-form__wide" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Uploading…" : status === "sent" ? "Project received" : "Submit project"}
            {status === "sent" ? <Check /> : <Send />}
          </button>
          {status === "error" && <p className="form-status form-status--error contest-form__wide">The submission backend is not connected yet. Your files have not been uploaded; please try again when entries open.</p>}
          {status === "sent" && <p className="form-status contest-form__wide">Received. We will contact you at the submitted email after review.</p>}
        </form>
      </section>

      <GithubBounce />
    </PageShell>
  );
}

function CampaignPage({ campaignId, path, navigate }: { campaignId: string; path: string; navigate: (path: string) => void }) {
  const [campaign, setCampaign] = useState<CommunityCampaign | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    let active = true;
    fetch(`${communityEndpoint}/campaigns`, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
        const body = await response.json();
        if (active) setCampaign((body.campaigns || []).find((item: CommunityCampaign) => item.id === campaignId) || null);
      })
      .catch(() => undefined)
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [campaignId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!campaign) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const answers = Object.fromEntries(campaign.questions.map((_, index) => [`question_${index}`, fields.get(`question_${index}`)]));
    setStatus("sending");
    try {
      const response = await fetch(`${communityEndpoint}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ campaignId, name: fields.get("name"), email: fields.get("email"), answers }),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error();
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  const fallbackContext: AgentContext = {
    page: campaign?.title || "PocketFlow community call",
    summary: campaign?.summary || "A published PocketFlow community survey, event signup, or creator call.",
    facts: campaign ? [`Campaign type: ${campaign.type}`, ...campaign.questions] : ["Campaign data is supplied by the community backend."],
    links: { community: "/community" },
  };

  return (
    <PageShell path={path} navigate={navigate} context={fallbackContext}>
      <section className="campaign-page">
        <SiteLink to="/community" navigate={navigate} className="back-link"><ArrowLeft /> Community hub</SiteLink>
        {!loaded ? <p className="campaign-page__state">Loading public call…</p> : !campaign ? (
          <div className="campaign-page__missing"><span>Call unavailable</span><h1>This public call is not open.</h1><SiteLink to="/community" navigate={navigate} className="button button--light">See community opportunities <ArrowRight /></SiteLink></div>
        ) : (
          <div className="campaign-page__layout">
            <div className="campaign-page__intro">
              <span className="section-label">{campaign.type} / Open call</span>
              <h1>{campaign.title}</h1>
              <p>{campaign.summary}</p>
              {campaign.closesAt && <small>Closes {new Date(campaign.closesAt).toLocaleDateString()}</small>}
            </div>
            <form className="campaign-form" onSubmit={submit}>
              <label>Name<input name="name" required autoComplete="name" /></label>
              <label>Email<input name="email" type="email" required autoComplete="email" /></label>
              {campaign.questions.map((question, index) => <label key={`${index}-${question}`}>{question}<textarea name={`question_${index}`} required rows={4} /></label>)}
              <button className="button button--light" type="submit" disabled={status === "sending"}>{status === "sending" ? "Sending…" : status === "sent" ? "Response received" : campaign.type === "event" ? "Reserve a place" : "Send response"}{status === "sent" ? <Check /> : <Send />}</button>
              {status === "error" && <p className="form-status form-status--error">The response could not be saved. Please try again.</p>}
            </form>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function AdminPage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [auth, setAuth] = useState<"checking" | "locked" | "ready" | "offline">("checking");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!active) return;
        if (response.status === 401) return setAuth("locked");
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return setAuth("offline");
        const body = await response.json();
        if (active) setAuth(body.authenticated ? "ready" : "locked");
      })
      .catch(() => { if (active) setAuth("offline"); });
    return () => { active = false; };
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error();
      form.reset();
      setAuth("ready");
    } catch {
      setNotice("Login failed or the private backend is not configured.");
    }
  };

  const createCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("Saving…");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/admin/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error();
      form.reset();
      setNotice("Campaign created.");
    } catch {
      setNotice("Could not save. Check the backend bindings and session.");
    }
  };

  return (
    <PageShell path={path} navigate={navigate} context={{
      page: "PocketFlow community administration",
      summary: "Private administration surface for publishing PocketFlow contests, surveys, and event signups and reviewing creator submissions.",
      facts: ["Authentication is server-side and credentials are supplied only through deployment environment variables.", "Campaign and submission data require private database and object-storage bindings."],
    }}>
      <section className="admin-page">
        <div className="admin-page__heading">
          <span className="section-label">Private system / Community operations</span>
          <h1>Community<br />control room.</h1>
          <p>Create public calls without editing the website. Review and export submissions from one protected surface.</p>
        </div>

        {auth !== "ready" ? (
          <form className="admin-login" onSubmit={login}>
            <LockKeyhole />
            <h2>{auth === "checking" ? "Checking session" : "Admin login"}</h2>
            <p>Credentials are verified by the private API and are never stored in the public site bundle.</p>
            <label>Username<input name="username" required autoComplete="username" disabled={auth === "checking"} /></label>
            <label>Password<input name="password" type="password" required autoComplete="current-password" disabled={auth === "checking"} /></label>
            <button className="button button--light" type="submit" disabled={auth === "checking"}>Sign in <LogIn /></button>
            {auth === "offline" && <p className="form-status form-status--error">The private backend is not configured in this preview.</p>}
            {notice && <p className="form-status form-status--error">{notice}</p>}
          </form>
        ) : (
          <div className="admin-console">
            <div className="admin-console__status"><span><i /> Authenticated</span><a href="/api/admin/entries" target="_blank" rel="noreferrer">View entries <ExternalLink /></a></div>
            <form onSubmit={createCampaign}>
              <div><span className="section-label">New public call</span><h2>Publish a campaign</h2></div>
              <label>Type<select name="type" required defaultValue="survey"><option value="survey">Survey</option><option value="event">Event signup</option><option value="contest">Contest</option></select></label>
              <label>Title<input name="title" required maxLength={120} placeholder="Monthly builder survey" /></label>
              <label>Deadline<input name="closesAt" type="datetime-local" /></label>
              <label>Status<select name="status" defaultValue="draft"><option value="draft">Draft</option><option value="published">Published</option></select></label>
              <label className="admin-console__wide">Summary<textarea name="summary" required rows={4} maxLength={800} placeholder="What is this call for?" /></label>
              <label className="admin-console__wide">Questions <span>One per line</span><textarea name="questions" rows={5} placeholder={"What are you building?\nWhich tools do you use?"} /></label>
              <button className="button button--light admin-console__wide" type="submit">Save campaign <Send /></button>
              {notice && <p className="form-status admin-console__wide">{notice}</p>}
            </form>
          </div>
        )}
      </section>
    </PageShell>
  );
}

function ContactPage({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const context: AgentContext = {
    page: "Contact PocketFlow",
    summary: "Contact Tanuki Labs about PocketFlow, competition demos, collaborations, team installations, and product questions.",
    facts: [`Contact email: ${contactEmail}`, "The form supports a configurable HTTPS form endpoint and falls back to the visitor's email client."],
    links: { repository: githubUrl, company: "https://www.tanukilabs.fun" },
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus("sending");
    if (!contactEndpoint) {
      const subject = encodeURIComponent(`PocketFlow enquiry from ${String(data.get("name") || "website visitor")}`);
      const body = encodeURIComponent(`Name: ${data.get("name")}\nEmail: ${data.get("email")}\nCompany: ${data.get("company") || "-"}\n\n${data.get("message")}`);
      window.location.href = `mailto:${contactEmail}?subject=${subject}&body=${body}`;
      setStatus("sent");
      return;
    }
    try {
      const response = await fetch(contactEndpoint, { method: "POST", body: data, headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Contact endpoint rejected the request");
      form.reset();
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <PageShell path={path} navigate={navigate} context={context}>
      <section className="contact-page">
        <div className="contact-page__intro">
          <span className="section-label">Contact / Tanuki Labs</span>
          <h1>Let’s put intelligence<br />where the work is.</h1>
          <p>Competition, collaboration, team deployment, or a very good strange idea. Tell us what you are building.</p>
          <div className="contact-socials">
            <SiteLink to="/community" navigate={navigate}><Users /> Join our community <ArrowRight /></SiteLink>
            <a href={githubUrl} target="_blank" rel="noreferrer"><Github /> GitHub <ExternalLink /></a>
            <a href={xUrl} target="_blank" rel="noreferrer"><Twitter /> X <ExternalLink /></a>
            <a href="https://www.tanukilabs.fun" target="_blank" rel="noreferrer"><Globe2 /> Tanuki Labs <ExternalLink /></a>
          </div>
        </div>
        <form className="contact-form" name="pocketflow-contact" onSubmit={submit}>
          <input type="hidden" name="form-name" value="pocketflow-contact" />
          <label>Name<input name="name" type="text" autoComplete="name" required placeholder="Your name" /></label>
          <label>Email<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Company <span>Optional</span><input name="company" type="text" autoComplete="organization" placeholder="Company or team" /></label>
          <label>What are you building?<textarea name="message" required rows={7} placeholder="A little context goes a long way." /></label>
          <button className="button button--light" type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : status === "sent" ? "Message ready" : "Send message"}
            {status === "sent" ? <Check /> : <Send />}
          </button>
          {status === "error" && <p className="form-status form-status--error">The connection failed. Email us directly at <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.</p>}
          {status === "sent" && <p className="form-status">Thank you. Your message is ready to go.</p>}
        </form>
      </section>
    </PageShell>
  );
}

function NotFound({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  return (
    <PageShell path={path} navigate={navigate} context={{ page: "Page not found", summary: "This PocketFlow route does not exist.", facts: ["Use the systems directory to explore the public project."] }}>
      <section className="not-found"><Smartphone /><span>404</span><h1>This station is<br />not on the map.</h1><SiteLink to="/systems" navigate={navigate} className="button button--light">Open system map <ArrowRight /></SiteLink></section>
    </PageShell>
  );
}

export default function App() {
  const { path, navigate } = useRoute();
  const system = useMemo(() => path.startsWith("/systems/") ? systemBySlug(path.slice("/systems/".length)) : undefined, [path]);
  const campaignId = path.startsWith("/community/calls/") ? path.slice("/community/calls/".length) : "";

  if (path === "/") return <HomePage path={path} navigate={navigate} />;
  if (path === "/systems") return <SystemsPage path={path} navigate={navigate} />;
  if (system) return <SystemDetailPage system={system} path={path} navigate={navigate} />;
  if (path === "/community") return <CommunityPage path={path} navigate={navigate} />;
  if (path === "/community/contest") return <ContestPage path={path} navigate={navigate} />;
  if (campaignId) return <CampaignPage campaignId={campaignId} path={path} navigate={navigate} />;
  if (path === "/admin") return <AdminPage path={path} navigate={navigate} />;
  if (path === "/contact") return <ContactPage path={path} navigate={navigate} />;
  return <NotFound path={path} navigate={navigate} />;
}
