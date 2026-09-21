# AxiomGate

AxiomGate is a GenLayer interface for creating immutable baselines, evaluating
proposals for hidden material premises, and reading the complete append-only
decision trail.

The product name is **AxiomGate**. The deployed technical contract class remains
`HiddenPremiseGuard` so the repository source stays byte-for-byte compatible
with the StudioNet deployment. The repository contract filename is
`contract/AxiomGate.py`, matching the project name as requested.

## Live deployment

- Network: GenLayer StudioNet (`61999`)
- Contract: `0xb521C0AE4660E4C57D78DAeB0045302EdF570C60`
- Explorer: <https://explorer-studio.genlayer.com/address/0xb521C0AE4660E4C57D78DAeB0045302EdF570C60>
- Contract version: `1.1`
- Source SHA-256: `d5c0eebfd8bd8f20c895da053517bd7f7ab17d0585e49866a66c55884d11c527`

## Product flow

1. Create a wallet-owned immutable baseline.
2. Submit a proposal against its original and effective context.
3. GenLayer validators return one bounded semantic verdict:
   - `NO_NEW_MATERIAL_PREMISE`
   - `NEW_UNSUPPORTED_PREMISE`
4. Accepted proposals extend the effective baseline.
5. Blocked proposals remain in the ledger without changing effective context.
6. Exact replays reuse the verdict cache without consuming another model call.

## Interface sections

- **Overview** — live counts and the semantic decision model.
- **Baseline** — create a new immutable anchor.
- **Proposal** — submit a proposal and inspect current state.
- **Ledger** — read baseline text, effective text and every proposal attempt.
- **Proof** — verify the deployment address, technical identity and source hash.

Reads work without a wallet. Writes require an EVM-compatible wallet connected
to GenLayer StudioNet.

## Run locally

```bash
pnpm install
pnpm dev
```

## Production checks

```bash
pnpm lint
pnpm build
```

See [TESTING.md](./TESTING.md) for the manual contract-flow checklist.

## GitHub submission files

Upload the repository source and configuration, including:

```text
app/
components/
contract/AxiomGate.py
lib/
public/
README.md
TESTING.md
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
next.config.ts
postcss.config.mjs
tsconfig.json
```

Do not upload `node_modules`, `.next`, local environment files or
editor-specific folders. Vercel should use the default Next.js preset with
`pnpm build`; leave **Output Directory** empty.
