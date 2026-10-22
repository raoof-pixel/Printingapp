'use strict';
// Curated copy and merchandising for the generated catalog. Edit freely — prices live in catalog-generated.json.

const categories = [
  { slug: 'rigid-boards', key: 'RIGID', title: 'Rigid boards', short: 'Coroplast, PVC, aluminum, foam, styrene, clear PETG', blurb: 'Lawn signs, site boards, retail displays and wayfinding. Printed direct to the board, cut to any size on the list, with grommets, holes and contour cutting as add-ons.', texture: 'coroplast' },
  { slug: 'vinyl-and-window', key: 'ADHESIVES & CLINGS', title: 'Vinyl and window graphics', short: 'Adhesive vinyl, static cling, optical clear', blurb: 'Stickers, wall and floor graphics, storefront windows. Laminated for durability or dry-erase, cut to shape.', texture: 'vinyl' },
  { slug: 'banners', key: 'BANNERS', title: 'Banners', short: 'Scrim vinyl, mesh, smooth, fabric', blurb: 'Outdoor-grade vinyl, wind-friendly mesh and fabric for stages and trade shows. Hemmed and grommeted the way you ask.', texture: 'banner' },
  { slug: 'election-signs', key: 'ELECTION SIGNS', title: 'Election signs', short: 'Screen-printed 4mm coroplast', blurb: 'Screen-printed campaign signs in one or two colours, double-sided, for runs of hundreds. Quoted per campaign.', texture: 'election' },
];
const categorySlugFor = Object.fromEntries(categories.map((c) => [c.key, c.slug]));

const groups = {
  'Coroplast': 'Corrugated plastic in 4, 6 and 10 mm. The lawn-sign standard: light, weatherproof, takes H-stakes.',
  'PVC board': 'Expanded PVC in 3 to 12 mm. Smooth, matte, rigid — the indoor signage workhorse that also lives outdoors.',
  'Styrene': 'Thin, flexible white plastic sheet in .020, .030 and .060. Shelf talkers, inserts and light-box faces.',
  'Clear PETG': 'Crystal-clear plastic sheet in .020 and .040. Counter shields, overlays and clear window signs.',
};

