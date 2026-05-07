# 2026-05-06 - Project Read and Phase 4 Review

## Context

Marios asked Codex to review `PHASE4.md`, then `README.md`, then `SPEC.md` and `SPEC2.md` to understand the project.

## Project Read

The app is a multi-tenant SaaS financial management platform for restaurants, initially focused on UK fast food and quick service restaurants.

The strongest product idea is not only bookkeeping. It is helping restaurant owners understand which channels, promotions, costs, and operational choices are actually making money.

## Phase 4 Status

- Task 1, `ExpectancySnapshot` table, is done.
- Task 2, weekly snapshot helper, appears implemented but still marked in progress in `PHASE4.md`.
- Task 3, channel expectancy calculator, is implemented and verified against a thin one-week fixture, but paused awaiting a closure decision.
- Tasks 4 to 10 remain for the Expectancy slice: read API, UI page, sidebar link, promotion expectancy, labour expectancy, ingredient expectancy, and weekly recalc cron.
- Correlations, Health Score, and Scenario Modelling still need detailed breakdown and implementation.

## Product Take

Codex's read: the app has a strong commercial shape if it is positioned as a restaurant decision engine rather than generic accounting software.

The most valuable wedge appears to be platform profitability: answering whether Uber Eats, Deliveroo, Just Eat, walk-in revenue, and promotions are genuinely profitable after commission, food cost, payroll, overhead, and promo spend.

## Main Risks Noted

- Scope is large: finance, payroll, inventory, reporting, ingestion, billing, admin, and analytics.
- Trust is critical because users will rely on the calculations for money decisions.
- Financial values stored as floating-point numbers may become a future accuracy risk.
- Correlation and scenario features need careful wording so they guide rather than overpromise.
- Email ingestion is valuable but brittle because platform CSV formats can change.

## Follow-ups

- Decide how to close Phase 4 Task 3.
- Build the Expectancy read API and page next if continuing Phase 4.
- Consider improving project-facing documentation later so the README reflects the real app.
