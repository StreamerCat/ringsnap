# RingSnap Agent Architecture

This document describes the complete agent-driven workflow for RingSnap development.

---

## Philosophy

**Spec first, code second.**

Every non-trivial change follows this flow:
1. **Clarify** - Ask precise questions
2. **Choose agents** - Map task to specialized agents
3. **Write spec** - Document problem, solution, steps, risks, tests
4. **Get approval** - For high-risk changes (schema, billing, RLS, signup, Vapi)
5. **Implement** - Agents write code with small diffs, explicit logs
6. **Test** - Run commands and manual verification
7. **Deploy** - With clear rollback plan

---

## Agent Catalog

### 🗺️ Planning & Coordination

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@planner-agent](.github/agents/planner-agent.md)** | High-level planning, task selection, spec writing, agent coordination | Start here for all non-trivial work |

### 🎨 Frontend & UX

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@frontend-experience-agent](.github/agents/frontend-experience-agent.md)** | React UI/UX, components, layouts, accessibility | UI changes, new pages, design refinements |

### 🏗️ Infrastructure

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@api-agent](.github/agents/api-agent.md)** | Edge functions, webhooks, external APIs | Backend logic, API endpoints, integrations |
| **[@schema-migration-agent](.github/agents/schema-migration-agent.md)** | Database migrations, constraints, indexes | Schema changes (EXPERT MODE - always ask first) |
| **[@rls-security-agent](.github/agents/rls-security-agent.md)** | Row-level security, data privacy | RLS policies, security audits (EXPERT MODE) |

### 🔥 Critical Flows

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@signup-flow-agent](.github/agents/signup-flow-agent.md)** | Complete signup + trial creation | Signup changes, onboarding, trial creation |
| **[@vapi-provision-agent](.github/agents/vapi-provision-agent.md)** | Telephony provisioning, assistant creation | Vapi integration, phone number provisioning |
| **[@stripe-sync-agent](.github/agents/stripe-sync-agent.md)** | Billing, subscriptions, webhook handling | Stripe integration, billing logic, invoices |

### ✅ Quality

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@test-agent](.github/agents/test-agent.md)** | Test coverage for critical flows | Writing tests (does NOT edit business logic) |
| **[@edge-function-debug-agent](.github/agents/edge-function-debug-agent.md)** | Debugging edge function failures | 500 errors, timeouts, Deno issues |
| **[@flow-observability-agent](.github/agents/flow-observability-agent.md)** | Logging, tracing, monitoring | Adding correlation IDs, status fields, logs |
| **[@flow-observability-agent](.github/agents/flow-observability-agent.md)** | Logging, tracing, monitoring | Adding correlation IDs, status fields, logs |
| **[@data-contract-agent](.github/agents/data-contract-agent.md)** | Cross-system payload contracts | Payload mismatches, type consistency |
| **[@performance-guardian-agent](.github/agents/performance-guardian-agent.md)** | Performance, SEO, A11y | Audits, optimizations, asset shrinking |

### 🛠️ Development

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@lint-agent](.github/agents/lint-agent.md)** | Code style, formatting | Non-logic refactors, formatting fixes |
| **[@dev-deploy-agent](.github/agents/dev-deploy-agent.md)** | Local dev + deployment | Setup, migrations, deployment procedures |
| **[@rollback-agent](.github/agents/rollback-agent.md)** | Incident recovery, rollback procedures | Production incidents, failed deployments |
| **[@env-config-agent](.github/agents/env-config-agent.md)** | Environment variables, secrets | Config management, feature flags |

### 🧪 Testing

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| **[@end-to-end-sim-agent](.github/agents/end-to-end-sim-agent.md)** | Full journey scenario tests | E2E testing, user flow validation |
| **[@docs-agent](.github/agents/docs-agent.md)** | Developer documentation | Creating/updating docs, guides, diagrams |

---

## How to Use Agents

### Example 1: "Signup is broken"

**Step 1:** Start with @planner-agent
```
@planner-agent - Signup is returning 500 errors after payment
```

**Step 2:** Planner asks clarifying questions
- Which step fails? (Stripe, Supabase, Vapi?)
- What's the error message?
- When did this start?
- Is it all signups or specific cases?

**Step 3:** Planner assigns agents
```
Based on logs, this is a Stripe webhook issue.

Assigned agents:
1. @stripe-sync-agent - Fix webhook handler
2. @flow-observability-agent - Add missing logs
3. @test-agent - Add webhook integration tests
```

**Step 4:** Each agent executes their part

---

### Example 2: "Add call volume widget to dashboard"

