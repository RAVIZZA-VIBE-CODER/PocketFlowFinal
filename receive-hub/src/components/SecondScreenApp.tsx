import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Laptop, MonitorUp, RefreshCw, ShieldCheck, Unplug, Usb, Wifi } from "lucide-react";

type SecondScreenState =
  | "IDLE"
  | "DISCOVERING"
  | "HOST_DETECTED"
  | "AWAITING_USER_APPROVAL"
  | "PAIRING"
  | "AUTHENTICATING"
  | "NEGOTIATING"
  | "CONNECTING"
  | "STREAMING"
  | "RECONNECTING"
  | "DISCONNECTING"
  | "DISCONNECTED"
  | "ERROR"
  | "UNSUPPORTED";

type SecondScreenMode = "extended" | "shared";
type StreamStatus = "idle" | "starting" | "ready" | "failed";

interface SecondScreenHost {
  id: string;
  name: string;
  address: string;
  supportsExtended: boolean;
  supportsShared: boolean;
  trusted: boolean;
  platform?: string;
  detail?: string;
  previewUrl?: string;
}

interface SecondScreenAppProps {
  onNotify?: (message: string, type?: "success" | "warn" | "info") => void;
}

const TRUSTED_HOSTS_KEY = "pocketflow.secondscreen.trustedHosts.v1";
const RELAY_ENDPOINT_KEY = "pocketflow.codexRelay.endpoint";
const RELAY_TOKEN_KEY = "pocketflow.codexRelay.token";
const DEFAULT_RELAY_ENDPOINTS = [
  "http://localhost:8788",
  "http://127.0.0.1:8788",
];

const readTrustedHosts = (): SecondScreenHost[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRUSTED_HOSTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveTrustedHosts = (hosts: SecondScreenHost[]) => {
  localStorage.setItem(TRUSTED_HOSTS_KEY, JSON.stringify(hosts));
};

const stateLabel: Record<SecondScreenState, string> = {
  IDLE: "Idle",
  DISCOVERING: "Searching",
  HOST_DETECTED: "Host detected",
  AWAITING_USER_APPROVAL: "Needs approval",
  PAIRING: "Pairing",
  AUTHENTICATING: "Authenticating",
  NEGOTIATING: "Negotiating",
  CONNECTING: "Connecting",
  STREAMING: "Streaming",
  RECONNECTING: "Reconnecting",
  DISCONNECTING: "Disconnecting",
  DISCONNECTED: "Disconnected",
  ERROR: "Error",
  UNSUPPORTED: "Host required",
};

const protocolSteps: SecondScreenState[] = [
  "DISCOVERING",
  "HOST_DETECTED",
  "AWAITING_USER_APPROVAL",
  "PAIRING",
  "AUTHENTICATING",
  "NEGOTIATING",
  "CONNECTING",
  "STREAMING",
];

const isFinalUnsupported = (state: SecondScreenState) => state === "UNSUPPORTED" || state === "ERROR" || state === "DISCONNECTED";

const normalizeEndpoint = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    if (!parsed.port) parsed.port = "8788";
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "";
  }
};

const candidateRelayEndpoints = () => {
  const saved = typeof localStorage !== "undefined" ? localStorage.getItem(RELAY_ENDPOINT_KEY) || "" : "";
  const fromPage = (() => {
    if (typeof window === "undefined" || !window.location.hostname) return "";
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") return "";
    return `${window.location.protocol}//${window.location.hostname}:8788`;
  })();
  // The LAN relay is the fastest known path when phone and Mac share Wi-Fi.
  // Saved Tailscale routes stay available, but must not make every scan wait
  // for a stopped VPN before trying the reachable local relay.
  return Array.from(new Set([
    ...DEFAULT_RELAY_ENDPOINTS,
    saved,
    fromPage,
  ].map(normalizeEndpoint).filter(Boolean)));
};

const relayAuthQuery = (token: string) => (token ? `?token=${encodeURIComponent(token)}` : "");

const fetchJsonWithTimeout = async (url: string, token: string, timeoutMs = 2600, method: "GET" | "POST" = "GET") => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(token ? { "x-pocketflow-relay-token": token } : {}),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
};

