// Quick furnishing asks, one tap each, said to the assistant that changes the plan: for the whole
// house or one room. Shared by the new-project check and the chat in Build mode.
export const FURNISH: { label: string; ask: (where: string) => string }[] = [
  { label: "Furnish it", ask: (w) => `Furnish ${w} with the usual furniture for each room.` },
  { label: "Kitchen appliances", ask: (w) => `Add the kitchen appliances that are missing${w === "the whole house" ? "" : ` in ${w}`}: fridge, range or cooktop with oven, range hood, dishwasher, sink.` },
  { label: "Bathroom fixtures", ask: (w) => `Add the bathroom fixtures that are missing${w === "the whole house" ? " in every bathroom and WC" : ` in ${w}`}: toilet, basin or vanity, and a shower or bathtub where there's room.` },
  { label: "Laundry", ask: (w) => `Add a washing machine and dryer${w === "the whole house" ? " in the laundry or utility room, or wherever makes sense" : ` in ${w}`}.` },
  { label: "Home office", ask: (w) => `Set up ${w === "the whole house" ? "the study or a spare room" : w} as a home office: desk, chair, bookshelf and a lamp.` },
  { label: "Fewer pieces", ask: (w) => `Make ${w} lighter: keep only the main furniture pieces and remove the extras.` },
  { label: "Clear the furniture", ask: (w) => `Remove all the furniture from ${w} (beds, sofas, tables, chairs, desks, shelves, lamps, plants, TV). Keep the kitchen, bathroom and laundry fixtures.` },
];