const families = {
  'alupanel-3mm': { title: '3mm Alupanel', texture: 'aluminum', blurb: 'Aluminum composite panel. The long-term outdoor sign.', description: 'Two sheets of aluminum bonded to a solid polyethylene core. Dead flat, rust-free and rigid enough to span a storefront. Printed direct and protected with matte or gloss lamination; dry-erase lamination available on request. Can be contour cut and drilled for mounting.', uses: ['Storefront fascia', 'Real-estate and development signs', 'Parking and safety panels', 'Menu boards'], leadTime: '4 to 5 business days (48×120 custom: 4 to 6)' },
  'coroplast-4mm': { group: 'Coroplast', title: '4mm Coroplast', texture: 'coroplast', blurb: 'The everyday lawn sign.', description: 'Corrugated plastic, 4 mm. Light enough to mail, stiff enough for a stake. Printed one or two sides. Flute direction matters for stakes: vertical flutes take H-stakes.', uses: ['Lawn and election signs', 'Open house and directional signs', 'Event and parking signage'], leadTime: '8 to 9 business days' },
  'coroplast-6mm': { group: 'Coroplast', title: '6mm Coroplast', texture: 'coroplast', blurb: 'Stiffer board for larger panels.', description: 'Corrugated plastic, 6 mm. Holds its shape at 36 and 48 inch widths where 4 mm starts to flex.', uses: ['Construction site boards', 'Large directional signs', 'Trade-show panels'], leadTime: '8 to 9 business days' },
  'coroplast-10mm': { group: 'Coroplast', title: '10mm Coroplast', texture: 'coroplast', blurb: 'Heavy-duty corrugated board.', description: 'Corrugated plastic, 10 mm. For full sheets and panels that must stay flat in wind.', uses: ['Site hoarding', 'Fence-mounted panels', 'Floor-standing displays'], leadTime: '8 to 9 business days' },
  'foam-board': { title: '3/16" Foam board', texture: 'foam', blurb: 'Light, smooth, indoor.', description: 'Polystyrene foam core faced with clay-coated paper, 3/16 inch (4.5 mm). The cleanest surface for photo-quality indoor prints. Easel-friendly and very light.', uses: ['Presentation and easel boards', 'Photo and poster mounting', 'Indoor retail signs'], leadTime: '3 to 5 business days' },
  'petg-020': { group: 'Clear PETG', title: '.020 Clear PETG', texture: 'clear', blurb: 'Thin clear sheet, quoted per job.', description: 'Clear PETG, 0.020 inch. Flexible overlays and window pieces. Quoted per order.', uses: ['Overlays', 'Window signs', 'Protective covers'], leadTime: '4 to 5 business days' },
  'petg-040': { group: 'Clear PETG', title: '.040 Clear PETG', texture: 'clear', blurb: 'Rigid clear sheet for counters and windows.', description: 'Clear PETG, 0.040 inch. Shatter-resistant and printable with white ink for opaque areas on a clear panel.', uses: ['Counter shields', 'Clear signs with white ink', 'Display covers'], leadTime: '4 to 5 business days' },
  'pvc-3mm': { group: 'PVC board', title: '3mm PVC board', texture: 'pvc', blurb: 'Smooth and matte. The indoor standard.', description: 'Expanded PVC, 3 mm. Matte, paintable, easy to cut and drill. Lives indoors indefinitely and outdoors for a season or two.', uses: ['Office and lobby signs', 'Retail displays', 'Wayfinding'], leadTime: '4 to 5 business days' },
  'pvc-6mm': { group: 'PVC board', title: '6mm PVC board', texture: 'pvc', blurb: 'Rigid enough to stand on its own.', description: 'Expanded PVC, 6 mm. The thickness most sign shops default to for mounted panels.', uses: ['Mounted wall signs', 'Hanging panels', 'Point of sale'], leadTime: '4 to 5 business days' },
  'pvc-10mm': { group: 'PVC board', title: '10mm PVC board', texture: 'pvc', blurb: 'Dimensional, edge-finished panels.', description: 'Expanded PVC, 10 mm. Thick enough to read as a dimensional letter or a block panel.', uses: ['Dimensional signs', 'Reception logos', 'Freestanding displays'], leadTime: '4 to 5 business days' },
  'pvc-12mm': { group: 'PVC board', title: '12mm PVC board', texture: 'pvc', blurb: 'The thickest board we print.', description: 'Expanded PVC, 12 mm. Heavy panels and routed shapes.', uses: ['Routed logos', 'Architectural panels', 'Exhibit builds'], leadTime: '4 to 5 business days' },
  'styrene-020': { group: 'Styrene', title: '.020 Styrene', texture: 'styrene', blurb: 'Thin, flexible, printable.', description: 'High-impact polystyrene, 0.020 inch. Flexible sheet for inserts, frames and shelf systems.', uses: ['Shelf talkers', 'Frame inserts', 'Light-box faces'], leadTime: '3 to 5 business days' },
  'styrene-030': { group: 'Styrene', title: '.030 Styrene', texture: 'styrene', blurb: 'Semi-rigid white sheet.', description: 'High-impact polystyrene, 0.030 inch. Holds a curve, resists tearing.', uses: ['Counter cards', 'Hanging signs', 'Menu inserts'], leadTime: '3 to 5 business days' },
  'styrene-060': { group: 'Styrene', title: '.060 Styrene', texture: 'styrene', blurb: 'Rigid styrene sheet.', description: 'High-impact polystyrene, 0.060 inch. Rigid panels that stay light.', uses: ['Indoor signs', 'Display backers', 'Point of purchase'], leadTime: '3 to 5 business days' },
  'blockout-vinyl-grey-adhesive': { title: 'Blockout vinyl, grey adhesive', texture: 'vinyl', blurb: 'Hides whatever is underneath.', description: 'White vinyl with an opaque grey adhesive. Covers old graphics and dark surfaces without show-through. Laminated matte, gloss or dry-erase.', uses: ['Re-skinning old signs', 'Wall graphics over colour', 'Vehicle door panels'], leadTime: '3 to 4 business days' },
  'clear-vinyl': { title: 'Clear vinyl', texture: 'clear', blurb: 'Printed on clear, applied to glass.', description: 'Clear adhesive vinyl. Print full colour with white ink where you need opacity.', uses: ['Window lettering', 'Glass partitions', 'Clear labels'], leadTime: '3 to 4 business days' },
  'removable-white-vinyl-clear-adhesive': { title: 'Removable white vinyl', texture: 'vinyl', blurb: 'Comes off clean.', description: 'White vinyl with a removable clear adhesive. For short-term promotions and painted walls.', uses: ['Seasonal promotions', 'Wall decals', 'Event branding'], leadTime: '3 to 4 business days' },
  'white-vinyl-clear-adhesive': { title: 'White vinyl, permanent', texture: 'vinyl', blurb: 'The all-purpose sticker stock.', description: 'White adhesive vinyl with permanent clear adhesive. The standard for decals, labels and sign faces.', uses: ['Decals and labels', 'Sign faces', 'Equipment marking'], leadTime: '3 to 4 business days' },
  'hi-tack-vinyl-clear-adhesive': { title: 'Hi-tack white vinyl', texture: 'vinyl', blurb: 'Sticks to rough and low-energy surfaces.', description: 'White vinyl with an aggressive adhesive for brick, concrete, textured walls and plastics that ordinary vinyl lets go of.', uses: ['Brick and concrete', 'Floor graphics (with laminate)', 'Textured walls'], leadTime: '3 to 4 business days' },
  'optical-clear-vinyl': { title: 'Optical clear vinyl', texture: 'clear', blurb: 'Glass-clear window graphics.', description: 'Optically clear vinyl for storefront windows. Print front- or back-adhesive, with white and black layers for two-sided reads.', uses: ['Storefront windows', 'Two-sided window graphics', 'Glass doors'], leadTime: '3 to 4 business days' },
  'white-static-cling': { title: 'White static cling', texture: 'vinyl', blurb: 'No adhesive. Repositionable.', description: 'White static-cling film for glass. Peel off and reuse.', uses: ['Hours and notices', 'Sale windows', 'Rental displays'], leadTime: '3 to 4 business days' },
  'clear-static-cling': { title: 'Clear static cling', texture: 'clear', blurb: 'Clear film, no adhesive.', description: 'Clear static-cling film. Printed with white ink where needed.', uses: ['Window notices', 'Glass partitions', 'Temporary branding'], leadTime: '3 to 4 business days' },
  'fabric-banners': { title: 'Fabric banner', texture: 'fabric', blurb: 'Soft, matte, no glare for stage and photo.', description: 'Dye-sub style polyester fabric banner. Lies flat, folds for travel, photographs without glare. Hemmed, grommeted or pole-pocketed.', uses: ['Stage backdrops', 'Trade-show walls', 'Step-and-repeat'], leadTime: '3 to 4 business days' },
  'large-mesh-banner': { title: 'Large mesh banner', texture: 'mesh', blurb: 'Lets wind through fences and scaffolds.', description: 'Perforated mesh vinyl for fence lines, scaffolding and anywhere wind would tear a solid banner.', uses: ['Construction fences', 'Scaffold wraps', 'Sports fields'], leadTime: '4 business days' },
  'small-narrow-mesh-banner': { title: 'Small mesh banner', texture: 'mesh', blurb: 'Narrow mesh for railings and short runs.', description: 'Perforated mesh vinyl in a narrow format.', uses: ['Railings', 'Short fence runs', 'Event perimeters'], leadTime: '4 business days' },
  '18oz-scrim-banners': { title: '18oz scrim banner', texture: 'banner', blurb: 'Heavy, double-sided capable.', description: 'Heavyweight 18 oz scrim vinyl. Blockout core for true double-sided printing. For long-term outdoor use.', uses: ['Double-sided street banners', 'Building banners', 'Long-term outdoor'], leadTime: '4 to 6 business days' },
  '13oz-large-scrim-banner': { title: '13oz scrim banner', texture: 'banner', blurb: 'The standard outdoor banner.', description: '13 oz scrim vinyl, the outdoor banner most people picture. Hemmed and grommeted, with wind slits and pole pockets as options.', uses: ['Storefront banners', 'Event entrances', 'Fence banners'], leadTime: '4 to 6 business days' },
  '13-oz-smooth-banners': { title: '13oz smooth banner', texture: 'banner', blurb: 'Smooth face for photo-quality indoor banners.', description: '13 oz smooth vinyl with no scrim texture, for close viewing indoors.', uses: ['Retractable stand replacements', 'Indoor events', 'Photo backdrops'], leadTime: '3 to 4 business days' },
  '13oz-scrim-banner-specials': { title: '13oz scrim banner, special', texture: 'banner', blurb: 'A fixed-size promo banner at a set price.', description: '13 oz scrim vinyl at a promotional fixed size.', uses: ['Quick promo', 'Garage sale', 'Pop-up'], leadTime: '4 to 6 business days' },
  'election-signs': { title: 'Screen-printed election signs', texture: 'election', blurb: 'One or two colours, double-sided, quoted per campaign.', description: 'Screen-printed 4 mm coroplast in one or two spot colours, same art both sides. Priced per campaign on quantity and colours.', uses: ['Municipal campaigns', 'Provincial and federal runs', 'Referendum signs'], leadTime: '8 to 9 business days' },
};

