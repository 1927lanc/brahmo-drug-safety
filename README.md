 # Brahmo Drug Safety Engine

A deterministic drug safety layer that runs BEFORE AI responds to doctor questions, catching dangerous drug interactions, allergy conflicts, and dosing errors.

## Live Demo
- Select a patient from the list
- Enter a drug to prescribe
- Run Safety Check to see deterministic alerts
- Compare Generic AI vs Safety-Enhanced AI responses side by side

## Setup Instructions

### Prerequisites
- Node.js v18+
- Git

### Installation

1. Clone the repo:
git clone https://github.com/1927lanc/brahmo-drug-safety.git
cd brahmo-drug-safety

2. Install dependencies:
npm install

3. Create `.env.local` file:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
GEMINI_API_KEY=your_gemini_key

4. Run the app:
npm run dev

5. Open http://localhost:3000

## Demo Scenarios

| Scenario | Patient | Drug | What it catches |
|----------|---------|------|-----------------|
| 1 | Patient 3 - Polypharmacy | Clarithromycin | SEVERE: CYP3A4 → rhabdomyolysis + MODERATE: hypotension |
| 2 | Patient 1 - Penicillin Allergy | Amoxicillin-Clavulanate | HARD BLOCK: Anaphylaxis allergy |
| 3 | Patient 7 - ICU Sepsis | Gabapentin | RENAL: eGFR 18.7 → 100mg OD only |
| 4 | Patient 8 - AF Stroke Risk | Warfarin | CHA₂DS₂-VASc = 6, stroke risk 9.8%/year |

## Architecture

### Data Flow
Doctor types question
→ Safety Engine (~30ms, deterministic):
├── Drug interaction check (database lookup)
├── Allergy conflict check (direct + cross-reactivity)
├── Renal dosing check (eGFR thresholds)
└── Clinical calculators (eGFR, CHA₂DS₂-VASc)
→ Safety results → constraint text
→ Constraint text prepended to AI system prompt
→ AI responds WITHIN safety constraints

### Tech Stack
- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Safety Engine:** Deterministic database lookups (NOT AI)
- **AI Layer:** Google Gemini API

### Database
- 50 drugs with renal dosing thresholds
- 30 drug interaction pairs
- 8 allergy cross-reactivity rules
- 10 sample patients

### Key Design Decisions
- Safety engine uses pure database lookups — zero hallucination risk
- Drugs and interactions cached in memory for <10ms checks
- Adding new drug = 1 INSERT, zero code changes
- Adding new interaction = 1 INSERT, zero code changes

## Project Structure
src/
├── app/
│   ├── page.tsx              ← Main demo UI
│   └── api/
│       ├── safety-check/     ← Safety engine API
│       └── chat/             ← AI comparison API
├── lib/
│   ├── safety-engine.ts      ← DDI, allergy, renal checks
│   ├── calculators.ts        ← eGFR, CHA₂DS₂-VASc
│   ├── supabase.ts           ← Database client
│   └── types.ts              ← TypeScript interfaces
supabase/
│   └── schema.sql            ← Database schema
docs/
├── architecture.md       ← Architecture decisions
└── data_sources.md       ← Clinical data sources