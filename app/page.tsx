"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clipboard,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  GitBranch,
  History,
  Layers3,
  LoaderCircle,
  RefreshCw,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  XCircle,
} from "lucide-react";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionHashVariant, type CalldataEncodable } from "genlayer-js/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";

const CONTRACT_ADDRESS = "0xb521C0AE4660E4C57D78DAeB0045302EdF570C60" as const;
const RPC_URL = "https://studio.genlayer.com/api";
const EXPLORER_URL = `https://explorer-studio.genlayer.com/address/${CONTRACT_ADDRESS}`;
const SOURCE_SHA = "d5c0eebfd8bd8f20c895da053517bd7f7ab17d0585e49866a66c55884d11c527";
const chain = { ...studionet, rpcUrls: { default: { http: [RPC_URL] } } };
const readClient = createClient({ chain });

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

type Config = {
  name: string;
  version: string;
  semantic_verdicts: string[];
  clock_used: boolean;
  global_admin: boolean;
  max_proposals_per_baseline: number;
  max_model_calls_per_baseline: number;
  effective_baseline_grows: boolean;
  original_baseline_immutable: boolean;
  baseline_count: number;
  proposal_count: number;
};

type Baseline = {
  baseline_id: number;
  owner: string;
  baseline_text: string;
  effective_baseline_text: string;
  attempt_count: number;
  model_calls: number;
  active_proposal_count: number;
  premise_blocks: number;
};

type Attempt = {
  baseline_id: number;
  attempt_id: number;
  proposal_id: number;
  proposal_text: string;
  verdict: "NO_NEW_MATERIAL_PREMISE" | "NEW_UNSUPPORTED_PREMISE" | string;
  accepted: boolean;
  active: boolean;
  proposer: string;
  used_cache: boolean;
};

type Ledger = { baseline: Baseline; attempts: Attempt[] };

type ModelContext = {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
      execute(input: unknown): unknown | Promise<unknown>;
    },
    options?: { signal?: AbortSignal },
  ): void | Promise<void>;
};

declare global {
  interface Window { ethereum?: EthereumProvider }
  interface Document { modelContext?: ModelContext }
}

const nav = ["Overview", "Baseline", "Proposal", "Ledger", "Proof"] as const;
const compact = (value: string) => `${value.slice(0, 6)}…${value.slice(-5)}`;
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

function positiveInteger(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <label className="field"><span>{label}{hint ? <small>{hint}</small> : null}</span>{children}</label>;
}

function StatusPanel({ status, hash }: { status: string; hash: string }) {
  if (!status && !hash) return null;
  return (
    <div className="status-panel" aria-live="polite">
      <span><small>LATEST OPERATION</small><strong>{status}</strong></span>
      {hash ? <code>{compact(hash)}</code> : <LoaderCircle className="spin" />}
    </div>
  );
}

function VerdictBadge({ attempt }: { attempt: Attempt }) {
  const allowed = attempt.verdict === "NO_NEW_MATERIAL_PREMISE";
  return <em className={allowed ? "allowed" : "blocked"}>{allowed ? "NO NEW PREMISE" : "UNSUPPORTED PREMISE"}</em>;
}

