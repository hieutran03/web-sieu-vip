export const investors = [
  {
    id: "sumitomo",
    name: "Sumitomo Corporation",
    label: "SC",
    category: "Urban",
    sector: "Smart city + industrial parks",
    color: "oklch(54% 0.12 235)",
    location: "Dong Anh, Hanoi; Thang Long IP network in Hanoi, Hung Yen and Vinh Phuc",
    project:
      "North Hanoi Smart City is reported as a 272 ha BRG-Sumitomo development with about USD 4.2B investment; Sumitomo also anchors the Thang Long Industrial Park chain.",
    analysis:
      "Sumitomo is the northern corridor anchor: industrial parks create manufacturing gravity first, then smart-city housing and services follow the workforce and transport upgrades.",
    coords: [21.124, 105.815],
    confidence: "Approximate project area",
    sources: [
      ["North Hanoi Smart City / Vietnam.vn", "https://www.vietnam.vn/en/ha-noi-trien-khai-du-an-thanh-pho-thong-minh-42-ty-usd"],
      ["Thang Long IP III / B&Company", "https://b-company.jp/vi/japanese-firm-is-expanding-industrial-park-in-vietnam-sumitomo-to-build-4th-industrial-park/"]
    ]
  },
  {
    id: "tokyu",
    name: "Tokyu Corporation / Becamex Tokyu",
    label: "TK",
    category: "Urban",
    sector: "Township + retail + office",
    color: "oklch(47% 0.11 162)",
    location: "Binh Duong New City area, northern HCMC region",
    project:
      "TOKYU Garden City is described by Becamex Tokyu as a 110 ha urban project in Binh Duong New City, with SORA Gardens, MIDORI PARK and SORA gardens SC.",
    analysis:
      "Tokyu is exporting a transit-oriented city operating model: the asset is not one building, but a managed urban ecosystem around housing, commerce and mobility.",
    coords: [11.0528, 106.6708],
    confidence: "Approximate project area",
    sources: [
      ["TOKYU Garden City", "https://www.tokyugardencity.com/en/about/"],
      ["JBIC financing for The Nexus", "https://www.jbic.go.jp/en/information/press/press-2024/press_00036.html"]
    ]
  },
  {
    id: "nnr",
    name: "Nishi-Nippon Railroad",
    label: "NN",
    category: "Urban",
    sector: "Townships + housing",
    color: "oklch(55% 0.16 286)",
    location: "Waterpoint, Ben Luc area, former Long An",
    project:
      "NNR has participated with Nam Long across Vietnam housing projects including Waterpoint, Akari City and Mizuki Park, and announced a direct investment in Nam Long ADC in 2026.",
    analysis:
      "NNR's pattern is JV depth rather than isolated deals; moving into Nam Long ADC points to a longer housing platform, including affordable and social housing exposure.",
    coords: [10.6728, 106.4931],
    confidence: "Approximate township area",
    sources: [
      ["Nam Long ADC and Nishi-Nippon Railroad", "https://www.namlongvn.com/en/news/nam-long-adc-enters-strategic-partnership-with-nishi-nippon-railroad-targeting-80-growth-by-2030/"],
      ["Nam Long investor relations", "https://www.namlongvn.com/investor-relations"]
    ]
  },
  {
    id: "hankyu",
    name: "Hankyu Hanshin Properties",
    label: "HH",
    category: "Urban",
    sector: "Township + logistics exposure",
    color: "oklch(55% 0.16 286)",
    location: "Izumi City, Long Hung area, Dong Nai",
    project:
      "Hankyu Hanshin joined Nam Long on Izumi City in Dong Nai and is also linked in the reports to logistics exposure through Sembcorp-backed platforms.",
    analysis:
      "The strategy follows both households and supply chains: residential JVs near HCMC's eastward growth, plus logistics around industrial and port locations.",
    coords: [10.9077, 106.8583],
    confidence: "Approximate project area",
    sources: [
      ["Nam Long and Hankyu Hanshin on Izumi City", "https://www.namlongvn.com/news/3357-nam-long-partners-with-hankyu-hanshin-properties-corp-to-build-814-million-city-in-dong-nai"],
      ["Hankyu Hanshin Properties", "https://www.hhp.co.jp/en/"]
    ]
  },
  {
    id: "aeon",
    name: "AEON Group / AEON Mall",
    label: "AE",
    category: "Retail",
    sector: "Retail infrastructure",
    color: "oklch(60% 0.16 38)",
    location: "AEON Mall Hue, with network in HCMC, Hanoi, Hai Phong, Binh Duong and Tan An",
    project:
      "AEON's Vietnam footprint includes malls in major cities and the AEON Tan An Shopping Center opened in October 2025 according to AEON Vietnam's release.",
    analysis:
      "AEON maps the consumption layer: provincial malls and shopping centers reveal where Japanese capital expects durable middle-class catchment growth.",
    coords: [16.4539, 107.6152],
    confidence: "Exact public mall point from OSM",
    sources: [
      ["AEON Mall Hue opening", "https://corp.aeon.com.vn/en/aeon-vietnam-news/aeon-vietnam-officially-opens-aeon-hue-2/"],
      ["AEON Tan An release", "https://corp.aeon.com.vn/wp-content/uploads/2025/10/FULL-ENG-NEWS-RELEASE-AEON-TAN-AN-SC1.pdf"]
    ]
  },
  {
    id: "kajima",
    name: "Kajima / Indochina Kajima / Core5",
    label: "KJ",
    category: "Logistics",
    sector: "Hospitality + industrial real estate",
    color: "oklch(69% 0.14 76)",
    location: "Wink Danang Riverside, Da Nang; Core5 platform in Vietnam",
    project:
      "Indochina Kajima owns and develops Wink Hotels and launched the Core5 Vietnam industrial real estate platform; Wink Danang Riverside is at 351 Tran Hung Dao.",
    analysis:
      "Kajima is the hybrid builder-owner: it can design, build and hold assets, which makes hospitality and logistics a direct investment strategy rather than only contracting work.",
    coords: [16.0677, 108.2294],
    confidence: "Exact public hotel point from OSM",
    sources: [
      ["Wink Danang Riverside / Kajima", "https://kajima.com.vn/project/wink-da-nang-riverside-2/"],
      ["Core5 Vietnam launch", "https://indochinacapital.com/press/indochina-kajima-launches-core5-vietnam-a-best-in-class-industrial-brand-from-the-us/"]
    ]
  },
  {
    id: "sojitz",
    name: "Sojitz Corporation",
    label: "SJ",
    category: "Industrial",
    sector: "Industrial parks",
    color: "oklch(47% 0.11 162)",
    location: "Long Duc Industrial Park, Dong Nai",
    project:
      "Sojitz is a shareholder/operator in Long Duc Industrial Park with Daiwa House and local partners, and has announced the Long Duc 3 expansion in Dong Nai.",
    analysis:
      "Sojitz is a pure industrial-location play: Dong Nai gives it highway, port and future airport adjacency for manufacturing tenants.",
    coords: [10.8108, 106.9648],
    confidence: "Approximate industrial park area",
    sources: [
      ["Long Duc IP / Invest Vietnam", "https://investvietnam.gov.vn/en/industrial-zones.pd/long-duc-industrial-park.html"],
      ["Sojitz Long Duc 3 announcement", "https://www.sojitz.com/en/news/article/20231115.html"]
    ]
  },
  {
    id: "daiwa",
    name: "Daiwa House Industry",
    label: "DH",
    category: "Logistics",
    sector: "Industrial logistics",
    color: "oklch(69% 0.14 76)",
    location: "Loc An - Binh Son area, Dong Nai",
    project:
      "Daiwa House participates in Long Duc IP and develops DPL Vietnam logistics assets, including Loc An - Binh Son in Dong Nai.",
    analysis:
      "Daiwa House follows the airport-industrial corridor: multi-tenant logistics becomes more valuable as Long Thanh and southern supply chains mature.",
    coords: [10.7885, 106.9913],
    confidence: "Approximate industrial park area",
    sources: [
      ["Daiwa House Vietnam projects", "https://www.daiwahouse.com/English/business/overseas/vietnam.html"],
      ["D Project Loc An Binh Son release", "https://www.daiwahouse.com/English/about/release/pdf/E_release_20180905.pdf"]
    ]
  },
  {
    id: "mitsubishi-corp",
    name: "Mitsubishi Corporation",
    label: "MC",
    category: "Urban",
    sector: "Mega-township + power",
    color: "oklch(54% 0.12 235)",
    location: "Vinhomes Grand Park, Thu Duc, HCMC; Vung Ang 2, Ha Tinh",
    project:
      "Mitsubishi Corporation and Nomura participated in Vinhomes Grand Park; Mitsubishi is also linked to Vung Ang 2 through project finance sources.",
    analysis:
      "Mitsubishi targets scale and complexity: it pairs local land platforms with Japanese governance, capital discipline and long-horizon infrastructure exposure.",
    coords: [10.8396, 106.8421],
    confidence: "Exact public township point from OSM",
    sources: [
      ["Mitsubishi Grand Park release", "https://www.mitsubishicorp.com/jp/en/news/release/2020/0000039140.html"],
      ["JBIC Vung Ang 2 financing", "https://www.jbic.go.jp/en/information/press/press-2020/1229-014147.html"]
    ]
  },
  {
    id: "mitsubishi-estate",
    name: "Mitsubishi Estate",
    label: "ME",
    category: "Logistics",
    sector: "Housing + logistics",
    color: "oklch(69% 0.14 76)",
    location: "Nam Dinh Vu area, Hai Phong; Logicross Nam Thuan in southern Vietnam",
    project:
      "Mitsubishi Estate and MOL jointly invested in Logicross Hai Phong; Mitsubishi Estate also runs the Logicross Nam Thuan logistics asset.",
    analysis:
      "The Logicross pair creates a north-south logistics platform, tying port-side Hai Phong to the expanded HCMC consumption and manufacturing belt.",
    coords: [20.8444, 106.727],
    confidence: "Approximate industrial park area",
    sources: [
      ["MOL and Mitsubishi Estate Logicross Hai Phong", "https://www.mol.co.jp/en/pr/2026/26018.html"],
      ["Logicross Nam Thuan", "https://www.logicross.vn/property/logicross-nam-thuan/"]
    ]
  },
  {
    id: "nomura",
    name: "Nomura Real Estate Development",
    label: "NR",
    category: "Urban",
    sector: "Residential + office",
    color: "oklch(55% 0.16 286)",
    location: "Ecopark, Van Giang, Hung Yen; Grand Park, HCMC; Vu Yen, Hai Phong",
    project:
      "Nomura reports multiple Vietnam residential and office projects, including Ecopark in the Hanoi area and Grand Park in HCMC.",
    analysis:
      "Nomura is a residential scale specialist; its Vietnam thesis is high-density housing with professional management, often beside strong domestic master developers.",
    coords: [20.9654, 105.9316],
    confidence: "Approximate public Ecopark point",
    sources: [
      ["Nomura Ecopark release", "https://www.nomura-re-hd.co.jp/cfiles/engnews/n2020110500240.pdf"],
      ["Nomura Vietnam business", "https://www.nomura-re-hd.co.jp/english/business/overseas/"]
    ]
  },
  {
    id: "ntt-urban",
    name: "NTT Urban Development",
    label: "NT",
    category: "Urban",
    sector: "Township + digital infrastructure",
    color: "oklch(47% 0.11 162)",
    location: "Thuan An area, former Binh Duong",
    project:
      "NTT Urban Development joined Sumitomo Forestry and Kumagai Gumi in a 41 ha township project with Kim Oanh Group.",
    analysis:
      "NTT's value is operating intelligence: the investment hints at housing platforms where connectivity, management systems and digital services become part of the product.",
    coords: [10.934, 106.713],
    confidence: "Approximate city project area",
    sources: [
      ["Kumagai Gumi project release", "https://www.kumagaigumi.co.jp/en/news/2024/pr-en-20240328-2.html"],
      ["Sumitomo Forestry release", "https://sfc.jp/english/news/pdf/20240328_01.pdf"]
    ]
  },
  {
    id: "sumitomo-forestry",
    name: "Sumitomo Forestry",
    label: "SF",
    category: "Urban",
    sector: "Low-rise housing + township",
    color: "oklch(47% 0.11 162)",
    location: "Thuan An area, former Binh Duong",
    project:
      "Sumitomo Forestry is part of the Kim Oanh township consortium with NTT Urban Development and Kumagai Gumi, and has also announced suburban low-rise housing initiatives near HCMC.",
    analysis:
      "The differentiator is housing quality and ESG: timber, low-carbon materials and long-term suburban demand fit a patient Japanese capital model.",
    coords: [10.9405, 106.719],
    confidence: "Approximate city project area",
    sources: [
      ["Sumitomo Forestry release", "https://sfc.jp/english/news/pdf/20240328_01.pdf"],
      ["Kumagai Gumi project release", "https://www.kumagaigumi.co.jp/en/news/2024/pr-en-20240328-2.html"]
    ]
  },
  {
    id: "kumagai",
    name: "Kumagai Gumi",
    label: "KG",
    category: "Urban",
    sector: "Construction + co-development",
    color: "oklch(47% 0.11 162)",
    location: "Thuan An area, former Binh Duong",
    project:
      "Kumagai Gumi joined the 41 ha Kim Oanh township consortium with Sumitomo Forestry and NTT Urban Development.",
    analysis:
      "Kumagai brings execution credibility to decade-scale township delivery, adding contractor discipline to an equity-development structure.",
    coords: [10.9295, 106.7065],
    confidence: "Approximate city project area",
    sources: [
      ["Kumagai Gumi project release", "https://www.kumagaigumi.co.jp/en/news/2024/pr-en-20240328-2.html"],
      ["Sumitomo Forestry release", "https://sfc.jp/english/news/pdf/20240328_01.pdf"]
    ]
  },
  {
    id: "marubeni",
    name: "Marubeni Corporation",
    label: "MB",
    category: "Energy",
    sector: "Power + LNG",
    color: "oklch(60% 0.16 38)",
    location: "Nghi Son 2 Power Plant, Thanh Hoa; LNG exposure in Quang Ninh reports",
    project:
      "Nghi Son 2 is a 1,200 MW BOT thermal power project that reached commercial operation in 2022, with Marubeni among the sponsors.",
    analysis:
      "Marubeni is the heavy-infrastructure anchor: power generation supports industrial growth, while LNG projects show a transition fuel pathway.",
    coords: [19.3227, 105.7977],
    confidence: "Exact public power plant point from OSM",
    sources: [
      ["Marubeni Nghi Son 2 award", "https://www.marubeni.com/en/news/2013/release/00011.html"],
      ["JBIC Nghi Son 2 financing", "https://www.jbic.go.jp/en/information/press/press-2018/0413-010921.html"]
    ]
  },
  {
    id: "idemitsu",
    name: "Idemitsu Kosan",
    label: "ID",
    category: "Energy",
    sector: "Refining + petrochemicals",
    color: "oklch(60% 0.16 38)",
    location: "Nghi Son Refinery and Petrochemical complex, Thanh Hoa",
    project:
      "Idemitsu is one of the Japanese sponsors of Nghi Son Refinery and Petrochemical, one of Vietnam's largest heavy industrial projects.",
    analysis:
      "Idemitsu's footprint is less about urban land and more about strategic supply security: refining capacity anchors downstream industrial ecosystems.",
    coords: [19.307, 105.8084],
    confidence: "Approximate refinery area",
    sources: [
      ["NSRP overview", "https://nsrp.vn/about-overview/"],
      ["Idemitsu Group in Vietnam", "https://idemitsu.vn/idemitsu-group-in-vietnam/"]
    ]
  },
  {
    id: "mitsui-chemicals",
    name: "Mitsui Chemicals",
    label: "MI",
    category: "Energy",
    sector: "Petrochemicals",
    color: "oklch(60% 0.16 38)",
    location: "Nghi Son Refinery and Petrochemical complex, Thanh Hoa",
    project:
      "Mitsui Chemicals is listed among Japanese participants in the Nghi Son petrochemical chain.",
    analysis:
      "Mitsui Chemicals adds the process and chemical-materials layer, extending Japanese capital from power into industrial feedstock and advanced materials.",
    coords: [19.3015, 105.813],
    confidence: "Approximate refinery area",
    sources: [
      ["NSRP overview", "https://nsrp.vn/about-overview/"],
      ["Mitsui Chemicals corporate profile", "https://jp.mitsuichemicals.com/en/"]
    ]
  },
  {
    id: "jica",
    name: "JICA",
    label: "JC",
    category: "Public capital",
    sector: "ODA infrastructure",
    color: "oklch(54% 0.12 235)",
    location: "Ben Thanh station area, HCMC Metro Line 1; wider Vietnam ODA portfolio",
    project:
      "JICA signed an additional loan for HCMC Urban Railway Line 1 in 2023 and supports transport, water and sewerage infrastructure in several Vietnamese cities.",
    analysis:
      "JICA is enabling capital: metro, water and wastewater assets change land values and make private township and commercial projects more viable.",
    coords: [10.7725, 106.698],
    confidence: "Exact public landmark point from OSM",
    sources: [
      ["JICA loan for HCMC Metro Line 1", "https://www.jica.go.jp/english/overseas/vietnam/information/press/2023/__icsFiles/afieldfile/2024/01/04/231229_PressRelease_en.pdf"],
      ["JICA Vietnam activities", "https://www.jica.go.jp/english/overseas/vietnam/index.html"]
    ]
  },
  {
    id: "jbic",
    name: "JBIC",
    label: "JB",
    category: "Public capital",
    sector: "Project finance",
    color: "oklch(54% 0.12 235)",
    location: "Vung Ang area, Ha Tinh; Nghi Son 2 and Tokyu HCMC financing",
    project:
      "JBIC has financed major Vietnam infrastructure projects including Vung Ang 2 and Nghi Son 2, and a Tokyu office project in HCMC.",
    analysis:
      "JBIC lowers the financing friction for very large projects, turning Japanese sponsors into credible bidders for BOT power and long-duration infrastructure.",
    coords: [18.037, 106.3765],
    confidence: "Approximate power project area",
    sources: [
      ["JBIC Vung Ang 2 financing", "https://www.jbic.go.jp/en/information/press/press-2020/1229-014147.html"],
      ["JBIC Nghi Son 2 financing", "https://www.jbic.go.jp/en/information/press/press-2018/0413-010921.html"]
    ]
  },
  {
    id: "join",
    name: "JOIN",
    label: "JO",
    category: "Public capital",
    sector: "Urban infrastructure investment",
    color: "oklch(55% 0.16 286)",
    location: "Vu Yen island area, Hai Phong; Waterpoint and Grand Park exposure",
    project:
      "JOIN has participated in Vietnam urban projects including Waterpoint, Grand Park and a large housing project at Vu Yen, Hai Phong.",
    analysis:
      "JOIN acts as public-private urban capital, helping Japanese developers take part in large city-making projects without carrying every risk alone.",
    coords: [20.8871, 106.7112],
    confidence: "Approximate island project area",
    sources: [
      ["JOIN Vu Yen project", "https://www.join-future.co.jp/english/investments/achievement/index.php?c=investment_en_view&pk=1723610912"],
      ["Nomura Vu Yen release", "https://www.nomura-re-hd.co.jp/cfiles/engnews/n2023113002402.pdf"]
    ]
  }
];

export const filters = ["all", "Urban", "Industrial", "Logistics", "Retail", "Energy", "Public capital"];

export const corridors = [
  {
    title: "Northern manufacturing and ports",
    accent: "oklch(54% 0.12 235)",
    body: "Hanoi, Hung Yen, Vinh Phuc and Hai Phong combine industrial parks, smart-city development, logistics and port access.",
    tags: ["Sumitomo", "Mitsubishi Estate", "Nomura", "JOIN"]
  },
  {
    title: "Expanded Ho Chi Minh City",
    accent: "oklch(47% 0.11 162)",
    body: "HCMC, Binh Duong, Dong Nai and former Long An operate as one market for townships, housing, malls and logistics.",
    tags: ["Tokyu", "NNR", "Sojitz", "JICA"]
  },
  {
    title: "Central coast and heavy infrastructure",
    accent: "oklch(60% 0.16 38)",
    body: "Hue, Da Nang, Thanh Hoa and Ha Tinh show a thinner but strategic layer of retail, hotels, refining and power.",
    tags: ["AEON", "Kajima", "Marubeni", "JBIC"]
  }
];
