// Temporary data for rendering the frontend without a backend.
// Set USE_DUMMY to false (or delete this file's <script> tags) once the API is ready.
window.USE_DUMMY = true;

(function () {
  const cats = [
    ['c1', 'Lakshmi Crackers'], ['c2', 'Flower Pots'], ['c3', 'Chakkars'],
    ['c4', 'Sparklers'], ['c5', 'Sky Shots'], ['c6', 'Kids Novelties'],
  ].map(([_id, name]) => ({ _id, name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), isActive: true }));

  const gift = (id, n, price) => ({ _id: id, name: `Gift Box ${n} Items`, price, unit: 'Box', isGiftBox: true, isActive: true, categories: [] });
  const item = (id, name, price, unit, cat) => ({ _id: id, name, price, unit, isGiftBox: false, isActive: true, categories: [cat] });

  const products = [
    gift('g30', 30, 700), gift('g40', 40, 950), gift('g50', 50, 1250), gift('g60', 60, 1650),

    item('p01', 'Lakshmi Crackers 2" (Red)', 55, 'Pkt', 'c1'),
    item('p02', 'Lakshmi Crackers 4" (Gold)', 90, 'Pkt', 'c1'),
    item('p03', 'Lakshmi Crackers 5" (Deluxe)', 140, 'Pkt', 'c1'),
    item('p04', 'Lakshmi Crackers 10 Wala', 75, 'Pkt', 'c1'),

    item('p05', 'Flower Pot Small', 120, 'Box', 'c2'),
    item('p06', 'Flower Pot Big', 220, 'Box', 'c2'),
    item('p07', 'Flower Pot Special', 350, 'Box', 'c2'),
    item('p08', 'Flower Pot Colour Koti', 480, 'Box', 'c2'),

    item('p09', 'Ground Chakkar Small', 90, 'Box', 'c3'),
    item('p10', 'Ground Chakkar Big', 160, 'Box', 'c3'),
    item('p11', 'Ground Chakkar Special', 260, 'Box', 'c3'),
    item('p12', 'Wire Chakkar', 130, 'Box', 'c3'),

    item('p13', 'Sparklers 7 cm (Electric)', 45, 'Box', 'c4'),
    item('p14', 'Sparklers 10 cm (Colour)', 70, 'Box', 'c4'),
    item('p15', 'Sparklers 15 cm (Crackling)', 110, 'Box', 'c4'),
    item('p16', 'Sparklers 30 cm (Gold)', 190, 'Box', 'c4'),

    item('p17', 'Sky Shot 7 Shots', 280, 'Box', 'c5'),
    item('p18', 'Sky Shot 12 Shots', 450, 'Box', 'c5'),
    item('p19', 'Sky Shot 30 Shots', 900, 'Box', 'c5'),
    item('p20', 'Whistling Rocket', 160, 'Box', 'c5'),

    item('p21', 'Pop Pop (Snap Caps)', 25, 'Box', 'c6'),
    item('p22', 'Snake Tablet', 20, 'Box', 'c6'),
    item('p23', 'Magic Pencil', 60, 'Box', 'c6'),
    item('p24', 'Colour Matches', 35, 'Box', 'c6'),
  ];

  window.DUMMY = {
    '/config': { shopName: 'Sri Lakshmi Crackers', shopCity: 'Sivakasi', whatsappNumber: '9876543210' },
    '/categories': cats,
    '/products': products,
  };
})();