// Add-on pricing (CAD, per unit). Anything not listed is included at no charge.
const surcharges = {
  'Two Sided': 12.00,
  'banner 18 oz Double sided print': 25.00,
  'Regular H Stakes - 10x30': 2.60,
  '1 Grommet': 0.65, 'Grommets Top 2 Corners': 1.30, 'Grommets All 4 Corners': 2.60,
  'Grommets every 2 to 3 feet All Around': 6.50, 'Grommets every 12 to 18 " All Around': 9.10,
  '1 Long Barrel Grommet': 0.98, '2 Long Barrel Grommets': 1.95, '4 Long Barrel Grommets': 3.90,
  '1 Hole Drilled': 0.65, '2 Holes Drilled': 1.30, '3 Holes Drilled': 1.95, '4 Holes Drilled': 2.60, '5 Holes Drilled': 3.25, '6 Holes Drilled': 3.90,
  '1 Hole Drilled ACP': 0.98, '2 Holes Drilled ACP': 1.95, '3 Holes Drilled ACP': 2.93, '4 Holes Drilled ACP': 3.90, '5 Holes Drilled ACP': 4.88, '6 Holes Drilled ACP': 5.85,
  'Simple Contour Cut to Shape -Circles Heart Ovals': 9.75, 'Simple Contour Cut to Shape -Circles Heart Ovals+': 9.75, 'Complex Contour Cut to Shape': 19.50,
  'Simple Contour Cut 3mm ACP -Circles Heart Ovals': 13.00, 'Complex Contour Cut to Shape 3m ACP': 26.00, 'Complex Contour Cut to Shape -Circles Heart Ovals': 19.50,
  'Simple Vinyl Cutting- small': 3.90, 'Wide Format VINYL Cutting - Simple': 9.75,
  'Matt Lamination': 6.50, 'Gloss Lamination': 6.50, 'Dry Erase Lamination -Re Writeable': 13.00, 'Optical Clear Lamination': 9.10,
  'Sewn Hem 4 Sides': 9.75, 'Double - Sewn Hem 4 Sides': 14.30, 'Sewn Hem Top & Bottom Only': 5.85,
  'Tape Heming 4 Sides': 6.50, 'Tape Hem Only Left & Right': 3.90, 'Tape Hem Only Top & Bottom': 3.90,
  '18 oz Tape Reinforced + Double Sewing - Hemming 4 Sides': 19.50,
  'Sleeve Pocket - 4" Top ONLY': 7.80, 'Sleeve Pockets - 4"Top & Bottom': 14.30,
  'Wind slits - Please position on art': 5.20,
  'ACP Two Day Rush (up to 20 pieces) Call to Confirm': 39.00,
  'Next Day 24 Hr Rush (up to 100 pieces) Call to Confirm': 32.50, 'Next Day 24 Hr Rush (up to 10 pieces) Call to Confirm': 32.50,
  'SAME Day 6 Hr Rush -End Of Day Call Before you order.': 65.00, '3 Hr Rush up to 10 pieces - Must Call to confirm .': 97.50,
  '12 hrs RUSH Pick Up (upto 10 pieces)Call Before you order.': 45.50, '6 Business hrs RUSH(upto 10 pieces) Call Before you order.': 65.00,
  'Next Day Pickup - Banner Min 24 hours Call Before you order': 32.50, '6 Business hrs RUSH Call Before you order.': 65.00,
  '24 Hr RUSH Pickup - CALL BEFORE ORDER': 39.00, 'Two Day RUSH Pickup - CALL BEFORE ORDER': 26.00,
  '1 Additional art': 6.50, '2 Additional art': 13.00, '3 Additional art': 19.50, '4 Additional art': 26.00, '5 Additional art': 32.50,
  '6 Additional art': 39.00, '7 Additional art': 45.50, '8 Additional art': 52.00, '9 Additional art': 58.50, '10 Additional art': 65.00,
  'TWO Colour DOUBLE sided same art': 0, 'Two Colour DOUBLE sided same art': 0,
};