const hostFromRelayStatus = (endpoint: string, payload: any): SecondScreenHost | null => {
  if (!payload?.ok || payload?.service !== "pocketflow-codex-relay") return null;
  const hostName = payload?.device?.name || new URL(endpoint).hostname;
  const platform = payload?.device?.platform || "computer";
  const previewPort = Number(payload?.preview?.port || 3000);
  const parsed = new URL(endpoint);
  const previewUrl = `${parsed.protocol}//${parsed.hostname}:${previewPort}/?preview=second-display&relay=${encodeURIComponent(endpoint)}`;
  return {
    id: `relay-${parsed.hostname}`,
    name: hostName,
    address: endpoint,
    supportsExtended: false,
    supportsShared: true,
    trusted: true,
    platform,
    previewUrl,
    detail: "PocketFlow relay is online. Shared View can be attempted; true extended display still needs a Display Host/virtual-display driver.",
  };
};

const enrichHostWithScreenStatus = async (host: SecondScreenHost, token: string): Promise<SecondScreenHost> => {
  try {
    const screen = await fetchJsonWithTimeout(`${host.address}/relay/screen/status${relayAuthQuery(token)}`, token, 2200);
    const extended = screen?.mode === "macos-virtual-extended-display" || Boolean(screen?.target?.extended);
    if (!extended) {
      return {
        ...host,
        detail: screen?.message || "Relay is online. Shared View is available; no virtual extended display is active.",
      };
    }
    return {
      ...host,
      supportsExtended: true,
      supportsShared: true,
      detail: `${screen?.target?.displayName || "PocketFlow virtual display"} is online as a separate macOS display. This is the extended desktop source.`,
    };
  } catch {
    return host;
  }
};

