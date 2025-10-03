You are a highly experienced Lead Architect with a proven, multi-year track record in full-stack web and mobile application development, specializing in scalable and maintainable solutions. Your expertise lies in delivering practical, effective engineering strategies without over-complication or unnecessary over-engineering.

Your task is to facilitate the transition of a currently web-centric application to a fully mobile-supportive platform.

<!-- Progress Tracking: After each phase completion, mark it as completed in this file. -->

# Mobile Readiness Audit & Implementation Roadmap

## Purpose

This document captures the comprehensive audit of Traveal's current web architecture with respect to mobile readiness, along with the phased roadmap required to deliver first-class mobile support across devices.

---

## Phase 1 · Mobile Readiness Audit

### Front-End / UI Findings

- **Desktop-first layout assumptions** – The main shell (`app/page.tsx`) locks the viewport to `h-screen`, fixed 60/40 split panes, and desktop resize handles. Mobile viewports cannot scroll, panels collapse, and touch resize is impossible.
- **Hover and precise pointer dependencies** – Timeline drag-and-drop, map resize, and hover-driven tooltips lack touch equivalents. Gesture handling, focus states, and accessible hit-targets are absent.
- **Map overlays vs. device constraints** – Mapbox GL overlays (search dock, command palette, modals) layer atop WebGL without throttling. Combined with glassmorphism effects, this drives high GPU usage and animation jank on mobile.
- **Component sizing** – No breakpoint-aware variants for typography, spacing, cards, or modals. Most UI assumes ≥1024px width, leading to overflow and clipped content on smaller displays.
- **Accessibility gaps** – Missing reduced-motion fallbacks, aria labels on custom controls, and skip navigation alternatives reduce usability for keyboard and assistive tech users.

### Back-End / API Findings

- **Monolithic payloads** – The Zustand trip store eagerly loads all trips, days, destinations, and routes in single Supabase queries (see `lib/supabase/trip-api.ts`). Mobile clients pay the cost even for quick peeks.
- **Client-exposed credentials** – Supabase anon key and Google Places REST calls originate from the client. This limits server-side optimization and increases attack surface for mobile builds.
- **No offline or caching strategy** – Data is always fetched live. There is no normalized store, delta sync, or background refresh to support spotty mobile connections.
- **Coarse-grained endpoints** – REST endpoints return wide records without projection options. There is no API gateway or BFF adapting payloads for mobile network constraints.

### Deployment / Infrastructure Findings

- **Web-only pipeline** – No PWA manifest, service worker, or offline-first build. Next.js configuration targets desktop browsers only.
- **CDN/image strategy** – `next/image` is available but responsive srcsets and optimized CDN headers are not tuned for mobile bandwidth.
- **Observability gaps** – Mobile-specific KPIs (LCP on 4G, TTI, WebGL FPS) are not tracked. There is no device lab or automated mobile QA in CI.

### Impact Summary

| Domain | Key Gaps | Mobile Impact |
| --- | --- | --- |
| Front-End/UI | Desktop-only layout; hover-centric interactions; heavy WebGL overlays | Layout collapse, unusable gestures, thermal throttling |
| Back-End/API | Large eager payloads; direct client credentials; no caching | Slow loads, increased data usage, security risk |
| Deployment/Infra | Web-focused builds; lack of PWA/service worker; limited analytics | No installable experience, no offline story, limited insight |

---

## Phase 2 · Implementation Strategy

### Guiding Principles

1. **Responsive-first architecture** – Build for small screens up, progressively enhancing for desktop.
2. **Data efficiency** – Shape, cache, and stream only what mobile sessions need.
3. **Performance budgets** – Set explicit targets (LCP < 3s on 4G, map interactions < 100ms, app bundle < 250KB initial JS).
4. **Incremental delivery** – Land foundational changes early, layer polish and native bridges later.

### Roadmap Overview

| Phase | Goal | Primary Deliverables | Est. Duration |
| --- | --- | --- | --- |
| 0. Discovery & Alignment | Confirm scope, KPIs, UX direction | Analytics gap report, mobile UX prototypes, KPI agreements | 1–2 weeks |
| 1. Core Architecture Refactor | Responsive shell + touch-ready components | Adaptive layout system, touch gesture layer, mobile navigation primitives | 3–4 weeks |
| 2. Map & Performance Optimization | Mapbox experience optimized for constrained devices | Map service abstraction, low-power map mode, lazy layer loading, performance budget tooling | 3 weeks |
| 3. API & Data Hardening | Efficient, secure data delivery | Next.js BFF layer, payload shaping, caching/offline sync, auth hardening | 4 weeks |
| 4. Mobile UX Polish | Fine-tune interactions & accessibility | Device QA, animation tuning, accessibility fixes, localization readiness | 2–3 weeks |
| 5. QA, Beta & Launch | Validate and roll out mobile | Automated regression suite, device lab coverage, beta program, launch playbook | 3 weeks |

Total program estimate: **12–15 weeks**, assuming 1–2 cross-functional squads.

### Detailed Phase Breakdown

#### Phase 0 – Discovery & Alignment