// Display names for option groups (the raw label stays the pricing key).
function prettyLabel(label) {
  const l = label.toLowerCase();
  if (l.startsWith('production')) return 'Rush production (standard lead time is included)';
  if (l.startsWith('versions')) return 'Additional artwork versions';
  if (l.includes('single') && l.includes('sided') && l.includes('optical')) return 'Print layers';
  if (l.includes('single') || l.includes('sided')) return 'Printed sides';
  if (l.startsWith('add grommets')) return 'Grommets';
  if (l.startsWith('add h stakes')) return 'H-stakes';
  if (l.startsWith('hemming')) return 'Hemming';
  if (l.startsWith('sleeve')) return 'Pole pockets';
  if (l.startsWith('wind')) return 'Wind slits';
  if (l.startsWith('cut to shape')) return 'Contour cutting';
  if (l.startsWith('drill')) return 'Drilled holes';
  if (l.startsWith('lamination')) return 'Lamination';
  if (l.startsWith('printing')) return 'Printing';
  if (l.includes('fabric') && l.includes('print')) return 'Printed sides';
  return label.replace(/\s+/g, ' ');
}
function prettyChoice(choice) {
  return choice.replace(/\s*-\s*/g, ' – ').replace(/\s+/g, ' ').replace(/\(upto/gi, '(up to').replace(/\s*\.$/, '').replace(/call (to confirm|before you order)/gi, 'call first').replace(/CALL BEFORE ORDER/g, 'call first').trim();
}
module.exports = { categories, categorySlugFor, groups, families, surcharges, prettyLabel, prettyChoice };
