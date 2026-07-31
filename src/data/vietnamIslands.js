// Hoàng Sa (Paracel) and Trường Sa (Spratly) archipelagos — Vietnamese sovereign territory,
// administratively Hoàng Sa district (Đà Nẵng) and Trường Sa district (Khánh Hòa).
//
// The province outlines come from a simplified national dataset in which these islands are far
// too small to survive simplification, so they are declared here explicitly and drawn as a
// labelled inset, the way official Vietnamese maps present them.

export const ISLAND_GROUPS = [
  {
    id: "hoang-sa",
    name: { vi: "Quần đảo Hoàng Sa", en: "Hoàng Sa (Paracel) Islands", ja: "ホアンサ（西沙）諸島" },
    province: { vi: "Huyện Hoàng Sa, TP. Đà Nẵng", en: "Hoàng Sa district, Đà Nẵng", ja: "ダナン市ホアンサ県" },
    provinceSlug: "da-nang",
    // Representative islets, [lng, lat].
    points: [
      [111.6, 16.83],
      [112.34, 16.53],
      [111.75, 16.45],
      [112.72, 16.2],
      [112.0, 16.0],
      [111.2, 15.78]
    ],
    labelAnchor: [111.9, 16.4]
  },
  {
    id: "truong-sa",
    name: { vi: "Quần đảo Trường Sa", en: "Trường Sa (Spratly) Islands", ja: "チュオンサ（南沙）諸島" },
    province: { vi: "Huyện Trường Sa, tỉnh Khánh Hòa", en: "Trường Sa district, Khánh Hòa", ja: "カインホア省チュオンサ県" },
    provinceSlug: "khanh-hoa",
    points: [
      [111.92, 11.05],
      [112.9, 10.37],
      [114.0, 10.2],
      [113.85, 9.55],
      [114.35, 9.88],
      [115.5, 9.72],
      [112.2, 8.85],
      [113.3, 8.65],
      [114.3, 8.63],
      [115.1, 8.1],
      [112.9, 7.4]
    ],
    labelAnchor: [113.6, 9.4]
  }
];

/** Sea name placed between the mainland and the archipelagos for orientation. */
export const EAST_SEA_LABEL = {
  name: { vi: "BIỂN ĐÔNG", en: "EAST SEA", ja: "東海（南シナ海）" },
  anchor: [113.2, 13.6]
};