- Audit existing analytics for device mix, bounce rates, and core vitals.
- Define target devices, breakpoints, and must-have mobile user journeys.
- Produce low-fidelity responsive prototypes covering map + itinerary flows.
- Establish non-functional requirements (performance thresholds, offline support levels).

**Deliverables**: KPI registry, UX prototypes, prioritized user stories, updated success metrics.

#### Phase 1 – Core Architecture Refactor

- Introduce responsive layout primitives (CSS grid, Tailwind container queries, safe-area handling).
- Replace `h-screen` desktop shell with stacked/segment layouts for ≤768px.
- Build touch gesture managers for resizing, drag/drop, and modal presentation.
- Refactor Radix dialogs into mobile-friendly sheets/drawers with focus management.
- Create shared component variants (cards, typography, controls) responsive via design tokens.

**Deliverables**: Responsive layout library, component variant catalog, interaction accessibility checklist.

#### Phase 2 – Map & Performance Optimization

- Abstract Mapbox integration to allow feature-flagged mobile modes (reduced layers, simplified styling).
- Implement framerate-aware rendering (throttle animations when backgrounded or on low-power mode).
- Lazy-load heavy map features (routes, markers) behind intersection observers or user intent.
- Evaluate MapLibre GL and Mapbox Native SDK for React Native for future native builds.
- Integrate performance monitoring (Map FPS, memory usage) into dev tooling.

**Deliverables**: Map performance budget, low-power profile docs, automated map regression tests.

#### Phase 3 – API & Data Layer Hardening

- Stand up Next.js Route Handlers acting as a BFF to Supabase + third-party APIs.
- Migrate client direct calls to server-side proxies with response shaping.
- Implement normalized data caches (React Query + SQLite/IndexedDB via TanStack Query persistence).
- Add offline queues for itinerary edits and conflict resolution strategy.
- Secure token handling (short-lived access tokens, device fingerprinting, rate limiting).

**Deliverables**: API gateway spec, caching/offline design, authentication hardening plan, load testing results.

#### Phase 4 – Mobile UX Polish

- Conduct device lab sweeps covering iOS Safari/Chrome, Android Chrome, and PWA installs.
- Tune animations with prefers-reduced-motion respect and haptic feedback on supported devices.
- Ensure touch targets ≥ 44px, improve keyboard navigation, add semantic labels.
- Localize key journeys and confirm RTL responsiveness where applicable.

**Deliverables**: UX polish checklist, accessibility audit report, localization readiness summary.

#### Phase 5 – QA, Beta & Launch

- Expand automated testing (Playwright mobile emulation, Detox for RN if applicable).
- Set up real-device smoke tests (BrowserStack/Appetize or internal lab).
- Prepare PWA manifest, service worker caching strategy, and installation instructions.
- Launch private beta (TestFlight/PWA) with telemetry dashboards (Datadog, Vercel Analytics, Sentry).
- Document rollback procedures and support playbooks.

**Deliverables**: Beta feedback log, monitoring dashboards, release checklist, support SOPs.

### Technology Recommendations

- **Responsive Web / PWA Baseline**: Continue leveraging Next.js 15 with Tailwind. Add `next-pwa` or Workbox-based service worker, PWA manifest, and push notification hooks (if needed).
- **Mobile Gesture & Animation Stack**: Use `@use-gesture/react` or `react-native-web` compatible gesture primitives; align animations with Framer Motion's reduced-motion utilities.
- **Data Layer**: Introduce a BFF (Next.js handlers) with caching (Redis/Upstash) and adopt React Query persistence for offline resilience.
- **Native Bridge (optional Phase 2+)**: Evaluate Expo/React Native with shared business logic via Zustand adapters, integrating Mapbox Maps SDK for RN for higher fidelity experiences.
- **Observability**: Instrument performance tracing (Web Vitals via Vercel Analytics, custom Map FPS metrics, Sentry session replay) and set mobile-specific alerts.

### Prioritization & Milestones

1. **Weeks 1–2**: Discovery complete, KPIs approved, UX prototypes signed off.
2. **Weeks 3–6**: Responsive shell + touch-first UI in production behind feature flag.
3. **Weeks 7–9**: Map optimizations + BFF in place, data payloads reduced ≥40%.
4. **Weeks 10–11**: Offline caching, auth hardening, performance tuning.
5. **Weeks 12–13**: QA, beta rollout, telemetry validation, launch readiness.

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Scope creep from simultaneous native + web goals | Medium | High | Phase gate native exploration until responsive web MVP is stable |
| Map performance remains poor on older devices | Medium | Medium | Offer simplified map mode, reduce layer density, consider static map previews |
| Offline sync conflicts | Low | Medium | Implement deterministic merge strategy, surface conflict UI for manual resolution |
| Team unfamiliarity with mobile a11y standards | Medium | Medium | Provide training, embed accessibility SME, add automated linting (axe-core, eslint-plugin-jsx-a11y) |

---

## Next Actions

- Align stakeholders on roadmap scope and resource allocation.
- Kick off Phase 0 discovery with product/design.
- Stand up observability dashboard baseline before major refactors.
- Schedule weekly checkpoints to track phase burndown and KPI progress.

