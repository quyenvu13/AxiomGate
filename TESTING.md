# AxiomGate testing

## Deployment target

```text
Network: GenLayer StudioNet
Chain ID: 61999
Contract: 0xb521C0AE4660E4C57D78DAeB0045302EdF570C60
Technical class: HiddenPremiseGuard
Repository file: contract/AxiomGate.py
Version: 1.1
```

## Build checks

```bash
python -m py_compile contract/AxiomGate.py
sha256sum contract/AxiomGate.py
pnpm lint
pnpm build
```

Expected contract source hash:

```text
d5c0eebfd8bd8f20c895da053517bd7f7ab17d0585e49866a66c55884d11c527
```

## Read-only smoke test

1. Open the application without connecting a wallet.
2. Confirm the top bar displays the shortened new contract address.
3. Confirm Overview loads contract version `1.1` and live counters.
4. Open **Proof** and verify the complete address and explorer link.
5. Enter a finalized baseline ID under **Ledger** and load its state.

## Write flow

1. Connect an EVM-compatible wallet on chain `61999`.
2. Open **Baseline** and create:

```text
Grant applications are reviewed by two staff members.
```

3. Wait until the transaction becomes `FINALIZED`. Do not resubmit while the
   current transaction hash is still pending or accepted.
4. Open **Proposal** and submit this direct action:

```text
Add a one-line review summary to each grant application.
```

Expected verdict: `NO_NEW_MATERIAL_PREMISE`.

5. Submit this explicit unsupported assumption:

```text
Applications will be cleared in one weekly batch on the assumption that the two staff members can process the entire week's volume in one sitting.
```

Expected verdict: `NEW_UNSUPPORTED_PREMISE`.

6. Submit the blocked text again without changing any character. Expected:
   `used_cache = true`, attempt count increases, model-call count does not.
7. Open **Ledger** and confirm only the accepted proposal appears in the
   effective baseline while all attempts remain visible.

## Responsive and interaction checks

- Desktop navigation switches all five sections without reloading.
- Mobile navigation remains horizontally scrollable.
- Wallet and contract controls remain usable at narrow widths.
- Long addresses and proposal text wrap without horizontal overflow.
- Transaction failures show a toast and preserve the transaction hash.
- The interface never automatically resubmits a write.
