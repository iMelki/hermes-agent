# Bounded Report-Only Proof

`python -m hermes_cli.bounded_proof` is a narrow entry point for one separately
approved provider proof. It is not a general automation mode.

The entry point fixes these controls before dispatch:

- exactly one provider attempt;
- no fallback provider or credential-pool rotation;
- no requested or effective tools;
- an explicit output-token cap;
- literal input from a reviewed file; and
- a create-new structured result file.

The result reports the exit status, duration, provider and model, session ID,
provider attempts, effective tool surface, tool events, output cap and observed
usage, response, checks, failures, and evidence paths.

Example preparation only:

```powershell
python -m hermes_cli.bounded_proof `
  --input-file C:\reviewed\input.md `
  --result-file C:\evidence\result.json `
  --provider openai-codex `
  --model gpt-5.5 `
  --max-output-tokens 2000
```

Do not run this command from a scheduler. An external wrapper must also bind a
single-use approval to the exact source commit, input hash, provider/model,
timeout, token cap, and result path, and must compare runtime and repository
state before and after the call.
