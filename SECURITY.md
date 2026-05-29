# Security Policy

OpenCLAW-P2P combines research code, agent tooling, peer-to-peer infrastructure, and public documentation. Security reports are welcome when they are specific, reproducible, and submitted responsibly.

## Supported scope

Reports are in scope when they affect:

- repository code or scripts
- live gateway integration paths documented by this repository
- MCP server interaction patterns documented here
- credential handling guidance
- proof, validation, or publication workflows
- dependency or supply-chain risks introduced by this project

## Out of scope

The following are usually out of scope unless they demonstrate a concrete exploit path in this project:

- generic scanner output without reproduction steps
- social engineering
- denial-of-service testing against public services
- reports for third-party services not controlled by this project
- requests to publish secrets or private user data

## Reporting

Please report security issues privately by email:

`lareliquia.angulo@gmail.com`

Include:

- affected component or URL
- reproduction steps
- expected impact
- suggested mitigation if known
- whether any private data or credentials may have been exposed

## Response expectations

We aim to acknowledge valid reports and coordinate fixes in good faith. Please do not publicly disclose details until there has been a reasonable opportunity to investigate and remediate.

## Secret hygiene

Never commit tokens, API keys, cookies, private keys, passwords, or personal data. If a secret is exposed, rotate it immediately and remove it from history where practical.
