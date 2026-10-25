// Same defaults as public.default_stage_templates() in the database migration.
const s = (...names: string[]) => names.map((name) => ({ name }));

export const DEFAULT_TEMPLATES = [
  { name: "Full renovation", job_type: "renovation", stages: s("Survey and plan", "Demolition", "Structural and framing", "Rough-in: plumbing, electrical, HVAC", "Inspection", "Insulation and drywall", "Finishes: flooring, tile, paint", "Fixtures and trim", "Punch list", "Handover") },
  { name: "Kitchen remodel", job_type: "kitchen", stages: s("Design and measure", "Demolition", "Rough-in: plumbing and electrical", "Drywall and paint", "Cabinets", "Countertops", "Backsplash and tile", "Appliances and fixtures", "Punch list", "Handover") },
  { name: "Bathroom remodel", job_type: "bathroom", stages: s("Design and measure", "Demolition", "Rough-in plumbing and electrical", "Waterproofing", "Tile", "Vanity, toilet and fixtures", "Glass and accessories", "Punch list", "Handover") },
  { name: "New build", job_type: "new_build", stages: s("Permits", "Site work", "Foundation", "Framing", "Roof and windows", "Rough-in: plumbing, electrical, HVAC", "Inspection", "Insulation and drywall", "Interior finishes", "Exterior finishes", "Final inspection", "Handover") },
  { name: "Insurance restoration", job_type: "restoration", stages: s("Inspection and damage report", "Insurance approval", "Mitigation and cleanup", "Demolition of damaged areas", "Structural repairs", "Rough-in repairs", "Drywall and finishes", "Final walkthrough", "Closeout with insurer") },
];

export const JOB_TYPES: { value: string; label: string }[] = [
  { value: "renovation", label: "Full renovation" },
  { value: "kitchen", label: "Kitchen" },
  { value: "bathroom", label: "Bathroom" },
  { value: "new_build", label: "New build" },
  { value: "restoration", label: "Insurance restoration" },
  { value: "other", label: "Other" },
];
