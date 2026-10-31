// Credits and plans: every number in one place.
//
// PLACEHOLDER NUMBERS. Nothing here is a decided price (open questions #55 to #60 in the project
// notes). Change a number here, then run `node preview/build-links.mjs` so the `credits` edge function
// (which keeps the balance and enforces the limits) uses the same numbers, and redeploy it.
//
// Who pays what (decided 2026-10-29):
//   * homeowners (consumer accounts) pay only in credits: they buy packs, and actions spend them;
//   * contractors, property managers and builders (business accounts) pay a monthly plan that comes
//     with credits, and each plan tier limits how many plans, floors and square feet they can have.

export type AccountKind = "consumer" | "business";
export type TierId = "free" | "pro" | "team" | "business";
export type ActionId = "plan_create" | "assistant_ask" | "place_item" | "voice_minute" | "render_3d";

export interface Tier {
  id: TierId;
  name: string;
  /** US dollars a month; 0 is free */
  price: number;
  /** credits that come with the plan each month */
  monthlyCredits: number;
  /** null means no limit */
  maxPlans: number | null;
  maxFloors: number | null;
  /** total finished square feet in one plan (every floor added up) */
  maxSqft: number | null;
  blurb: string;
}

export interface Pack { id: string; credits: number; price: number; label?: string }

export interface Action {
  id: ActionId;
  name: string;
  /** what one use costs in credits, by kind of account (0 is free) */
  cost: Record<AccountKind, number>;
  /** what one use is, for the price list ("per question") */
  per: string;
  /** shown on the price list but not charged anywhere yet */
  soon?: boolean;
}

export const CREDITS = {
  /** while true, "Buy credits" and changing plans work without any payment (no Stripe yet) */
  testPayments: true,

  /** credits a new homeowner account starts with, once */
  consumerWelcome: 50,
  /** credits a homeowner earns when a contractor they sent their project to starts a paid plan */
  referralBonus: 100,
  /** unused monthly plan credits carry over to the next month (credits people bought always do) */
  rolloverMonthly: false,
  /** how long one plan month is */
  periodDays: 30,

  /** what a homeowner's single plan may be (they have no tier; each plan costs credits) */
  consumerLimits: { maxPlans: null, maxFloors: 4, maxSqft: 8000 } as Pick<Tier, "maxPlans" | "maxFloors" | "maxSqft">,

  tiers: [
    { id: "free", name: "Free", price: 0, monthlyCredits: 50, maxPlans: 2, maxFloors: 2, maxSqft: 2500, blurb: "Try it on a job or two." },
    { id: "pro", name: "Pro", price: 49, monthlyCredits: 300, maxPlans: 10, maxFloors: 3, maxSqft: 5000, blurb: "For a contractor running a few jobs at once." },
    { id: "team", name: "Team", price: 149, monthlyCredits: 1000, maxPlans: 40, maxFloors: 4, maxSqft: 10000, blurb: "For a company with crews on many jobs." },
    { id: "business", name: "Business", price: 399, monthlyCredits: 3000, maxPlans: null, maxFloors: null, maxSqft: 50000, blurb: "Builders and property managers with big buildings." },
  ] as Tier[],

  packs: [
    { id: "p100", credits: 100, price: 10 },
    { id: "p300", credits: 300, price: 25, label: "Most picked" },
    { id: "p1000", credits: 1000, price: 70, label: "Best value" },
  ] as Pack[],

  actions: [
    { id: "plan_create", name: "Make a new plan", per: "per plan", cost: { consumer: 20, business: 10 } },
    { id: "assistant_ask", name: "Ask the assistant", per: "per question", cost: { consumer: 1, business: 1 } },
    { id: "place_item", name: "Place furniture or an object", per: "per item", cost: { consumer: 1, business: 0 } },
    { id: "voice_minute", name: "Realistic voice", per: "per minute", cost: { consumer: 5, business: 5 }, soon: true },
    { id: "render_3d", name: "3D render", per: "per render", cost: { consumer: 10, business: 10 }, soon: true },
  ] as Action[],
};