const SecondScreenApp = ({ onNotify }: SecondScreenAppProps) => {
  const [sessionState, setSessionState] = useState<SecondScreenState>("IDLE");
  const [mode, setMode] = useState<SecondScreenMode>("extended");
  const [trustedHosts, setTrustedHosts] = useState<SecondScreenHost[]>(() => readTrustedHosts());
  const [detectedHosts, setDetectedHosts] = useState<SecondScreenHost[]>([]);
  const [selectedHostId, setSelectedHostId] = useState("");
  const [lastScanMessage, setLastScanMessage] = useState("Connecting to the computer over USB, Wi-Fi and Tailscale...");
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [requireApproval, setRequireApproval] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const selectedHost = detectedHosts.find((host) => host.id === selectedHostId) || detectedHosts[0] || null;

  useEffect(() => {
    window.PocketFlowReceiveBridge?.setSecondDisplayOrientation?.("portrait").catch(() => undefined);
  }, []);

  const capabilityMessage = useMemo(() => {
    if (mode === "extended") {
      return "Extended desktop is allowed only after a PocketFlow Display Host proves virtual-display support.";
    }
    return "Shared View can mirror a host window or browser stream, but touch, keyboard and mouse remain blocked.";
  }, [mode]);

  const runDiscovery = async () => {
    setSessionState("DISCOVERING");
    setLastScanMessage("Scanning saved relay, Tailscale and LAN routes...");
    onNotify?.("Second Screen is checking this computer and known relay routes.", "info");
    const token = localStorage.getItem(RELAY_TOKEN_KEY) || "";
    const foundHosts: SecondScreenHost[] = [];
    const failures: string[] = [];

    for (const endpoint of candidateRelayEndpoints()) {
      try {
        const payload = await fetchJsonWithTimeout(`${endpoint}/relay/status${relayAuthQuery(token)}`, token);
        const host = hostFromRelayStatus(endpoint, payload);
        if (host && !foundHosts.some((item) => item.id === host.id)) {
          const enrichedHost = await enrichHostWithScreenStatus(host, token);
          foundHosts.push(enrichedHost);
          // One reachable relay represents one computer. Do not serially scan
          // every advertised alias and render duplicate hosts or a long wait.
          break;
        }
      } catch (error) {
        failures.push(`${endpoint.replace(/^https?:\/\//, "")}: ${error instanceof Error ? error.message : "unreachable"}`);
      }
    }

    setDetectedHosts(foundHosts);
    setStreamStatus("idle");
    if (foundHosts.length) {
      setSelectedHostId(foundHosts[0].id);
      setMode(foundHosts[0].supportsExtended ? "extended" : "shared");
      setSessionState("HOST_DETECTED");
      setLastScanMessage(
        foundHosts[0].supportsExtended
          ? `${foundHosts[0].name} found. PocketFlowRealme is available as an extended Mac display.`
          : `${foundHosts[0].name} found via PocketFlow relay. Shared View candidate is available; Extended/Sidecar still needs a Display Host driver.`,
      );
      onNotify?.(
        foundHosts[0].supportsExtended
          ? "Computer found. Extended display source is online."
          : "Computer found. Shared View is possible; true Extended mode needs a Display Host.",
        "success",
      );
      return;
    }

    setSessionState("UNSUPPORTED");
    setLastScanMessage(
      failures.length
      ? `Computer not reachable on the current routes. Tried ${failures.slice(0, 3).join(" · ")}`
      : "No relay/display host routes are configured.",
    );
    onNotify?.("The computer is not reachable on the current USB, Wi-Fi or Tailscale routes.", "warn");
  };

  useEffect(() => {
    const initialScan = window.setTimeout(() => void runDiscovery(), 250);
    return () => window.clearTimeout(initialScan);
  }, []);

  const openSharedPreview = async () => {
    if (!selectedHost?.previewUrl) {
      setSessionState("UNSUPPORTED");
      setLastScanMessage("No preview URL is available from this host yet.");
      return;
    }
    setSessionState("NEGOTIATING");
    setStreamStatus("starting");
    setLastScanMessage("Opening the screen viewer. The relay handshake continues in the background.");
    try {
      const token = localStorage.getItem(RELAY_TOKEN_KEY) || "";
      const previewStart = fetchJsonWithTimeout(
        `${selectedHost.address}/relay/preview/start${relayAuthQuery(token)}`,
        token,
        3000,
        "POST",
      ).catch(() => null);
      const screenStart = await fetchJsonWithTimeout(
        `${selectedHost.address}/relay/screen/start${relayAuthQuery(token)}${token ? "&" : "?"}mode=${encodeURIComponent(mode)}`,
        token,
        5500,
        "POST",
      );
      const extendedReady = screenStart?.mode === "macos-virtual-extended-display" || Boolean(screenStart?.target?.extended);
      if (mode === "extended" && !extendedReady) {
        setStreamStatus("failed");
        setSessionState("UNSUPPORTED");
        setLastScanMessage(String(screenStart?.message || "Computer found, but no virtual extended display is active. Choose Shared View or enable a Display Host on the Mac."));
        onNotify?.("Extended desktop is not active. Shared View remains available.", "warn");
        return;
      }
      setStreamStatus("ready");
      setSessionState("STREAMING");
      setLastScanMessage(mode === "shared" ? "Shared View opened. Waiting for the first live frame." : "Extended display opened. Waiting for the first live frame.");
      const previewUrl = new URL(selectedHost.previewUrl);
      if (token) previewUrl.searchParams.set("relayToken", token);
      void previewStart;
      onNotify?.(mode === "shared" ? "Shared View opened." : "Extended display opened.", "success");
      window.location.assign(previewUrl.toString());
    } catch (error) {
      setStreamStatus("failed");
      setSessionState("ERROR");
      setLastScanMessage(`Stream could not start: ${error instanceof Error ? error.message : "unknown error"}. Relay is found, but preview start failed.`);
      onNotify?.("Shared stream failed to start.", "warn");
    }
  };

  const resetTrustedHosts = () => {
    setTrustedHosts([]);
    saveTrustedHosts([]);
    setDetectedHosts([]);
    setSelectedHostId("");
    setStreamStatus("idle");
    setSessionState("IDLE");
    setLastScanMessage("Connecting to the computer over USB, Wi-Fi and Tailscale...");
    onNotify?.("Second Screen trusted hosts cleared.", "success");
  };

  return (
    <div className="pocketflow-screen-scroll flex-1 min-h-0 bg-[#06080b] text-white">
      <div className="min-h-full px-3 pb-24 pt-3">
        <section className="relative overflow-hidden rounded-[26px] border border-cyan-300/20 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.18),transparent_36%),linear-gradient(145deg,#08111a,#050607_72%)] p-4 shadow-[0_18px_55px_rgba(0,0,0,0.46)]">
          <div className="absolute right-[-44px] top-[-44px] h-32 w-32 rounded-full border border-cyan-200/10 bg-cyan-300/10 blur-sm" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">PocketFlow Display</div>
              <h1 className="mt-1 text-2xl font-black tracking-tight">Second Screen</h1>
              <p className="mt-1 max-w-[280px] text-xs leading-5 text-slate-300">
                Connect this phone as the PocketFlow display receiver. Rotation changes only after the relay stream opens.
              </p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">
              <MonitorUp className="h-6 w-6" />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-[7px] font-mono font-black uppercase tracking-[0.2em] text-slate-500">State</div>
              <div className={`mt-1 truncate text-lg font-black ${isFinalUnsupported(sessionState) ? "text-amber-200" : "text-cyan-100"}`}>
                {stateLabel[sessionState]}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
              <div className="text-[7px] font-mono font-black uppercase tracking-[0.2em] text-slate-500">Mode</div>
              <div className="mt-1 truncate text-lg font-black text-white">{mode === "extended" ? "Extended" : "Shared"}</div>
            </div>
          </div>
        </section>

        {selectedHost && (
          <section className="mt-3 rounded-[24px] border border-emerald-300/30 bg-[linear-gradient(145deg,rgba(16,185,129,0.18),rgba(6,78,59,0.16)_55%,rgba(0,0,0,0.28))] p-3 shadow-[0_18px_55px_rgba(16,185,129,0.1)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-emerald-200">Ready to connect</div>
                <h2 className="mt-1 truncate text-lg font-black text-white">{selectedHost.name}</h2>
                <p className="mt-1 truncate text-[10px] font-mono text-emerald-50/60">{selectedHost.address}</p>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-200/30 bg-emerald-200/10 px-2.5 py-1 text-[8px] font-mono font-black uppercase tracking-[0.16em] text-emerald-100">
                found
              </span>
            </div>
            <button
              type="button"
              onClick={openSharedPreview}
              disabled={streamStatus === "starting"}
              className="mt-3 w-full rounded-[20px] border border-emerald-200/50 bg-emerald-300 px-4 py-4 text-center text-[12px] font-mono font-black uppercase tracking-[0.22em] text-[#03140c] shadow-[0_14px_44px_rgba(110,231,183,0.24)] active:scale-[0.98] disabled:opacity-60"
            >
              {streamStatus === "starting" ? "Connecting..." : "Connect"}
            </button>
            <p className="mt-3 text-center text-[10px] leading-4 text-emerald-50/70">
              {selectedHost.supportsExtended
                ? "Opens the PocketFlowRealme extended Mac display on this phone."
                : "Opens the Mac screen mirror on this phone. True extended desktop comes later with the Display Host driver."}
            </p>
          </section>
        )}

        <section className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode("extended")}
            className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
              mode === "extended" ? "border-cyan-300/45 bg-cyan-300/12 text-cyan-50" : "border-white/10 bg-[#12151b] text-slate-300"
            }`}
          >
            <Laptop className="h-5 w-5" />
            <div className="mt-2 text-sm font-black">Extended</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Requires host virtual display.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode("shared")}
            className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
              mode === "shared" ? "border-emerald-300/45 bg-emerald-300/12 text-emerald-50" : "border-white/10 bg-[#12151b] text-slate-300"
            }`}
          >
            <Wifi className="h-5 w-5" />
            <div className="mt-2 text-sm font-black">Shared View</div>
            <p className="mt-1 text-[11px] leading-4 text-slate-400">Mirror/window stream only.</p>
          </button>
        </section>

        <section className="mt-3 rounded-[24px] border border-white/10 bg-[#12151b] p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-cyan-200">Capability Gate</div>
              <h2 className="mt-1 text-base font-black">Host connection required</h2>
              <p className="mt-1 text-[11px] leading-4 text-slate-400">{capabilityMessage}</p>
            </div>
            <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-300" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={runDiscovery}
              className="rounded-2xl border border-cyan-300/35 bg-cyan-300/12 px-3 py-3 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-cyan-100 active:scale-[0.98]"
            >
              <RefreshCw className="mr-2 inline h-3.5 w-3.5" />
              Search
            </button>
            <button
              type="button"
              onClick={resetTrustedHosts}
              className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-slate-300 active:scale-[0.98]"
            >
              <Unplug className="mr-2 inline h-3.5 w-3.5" />
              Reset
            </button>
          </div>
          <p className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-300/10 p-3 text-[11px] leading-5 text-cyan-50/80">
            {lastScanMessage}
          </p>
        </section>

        {detectedHosts.length > 0 && (
          <section className="mt-4 rounded-[28px] border border-emerald-300/20 bg-[#07130f] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-emerald-200">Detected computers</div>
                <h2 className="mt-1 text-lg font-black">Computer found</h2>
              </div>
              <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-mono font-black uppercase tracking-[0.16em] text-emerald-100">
                connection ready
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {detectedHosts.map((host) => (
                <button
                  key={host.id}
                  type="button"
                  onClick={() => setSelectedHostId(host.id)}
                  className={`w-full rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                    selectedHost?.id === host.id ? "border-emerald-300/45 bg-emerald-300/12" : "border-white/10 bg-black/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white">{host.name}</div>
                      <div className="mt-1 truncate text-[10px] font-mono text-slate-400">{host.address}</div>
                      <p className="mt-2 text-[11px] leading-4 text-slate-400">{host.detail}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[8px] font-mono uppercase tracking-[0.16em] text-slate-500">{host.platform || "host"}</div>
                      <div className="mt-2 rounded-full border border-red-300/25 bg-red-300/10 px-2 py-1 text-[8px] font-mono font-black uppercase text-red-100">
                        {host.supportsExtended ? "extended ready" : "shared ready"}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => {
                  setMode("extended");
                  setSessionState("UNSUPPORTED");
                  setLastScanMessage("Extended mode needs a real Display Host/virtual-display driver on the computer. Relay alone cannot create Sidecar.");
                }}
                className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-3 py-3 text-[10px] font-mono font-black uppercase tracking-[0.18em] text-amber-100 active:scale-[0.98]"
              >
                Test Extended
              </button>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[28px] border border-amber-300/20 bg-[#171103] p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-200/25 bg-amber-200/10 text-amber-100">
              <Usb className="h-5 w-5" />
            </div>
            <div>
              <div className="text-[8px] font-mono font-black uppercase tracking-[0.24em] text-amber-200">USB-C reality check</div>
              <p className="mt-2 text-xs leading-5 text-amber-50/80">
                Type-C can carry data, charging, and sometimes display-out. It is not normally HDMI/display-in for a phone. For cable video-in we need UVC HDMI capture hardware, or we use a PocketFlow Display Host stream over USB/Wi-Fi/Tailscale.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#0f1117] p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black">Protocol rail</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[8px] font-mono uppercase tracking-[0.18em] text-slate-400">
              Viewer only
            </span>
          </div>
          <div className="mt-4 space-y-2">
            {protocolSteps.map((step) => {
              const active = step === sessionState;
              const complete = protocolSteps.indexOf(step) < protocolSteps.indexOf(sessionState);
              return (
                <div key={step} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/20 p-2.5">
                  <div
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-2xl border ${
                      active
                        ? "border-cyan-300/45 bg-cyan-300/15 text-cyan-100"
                        : complete
                          ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200"
                          : "border-white/10 bg-white/[0.03] text-slate-500"
                    }`}
                  >
                    {complete ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-100">{stateLabel[step]}</div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.12em] text-slate-500">{step}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#12151b] p-4">
          <h2 className="text-sm font-black">Safety locks</h2>
          <div className="mt-3 space-y-2">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <span>
                <span className="block text-xs font-bold text-white">Ask before trusting a host</span>
                <span className="block text-[10px] leading-4 text-slate-500">No silent pairing.</span>
              </span>
              <input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} className="h-5 w-5 accent-cyan-300" />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
              <span>
                <span className="block text-xs font-bold text-white">Local network only</span>
                <span className="block text-[10px] leading-4 text-slate-500">No public relay until explicitly designed.</span>
              </span>
              <input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} className="h-5 w-5 accent-cyan-300" />
            </label>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] border border-dashed border-white/10 bg-black/20 p-4 text-center">
          <div className="text-[9px] font-mono font-black uppercase tracking-[0.24em] text-slate-500">Trusted hosts</div>
          <div className="mt-2 text-2xl font-black text-white">{trustedHosts.length}</div>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Host pairing is intentionally disabled until the PocketFlow Display Host implements discovery, auth and stream negotiation.
          </p>
        </section>

      </div>
    </div>
  );
};

export default SecondScreenApp;