export default function Home() {
  const [active, setActive] = useState<(typeof nav)[number]>("Overview");
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState("");
  const [txStatus, setTxStatus] = useState("");
  const [txHash, setTxHash] = useState("");

  const [baselineText, setBaselineText] = useState("Grant applications are reviewed by two staff members.");
  const [proposalText, setProposalText] = useState("");
  const [proposalBaselineId, setProposalBaselineId] = useState("1");
  const [ledgerBaselineId, setLedgerBaselineId] = useState("1");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const result = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_config",
        args: [],
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      })) as Config;
      setConfig(result);
    } catch (error) {
      toast.error("Could not read StudioNet", { description: errorMessage(error) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadConfig(), 0);
    return () => window.clearTimeout(timer);
  }, [loadConfig]);

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) throw new Error("No EVM-compatible wallet was found in this browser.");
    const accounts = (await window.ethereum.request({ method: "eth_requestAccounts" })) as string[];
    if (!accounts[0]) throw new Error("Wallet connection was not approved.");
    const chainHex = (await window.ethereum.request({ method: "eth_chainId" })) as string;
    if (Number(BigInt(chainHex)) !== 61999) {
      toast.warning("Wrong wallet network", { description: "Switch to GenLayer StudioNet (chain ID 61999) before writing." });
    }
    setAccount(accounts[0]);
    toast.success("Wallet connected", { description: compact(accounts[0]) });
    return accounts[0];
  }, []);

  const waitForFinal = useCallback(async (hash: string) => {
    const started = Date.now();
    while (Date.now() - started < 10 * 60 * 1000) {
      const response = await fetch(RPC_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] }),
      });
      const payload = (await response.json()) as { result?: { status?: string } };
      const status = payload.result?.status;
      if (status) setTxStatus(status);
      if (status === "FINALIZED") return;
      if (status === "CANCELED" || status === "UNDETERMINED") throw new Error(`Transaction ended with status ${status}.`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error("Confirmation is taking longer than expected. Keep the transaction hash and do not resubmit yet.");
  }, []);

  const write = useCallback(async (functionName: string, args: CalldataEncodable[], success: string) => {
    setTxHash("");
    setTxStatus("PREPARING");
    try {
      const wallet = account || await connectWallet();
      if (!window.ethereum) throw new Error("Wallet provider unavailable.");
      const client = createClient({ chain, account: wallet as `0x${string}`, provider: window.ethereum as never });
      const hash = await client.writeContract({ address: CONTRACT_ADDRESS, functionName, args, value: 0n, leaderOnly: false });
      setTxHash(hash);
      setTxStatus("SUBMITTED");
      toast.info("Transaction submitted", { description: compact(hash) });
      await waitForFinal(hash);
      setTxStatus("FINALIZED");
      toast.success(success, { description: compact(hash) });
      await loadConfig();
      return hash;
    } catch (error) {
      setTxStatus("STOPPED");
      toast.error("Operation stopped", { description: errorMessage(error) });
      throw error;
    }
  }, [account, connectWallet, loadConfig, waitForFinal]);

  const loadBaseline = useCallback(async (override?: number) => {
    const id = override ?? positiveInteger(ledgerBaselineId, "Baseline ID");
    setLedgerLoading(true);
    try {
      const baseline = (await readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_baseline",
        args: [id],
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      })) as Baseline;
      const first = Math.max(1, baseline.attempt_count - 49);
      const ids = Array.from({ length: baseline.attempt_count ? baseline.attempt_count - first + 1 : 0 }, (_, index) => first + index);
      const attempts = await Promise.all(ids.map((attemptId) => readClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_attempt",
        args: [id, attemptId],
        transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
      }) as Promise<Attempt>));
      const next = { baseline, attempts };
      setLedgerBaselineId(String(id));
      setProposalBaselineId(String(id));
      setLedger(next);
      return next;
    } catch (error) {
      toast.error("Baseline could not be read", { description: errorMessage(error) });
      throw error;
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerBaselineId]);

  const createBaseline = async () => {
    try {
      if (!baselineText.trim()) throw new Error("Enter a baseline statement.");
      const nextId = (config?.baseline_count ?? 0) + 1;
      await write("create_baseline", [baselineText], "Immutable baseline created");
      const id = String(nextId);
      setProposalBaselineId(id);
      setLedgerBaselineId(id);
      await loadBaseline(nextId);
    } catch (error) {
      if (txStatus !== "STOPPED") toast.error(errorMessage(error));
    }
  };

  const submitProposal = async () => {
    try {
      const id = positiveInteger(proposalBaselineId, "Baseline ID");
      if (!proposalText.trim()) throw new Error("Enter a proposal to evaluate.");
      await write("propose", [id, proposalText], "Semantic verdict finalized");
      setProposalText("");
      await loadBaseline(id);
    } catch (error) {
      if (txStatus !== "STOPPED") toast.error(errorMessage(error));
    }
  };

  const loadProposalState = () => {
    try {
      const id = positiveInteger(proposalBaselineId, "Baseline ID");
      setLedgerBaselineId(String(id));
      void loadBaseline(id).catch(() => undefined);
    } catch (error) {
      toast.error("Baseline could not be read", { description: errorMessage(error) });
    }
  };

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ModelContext["registerTool"]>[0]) => void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    register({
      name: "inspect_axiomgate_baseline",
      title: "Inspect AxiomGate baseline",
      description: "Read one finalized baseline and its latest semantic decisions.",
      inputSchema: { type: "object", properties: { baselineId: { type: "integer", minimum: 1 } }, required: ["baselineId"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input) {
        const id = Number((input as { baselineId?: unknown }).baselineId);
        if (!Number.isInteger(id) || id < 1) throw new Error("baselineId must be a positive integer");
        setActive("Ledger");
        return loadBaseline(id);
      },
    });
    register({
      name: "stage_axiomgate_baseline",
      title: "Stage AxiomGate baseline",
      description: "Populate an immutable baseline for user review without submitting a transaction.",
      inputSchema: { type: "object", properties: { baselineText: { type: "string", minLength: 1, maxLength: 3000 } }, required: ["baselineText"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const text = (input as { baselineText?: unknown }).baselineText;
        if (typeof text !== "string" || !text.trim()) throw new Error("baselineText is required");
        setBaselineText(text);
        setActive("Baseline");
        return { staged: true, submitted: false };
      },
    });
    register({
      name: "stage_axiomgate_proposal",
      title: "Stage AxiomGate proposal",
      description: "Populate a proposal against a baseline for user review without submitting it.",
      inputSchema: { type: "object", properties: { baselineId: { type: "integer", minimum: 1 }, proposalText: { type: "string", minLength: 1, maxLength: 3000 } }, required: ["baselineId", "proposalText"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute(input) {
        const value = input as { baselineId?: unknown; proposalText?: unknown };
        if (!Number.isInteger(Number(value.baselineId)) || typeof value.proposalText !== "string") throw new Error("Valid baselineId and proposalText are required");
        setProposalBaselineId(String(value.baselineId));
        setProposalText(value.proposalText);
        setActive("Proposal");
        return { staged: true, submitted: false };
      },
    });
    return () => lifecycle.abort();
  }, [loadBaseline]);

  const metrics = useMemo(() => [
    ["BASELINES", loading ? "—" : String(config?.baseline_count ?? 0), "immutable anchors"],
    ["PROPOSALS", loading ? "—" : String(config?.proposal_count ?? 0), "append-only attempts"],
    ["MODEL CAP", config ? String(config.max_model_calls_per_baseline) : "—", "per baseline"],
    ["SOURCE", "VERIFIED", `${SOURCE_SHA.slice(0, 7)}…${SOURCE_SHA.slice(-5)}`],
  ], [config, loading]);

  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  };

  return (
    <main className="axiom-shell">
      <Toaster position="bottom-right" richColors closeButton />
      <header className="topbar">
        <button className="brand" onClick={() => setActive("Overview")} aria-label="AxiomGate overview">
          <span className="brand-mark"><GitBranch size={20} /></span>
          <span><strong>AxiomGate</strong><small>PREMISE CONTROL LEDGER</small></span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {nav.map((item, index) => <button key={item} className={active === item ? "active" : ""} onClick={() => setActive(item)}><span>{String(index + 1).padStart(2, "0")}</span>{item}</button>)}
        </nav>
        <div className="top-actions">
          <a className="contract-pill" href={EXPLORER_URL} target="_blank" rel="noreferrer"><i />{compact(CONTRACT_ADDRESS)}</a>
          <Button className="wallet-button" onClick={() => void connectWallet().catch((error) => toast.error("Wallet connection stopped", { description: errorMessage(error) }))}><Wallet />{account ? compact(account) : "Connect"}</Button>
        </div>
      </header>

      <div className="network-strip"><span><i /> STUDIONET / 61999</span><span>CONTRACT v{config?.version ?? "1.1"}</span><span className="strip-note">Immutable anchor · semantic gate · append-only evidence</span></div>

      {active === "Overview" && (
        <div className="page-frame">
          <section className="hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">GENLAYER / HIDDEN PREMISE CONTROL</span>
              <h1>Let proposals move.<br /><em>Make assumptions prove.</em></h1>
              <p>Anchor a statement, evaluate each proposal against what it actually guarantees, and preserve every accepted or blocked decision in one public ledger.</p>
              <div className="hero-actions"><Button size="lg" className="primary-action" onClick={() => setActive("Baseline")}>Create a baseline <ArrowRight /></Button><Button size="lg" variant="outline" className="secondary-action" onClick={() => setActive("Ledger")}>Inspect the ledger</Button></div>
            </div>
            <div className="premise-map" aria-label="AxiomGate premise evaluation diagram">
              <div className="grid-layer" /><span className="map-kicker">SEMANTIC PATH / TWO VERDICTS</span>
              <div className="trace trace-a" /><div className="trace trace-b" />
              <div className="map-node anchor"><span>01 / ANCHOR</span><strong>Baseline</strong><small>IMMUTABLE</small></div>
              <div className="map-node change"><span>02 / CHANGE</span><strong>Proposal</strong><small>EVALUATED</small></div>
              <div className="gate-core"><GitBranch /><strong>AXIOMGATE</strong><small>SEMANTIC CHECK</small></div>
              <div className="verdict-token pass"><CheckCircle2 /> NO NEW PREMISE</div>
              <div className="verdict-token stop"><XCircle /> UNSUPPORTED</div>
            </div>
          </section>
          <section className="metric-grid" aria-label="Live contract summary">{metrics.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</section>
          <section className="rule-grid"><article><span>01 / ANCHOR</span><h2>The original stays put.</h2><p>Every baseline is immutable, so later proposals cannot rewrite their own standard.</p></article><article><span>02 / DISTINGUISH</span><h2>New work is allowed.</h2><p>An added action is not automatically a hidden premise. The dependency is what matters.</p></article><article><span>03 / REMEMBER</span><h2>Every attempt survives.</h2><p>Accepted work grows the effective baseline; blocked premises remain visible in history.</p></article></section>
        </div>
      )}

      {active === "Baseline" && (
        <div className="page-frame operational-page">
          <section className="module-heading"><div><span className="eyebrow">01 / IMMUTABLE ANCHOR</span><h1>State what is true.<br />Then lock it.</h1></div><p>The creating wallet owns the baseline. Its original text never changes; only accepted proposals can extend the effective context.</p></section>
          <section className="form-layout">
            <div className="form-card wide-card"><div className="card-index">B</div><Field label="Baseline statement" hint={`${baselineText.length} / 3000`}><Textarea value={baselineText} maxLength={3000} onChange={(event) => setBaselineText(event.target.value)} rows={8} placeholder="Write the complete governing statement…" /></Field><Button className="submit-action" onClick={() => void createBaseline()}><Database /> Create immutable baseline</Button><StatusPanel status={txStatus} hash={txHash} /></div>
            <aside className="side-stack"><article><span>OWNER</span><h3>Wallet-scoped writes</h3><p>Only the wallet that creates a baseline can submit proposals against it.</p></article><article><span>ORIGINAL</span><h3>Never rewritten</h3><p>The immutable source remains the controlling anchor for every semantic decision.</p></article><article><span>EFFECTIVE</span><h3>Grows by acceptance</h3><p>Accepted proposals extend context; blocked attempts leave it unchanged.</p></article></aside>
          </section>
        </div>
      )}

      {active === "Proposal" && (
        <div className="page-frame operational-page">
          <section className="module-heading"><div><span className="eyebrow">02 / SEMANTIC GATE</span><h1>Change the plan.<br />Expose the premise.</h1></div><p>Validators ask whether the proposal materially depends on a condition that the original and effective baselines do not guarantee.</p></section>
          <section className="form-layout proposal-layout">
            <div className="form-card wide-card"><div className="card-index">P</div><Field label="Baseline ID"><Input inputMode="numeric" value={proposalBaselineId} onChange={(event) => setProposalBaselineId(event.target.value)} /></Field><Field label="Proposal text" hint={`${proposalText.length} / 3000`}><Textarea value={proposalText} maxLength={3000} onChange={(event) => setProposalText(event.target.value)} rows={9} placeholder="Describe the proposed action or change…" /></Field><div className="proposal-actions"><Button className="submit-action" onClick={() => void submitProposal()}><ScanSearch /> Submit for verdict</Button><Button variant="outline" onClick={loadProposalState}><RefreshCw /> Load state</Button></div><StatusPanel status={txStatus} hash={txHash} /></div>
            <aside className="baseline-preview"><span>CURRENT BASELINE</span>{ledger ? <><strong>#{ledger.baseline.baseline_id}</strong><p>{ledger.baseline.baseline_text}</p><dl><div><dt>Attempts</dt><dd>{ledger.baseline.attempt_count}</dd></div><div><dt>Model calls</dt><dd>{ledger.baseline.model_calls}</dd></div><div><dt>Active</dt><dd>{ledger.baseline.active_proposal_count}</dd></div><div><dt>Blocked</dt><dd>{ledger.baseline.premise_blocks}</dd></div></dl></> : <div className="mini-empty"><Layers3 /><p>Load a baseline to preview its current state.</p></div>}</aside>
          </section>
          <section className="verdict-grid"><article className="compatible"><span>NO_NEW_MATERIAL_PREMISE</span><h3>Proposal activates</h3><p>The change adds work without depending on an unsupported condition.</p></article><article className="conflict"><span>NEW_UNSUPPORTED_PREMISE</span><h3>Proposal stays blocked</h3><p>The change materially depends on something the baseline does not guarantee.</p></article></section>
        </div>
      )}

      {active === "Ledger" && (
        <div className="page-frame operational-page">
          <section className="ledger-heading"><div><span className="eyebrow">03 / APPEND-ONLY EVIDENCE</span><h1>Read every premise decision.</h1></div><div className="load-row"><Input aria-label="Baseline ID" inputMode="numeric" value={ledgerBaselineId} onChange={(event) => setLedgerBaselineId(event.target.value)} /><Button className="submit-action" disabled={ledgerLoading} onClick={() => void loadBaseline().catch(() => undefined)}>{ledgerLoading ? <LoaderCircle className="spin" /> : <RefreshCw />} Load baseline</Button></div></section>
          {ledger ? <>
            <section className="ledger-metrics"><article><span>BASELINE</span><strong>#{ledger.baseline.baseline_id}</strong><small>{compact(ledger.baseline.owner)}</small></article><article><span>ATTEMPTS</span><strong>{ledger.baseline.attempt_count}</strong><small>append-only</small></article><article><span>ACTIVE</span><strong>{ledger.baseline.active_proposal_count}</strong><small>accepted changes</small></article><article><span>BLOCKED</span><strong>{ledger.baseline.premise_blocks}</strong><small>unsupported premises</small></article></section>
            <section className="baseline-band"><div><span>ORIGINAL BASELINE</span><p>{ledger.baseline.baseline_text}</p></div><div><span>EFFECTIVE BASELINE</span><p>{ledger.baseline.effective_baseline_text}</p></div></section>
            <section className="attempt-section"><div className="section-title"><History /><span><strong>Proposal attempts</strong><small>Latest 50 finalized decisions</small></span></div>{ledger.attempts.length ? <div className="record-list">{ledger.attempts.map((attempt) => <article className="record-card" key={attempt.attempt_id}><div><span>ATTEMPT {String(attempt.attempt_id).padStart(2, "0")} · P{attempt.proposal_id}</span><VerdictBadge attempt={attempt} /></div><p>{attempt.proposal_text}</p><footer><small>{compact(attempt.proposer)}</small><small>{attempt.used_cache ? "CACHE HIT" : "FRESH MODEL CALL"}</small><small>{attempt.active ? "ACTIVE" : "INACTIVE"}</small></footer></article>)}</div> : <div className="empty-state"><CircleDot /><p>No proposal attempts recorded for this baseline.</p></div>}</section>
          </> : <div className="ledger-empty"><SearchIcon /><h2>Choose a finalized baseline</h2><p>AxiomGate will load its immutable anchor, effective context and semantic verdict trail.</p></div>}
        </div>
      )}

      {active === "Proof" && (
        <div className="page-frame operational-page">
          <section className="module-heading"><div><span className="eyebrow">04 / DEPLOYMENT PROOF</span><h1>One source.<br />One live semantic gate.</h1></div><p>The interface is pinned to the StudioNet deployment below. The technical class remains HiddenPremiseGuard; AxiomGate is the product and repository name.</p></section>
          <section className="proof-grid"><article className="proof-primary"><FileCheck2 /><span>LIVE CONTRACT</span><h2>{CONTRACT_ADDRESS}</h2><p>GenLayer StudioNet · chain ID 61999</p><div><Button onClick={() => void copy(CONTRACT_ADDRESS, "Contract address")}><Clipboard /> Copy address</Button><Button variant="outline" asChild><a href={EXPLORER_URL} target="_blank" rel="noreferrer">Open explorer <ExternalLink /></a></Button></div></article><article><span>TECHNICAL IDENTITY</span><strong>{config?.name ?? "HiddenPremiseGuard"}</strong><small>v{config?.version ?? "1.1"}</small></article><article><span>PROJECT CONTRACT FILE</span><strong>AxiomGate.py</strong><small>class preserved on-chain</small></article><article><span>SOURCE SHA-256</span><strong>{SOURCE_SHA.slice(0, 16)}…</strong><button onClick={() => void copy(SOURCE_SHA, "Source hash")}>COPY</button></article><article><span>ORIGINAL MUTABLE</span><strong>{config?.original_baseline_immutable === false ? "YES" : "NO"}</strong><small>immutable anchor</small></article></section>
          <section className="guarantee-grid"><article><ShieldCheck /><h3>Binary consensus</h3><p>Validators agree only on one of two bounded semantic verdicts.</p></article><article><GitBranch /><h3>Growing context</h3><p>Accepted additions extend the effective baseline while preserving the original.</p></article><article><ShieldAlert /><h3>Safe failure</h3><p>Model, transport, parsing and non-convergence failures write no semantic result.</p></article></section>
        </div>
      )}

      <footer className="footer"><span><GitBranch /> AXIOMGATE / STUDIONET</span><span>Assumptions stay visible before they become dependencies</span><a href={EXPLORER_URL} target="_blank" rel="noreferrer">Explore contract <ExternalLink /></a></footer>
    </main>
  );
}

function SearchIcon() {
  return <FileText />;
}
