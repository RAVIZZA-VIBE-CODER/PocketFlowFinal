import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  Github,
  Globe2,
  Menu,
  Monitor,
  RefreshCw,
  Send,
  Smartphone,
  Twitter,
  X,
} from "lucide-react";
import { CSSProperties, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { githubBase, systemBySlug, systems, type SystemPage } from "./siteData";

const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || "hello@example.com";
const contactEndpoint = import.meta.env.VITE_CONTACT_FORM_ENDPOINT || "";
const githubUrl = import.meta.env.VITE_GITHUB_URL || githubBase;
const xUrl = import.meta.env.VITE_X_URL || "https://x.com/TanukiLabsAI";
const demoBaseUrl = import.meta.env.VITE_DEMO_BASE_URL || "";

type AgentContext = {
  page: string;
  summary: string;
  facts: string[];
  links?: Record<string, string>;
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
  const featured = systems[0];
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
          <PhoneArtwork system={featured} priority />
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
          <div><strong>12</strong><span>public systems</span></div>
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

      <section className="systems-preview">
        <div className="systems-preview__head" data-reveal>
          <div><span className="section-label">The public system</span><h2>Twelve ways into one idea.</h2></div>
          <SiteLink to="/systems" navigate={navigate} className="text-link">See all systems <ArrowRight /></SiteLink>
        </div>
        <div className="systems-grid">
          {systems.slice(0, 6).map((system, index) => (
            <SiteLink key={system.slug} to={`/systems/${system.slug}`} navigate={navigate} className="system-card" onClick={() => undefined}>
              <div className="system-card__top"><span>0{index + 1}</span><ArrowRight /></div>
              <div className="system-card__accent" style={{ backgroundColor: system.accent }} />
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
          <SiteLink to="/contact" navigate={navigate} className="button button--outline-dark">Talk to Tanuki <Send /></SiteLink>
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

  if (path === "/") return <HomePage path={path} navigate={navigate} />;
  if (path === "/systems") return <SystemsPage path={path} navigate={navigate} />;
  if (system) return <SystemDetailPage system={system} path={path} navigate={navigate} />;
  if (path === "/contact") return <ContactPage path={path} navigate={navigate} />;
  return <NotFound path={path} navigate={navigate} />;
}
