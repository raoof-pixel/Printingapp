'use strict';
// Static page copy. Plain HTML strings, no user input.
module.exports = {
  help: `
<p class="lede">Everything you need to place an order that prints right the first time.</p>
<h2 id="artwork">Artwork specs</h2>
<ul>
<li><strong>Formats:</strong> PDF (preferred), AI, JPG, PNG or TIFF. Up to 40 MB per file.</li>
<li><strong>Size:</strong> build the file at the final size you chose, plus 0.125 in bleed on every edge. For 48 × 96 in and larger, build at 50% and tell us in the notes.</li>
<li><strong>Resolution:</strong> 150 ppi at final size is plenty for boards and banners; 300 ppi for vinyl viewed up close.</li>
<li><strong>Fonts:</strong> outline them or embed them. We cannot substitute missing fonts.</li>
<li><strong>Colour:</strong> CMYK. Pantone references welcome in the notes. White ink on clear materials needs a separate spot layer named <em>White</em>.</li>
<li><strong>Double-sided:</strong> one file with two pages, or two files named <em>front</em> and <em>back</em>.</li>
</ul>
<h2>Sizes and flutes</h2>
<p>Every size is listed as width × height in inches. On coroplast, flute direction decides whether an H-stake fits: vertical flutes take stakes. Where a size is only stocked one way we say so beside the size.</p>
<h2>Pricing</h2>
<p>The price beside each size is for one piece with the default finishing, before HST. Add-ons show their price in the dropdown before you choose them. Quantity pricing is linear; for runs over 100 pieces, ask for a quote and we will do better.</p>
<h2>Lead times</h2>
<p>Lead times are business days from the moment we confirm your file, not from payment. Rush options are listed per material and a few of them ask you to call first so we can promise the press time.</p>
<h2>Accounts</h2>
<p>You need an account to check out so you can track orders and reorder. Passwords must be 10+ characters. Six wrong passwords lock the account for 15 minutes.</p>`,

  about: `
<p class="lede">BoldPrint is a retail storefront for large-format printing: rigid boards, vinyl and banners, printed in Mississauga and shipped across Ontario.</p>
<p>We run the same stock sizes and finishing options a trade printer runs, priced for small businesses, realtors, schools, campaigns and event teams who order a handful at a time rather than a pallet. No minimums. Free pickup.</p>
<p>What we care about: the file you upload is the sign you get. Every product page draws your size to scale, lists its lead time and prices its add-ons up front, so the number you see in the cart is the number on the invoice.</p>`,

  delivery: `
<h2>Pickup</h2><p>Free from our Mississauga location, Monday to Friday 8:30 to 5:00. We email you when the order is ready. Bring your order number.</p>
<h2>Courier</h2><p>Rigid boards and banners ship by courier across Ontario. Because board sizes vary from 6 in to 10 ft, courier is quoted on the invoice by weight and dimensions after we pack the order, and charged before dispatch. Typical GTA deliveries arrive the next business day after production.</p>
<h2>Your own carrier</h2><p>Add your account number and carrier in the order notes and we will arrange pickup with an electronic waybill.</p>
<h2>Damage</h2><p>Check the package on arrival. Report damage within 2 business days with photos and we reprint.</p>`,

  privacy: `
<p class="lede">What we collect, why, and how we protect it.</p>
<h2>What we store</h2><p>Your name, email, phone, company and any addresses you save; your orders and the artwork files attached to them; messages you send through the contact form. We do not store card numbers: payment details go directly to the payment provider.</p>
<h2>How we protect it</h2><p>Passwords are stored as salted scrypt hashes, never in plain text. Sessions use signed, HttpOnly cookies and expire after 14 days. All traffic is encrypted in transit. Artwork files are stored outside the web root and are only reachable by our production team.</p>
<h2>What we do not do</h2><p>No selling or sharing of your data with advertisers. No third-party trackers on this site.</p>
<h2>Your rights</h2><p>Email us to export or delete your account and its data. We keep order records for 7 years for tax purposes, as required.</p>`,

  terms: `
<p class="lede">The short version: you own your artwork and are responsible for it being print-ready; we print what you send.</p>
<h2>Artwork</h2><p>By uploading a file you confirm you have the right to print it. We do not proof-read, colour-correct or fix files unless you ask and we agree a charge. Low-resolution or wrong-size files are printed as supplied.</p>
<h2>Colour</h2><p>Screen colour and print colour differ. We print to industry CMYK standards; exact Pantone matches on digital print are not guaranteed.</p>
<h2>Lead times</h2><p>Business days from file confirmation. Rush options are subject to press availability.</p>
<h2>Cancellations and reprints</h2><p>Orders can be cancelled before production starts. Once printed, custom work cannot be returned. We reprint at no charge for our own errors: wrong size, wrong material, wrong finishing, or damage before pickup.</p>
<h2>Prices</h2><p>In Canadian dollars, before HST. We can correct an obvious pricing error before accepting an order.</p>`,
};