**Step 1:** @planner-agent writes spec
```markdown
# Feature: Call Volume Widget

## Problem
Users want visibility into call volume trends.

## Solution
Add dashboard card showing:
- Total calls today
- Total calls this week
- Sparkline chart

## Assigned Agents
- @frontend-experience-agent (UI implementation)
- @api-agent (edge function for call data, if needed)
- @data-contract-agent (payload schema)

## Steps
1. @api-agent: Check if call data endpoint exists
2. @frontend-experience-agent: Build CallVolumeCard component
3. @data-contract-agent: Define payload schema
4. @test-agent: Add component tests
```

**Step 2:** Get approval, then agents execute

---

## Risk Levels

### 🟢 Low Risk
- UI refinements
- New non-critical components
- Documentation updates
- Logging improvements
- Non-breaking optional fields

### 🟡 Medium Risk
- New edge functions
- Non-breaking API changes
- Test additions
- New optional database columns

### 🔴 High Risk (ALWAYS ASK FIRST)
- Schema changes (columns, tables, constraints)
- RLS policy changes
- Stripe billing or pricing logic
- Vapi provisioning behavior
- Signup or trial flow changes
- Auth logic changes
- Required field additions (breaking changes)

---

## Critical Flows (Protected)

These flows require explicit approval for ANY changes:

1. **Signup Flow** (`create-trial` edge function)
   - Form → Payment → Account creation → Vapi provisioning
   - Owner: @signup-flow-agent

2. **Vapi Provisioning** (assistant + phone number)
   - Assistant creation → Phone number provisioning
   - Owner: @vapi-provision-agent

3. **Stripe Billing** (webhooks, subscriptions)
   - Invoice processing → Credit application → Referrals
   - Owner: @stripe-sync-agent

4. **Authentication** (login, password reset, magic links)
   - Owner: @api-agent (coordinate with @rls-security-agent)

---

## Quick Reference

### Starting a Task
```
1. @planner-agent - Clarify and spec
2. Get approval for high-risk changes
3. Agents implement
4. Test locally
5. Deploy to staging
6. Verify
7. Deploy to production
```

### Committing Changes
```bash
# Small, focused commits
git add <files>
git commit -m "agent: Brief description"

# Examples:
git commit -m "signup: Add company size field"
git commit -m "vapi: Fix phone number fallback"
git commit -m "stripe: Handle subscription downgrade"
```

### Creating PRs
```markdown
# PR Title: [Agent] Brief description

## Summary
What changed and why

## Agents Involved
- @api-agent - Edge function updates
- @test-agent - Integration tests

## Test Plan
- [ ] Tested locally
- [ ] All tests pass
- [ ] Manual verification steps

## Risk Level
Low / Medium / High

## Rollback Plan
How to revert if needed
```

---

## Agent Boundaries

### Expert-Mode Agents (Always Ask First)
- **@schema-migration-agent** - Database schema changes
- **@rls-security-agent** - Security policy changes

### Critical Flow Agents (Ask for High-Risk Changes)
- **@signup-flow-agent** - Signup modifications
- **@vapi-provision-agent** - Provisioning changes
- **@stripe-sync-agent** - Billing logic changes

### Safe Agents (Can Act Independently)
- **@test-agent** - Adding tests
- **@lint-agent** - Formatting
- **@docs-agent** - Documentation
- **@flow-observability-agent** - Logging

---

## Getting Help

### For Developers
- **New to RingSnap?** Start with @docs-agent → Read onboarding guides
- **Need to understand a flow?** Ask @planner-agent to map it out
- **Have a feature request?** Start with @planner-agent for spec

### For Debugging
- **500 errors?** @edge-function-debug-agent
- **Signup broken?** @signup-flow-agent + @api-agent
- **Vapi not provisioning?** @vapi-provision-agent
- **Stripe webhook issues?** @stripe-sync-agent
- **Can't trace request?** @flow-observability-agent

---

## File Structure

```
.github/
└── agents/
    ├── planner-agent.md
    ├── frontend-experience-agent.md
    ├── api-agent.md
    ├── schema-migration-agent.md
    ├── rls-security-agent.md
    ├── signup-flow-agent.md
    ├── vapi-provision-agent.md
    ├── stripe-sync-agent.md
    ├── test-agent.md
    ├── edge-function-debug-agent.md
    ├── flow-observability-agent.md
    ├── data-contract-agent.md
    ├── lint-agent.md
    ├── dev-deploy-agent.md
    ├── rollback-agent.md
    ├── env-config-agent.md
    ├── end-to-end-sim-agent.md
    └── docs-agent.md

AGENTS.md (this file)
```

---

## Next Steps

1. **Read this file** to understand the agent architecture
2. **Review individual agent specs** in `.github/agents/`
3. **Start with @planner-agent** for any new work
4. **Follow the spec-first workflow** for all medium/high-risk changes
5. **Protect critical flows** by always asking before modifying signup, billing, or provisioning

---

**Maintained By:** RingSnap Engineering Team
**Last Updated:** 2025-11-20
**Version:** 1.0
