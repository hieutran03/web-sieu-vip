import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AdvancedMarker, APIProvider, Map, useMap } from "@vis.gl/react-google-maps";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip
} from "chart.js";
import { Bar, Bubble, Doughnut, Line, Radar } from "react-chartjs-2";
import { companyMedia } from "./companyMedia";
import { corridors, filters, investors } from "./investors";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  RadialLinearScale,
  Tooltip
);

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const GOOGLE_MAP_ID = import.meta.env.VITE_GOOGLE_MAP_ID || "DEMO_MAP_ID";
const MAP_CENTER = { lat: 15.95, lng: 106.55 };
const MAP_ZOOM = 6;
const CLUSTER_DISABLE_ZOOM = 12.2;
const CLUSTER_EXPAND_MIN_ZOOM = 8;
const CLUSTER_EXPAND_MAX_ZOOM = 14;
const CLUSTER_ZOOM_STEP_DELAY = 150;
const PAGE_KEYS = ["overview", "map", "regions", "strategy", "signals"];
const VIETNAM_BOUNDS = { minLat: 8.2, maxLat: 23.6, minLng: 102.1, maxLng: 109.8 };
const regionalMatrixValues = [
  { id: "north", values: { industrial: 92, urban: 58, energy: 84, logistics: 88, soft: 45 } },
  { id: "central", values: { industrial: 42, urban: 54, energy: 38, logistics: 64, soft: 90 } },
  { id: "south", values: { industrial: 72, urban: 95, energy: 46, logistics: 90, soft: 62 } }
];
const valueChainValues = [
  { id: "public", value: 78 },
  { id: "land", value: 88 },
  { id: "operations", value: 82 },
  { id: "technology", value: 74 }
];
const timelineValues = [
  { id: "laws2024", x: 8 },
  { id: "dppa2025", x: 32 },
  { id: "data2025", x: 52 },
  { id: "infra2025", x: 74 },
  { id: "fdi2026", x: 92 }
];
const chartPalette = {
  ink: "oklch(20% 0.022 176)",
  muted: "oklch(43% 0.03 176)",
  line: "oklch(72% 0.03 154 / 0.34)",
  green: "oklch(39% 0.12 164)",
  jade: "oklch(58% 0.13 168)",
  gold: "oklch(66% 0.14 76)",
  coral: "oklch(57% 0.16 38)",
  sky: "oklch(50% 0.12 235)",
  violet: "oklch(52% 0.16 286)"
};
const chartSeriesColors = [
  chartPalette.green,
  chartPalette.sky,
  chartPalette.gold,
  chartPalette.coral,
  chartPalette.violet,
  chartPalette.jade
];

function withAlpha(color, alpha) {
  if (color.startsWith("oklch(")) {
    return color.replace(/\)$/, ` / ${alpha})`);
  }

  return color.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

function getInvestorMedia(investor) {
  return companyMedia[investor.id] ?? {};
}

function getInitials(name) {
  return name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

const languages = [
  { id: "vi", short: "VI", label: "Tiếng Việt", flag: "🇻🇳" },
  { id: "en", short: "EN", label: "English", flag: "🇺🇸" },
  { id: "ja", short: "JP", label: "日本語", flag: "🇯🇵" }
];

const copy = {
  vi: {
    app: {
      title: "Vietnam Japan Capital Atlas",
      subtitle: "Bảng điều hướng báo cáo về dòng vốn xây dựng, hạ tầng và bất động sản Nhật Bản tại Việt Nam, giai đoạn 2024-2026.",
      reportDate: "Dựa trên deep-research-report.md, cập nhật trong không gian làm việc ngày 15/05/2026."
    },
    nav: {
      overview: "Tổng quan",
      map: "Bản đồ trình bày",
      regions: "Ba cực tăng trưởng",
      strategy: "Chuỗi giá trị",
      signals: "Phân tích"
    },
    common: {
      language: "Ngôn ngữ",
      reportSource: "Nguồn báo cáo",
      presentationReady: "Chế độ trình bày",
      jumpToMap: "Mở bản đồ",
      viewOnMap: "Xem trên bản đồ",
      close: "Đóng",
      evidence: "Dữ kiện",
      projects: "dự án",
      investors: "nhà đầu tư",
      sourceLinks: "Nguồn",
      noApiTitle: "Chưa có Google Maps API key",
      noApiBody: "Ứng dụng đang dùng bản đồ minh họa nội bộ. Thêm VITE_GOOGLE_MAPS_API_KEY vào .env.local để bật Google Maps.",
      all: "Tất cả"
    },
    overview: {
      title: "Từ dòng vốn rời Nhật Bản đến bản đồ đô thị Việt Nam",
      intro: "Báo cáo cho thấy vốn Nhật Bản không phân tán ngẫu nhiên. Nó bám vào hành lang sản xuất, cảng biển, metro, năng lượng và các đối tác nội địa đã nắm quỹ đất.",
      metrics: [
        { value: "5.738", label: "dự án Nhật Bản lũy kế tại Việt Nam đến cuối tháng 2/2026", note: "Tổng vốn đăng ký gần 79 tỷ USD." },
        { value: "38,42 tỷ USD", label: "FDI đăng ký toàn Việt Nam năm 2025", note: "Bối cảnh hấp thụ vốn mạnh của thị trường." },
        { value: "3 cực", label: "Bắc, Trung, Nam với vai trò khác nhau", note: "Công nghiệp, dịch vụ chất lượng cao, đại đô thị và logistics." },
        { value: "234", label: "dự án hạ tầng lớn khởi công hoặc khánh thành ngày 19/12/2025", note: "Tổng mức đầu tư vượt 3,4 triệu tỷ đồng theo báo cáo." }
      ],
      thesisTitle: "Luận điểm chính",
      thesis: [
        {
          title: "Đồng yen yếu không chặn dòng vốn",
          body: "Doanh nghiệp Nhật huy động vốn rẻ trong nước, sau đó tìm lợi suất tại thị trường dân số trẻ và đô thị hóa nhanh."
        },
        {
          title: "Khung luật mới là bộ lọc",
          body: "Luật Đất đai, Nhà ở, Kinh doanh bất động sản, Đấu thầu và cơ chế DPPA làm tăng kỷ luật triển khai, phù hợp với nhà đầu tư thận trọng."
        },
        {
          title: "Đối tác nội địa là cửa vào",
          body: "Vinhomes, Phú Mỹ Hưng, Ecopark, Becamex và Nam Long giúp giảm rủi ro đất đai, còn phía Nhật bổ sung vốn, chuẩn quản lý và vận hành."
        },
        {
          title: "Hạ tầng công quyết định địa tô",
          body: "Metro, cao tốc, cảng, sân bay và năng lượng kéo theo khu dân cư, bán lẻ, kho vận và chuỗi cung ứng."
        }
      ],
      spineTitle: "Cấu trúc báo cáo",
      spine: [
        "Động lực vĩ mô Nhật Bản và năng lực hấp thụ vốn của Việt Nam.",
        "Bản đồ ba vùng tăng trưởng với vai trò riêng.",
        "Chiến lược chuỗi giá trị của nhà phát triển và tổng thầu Nhật Bản.",
        "Bốn dịch chuyển mới: hạ tầng số, TOD, siêu giao thông và ESG."
      ]
    },
    map: {
      title: "Bản đồ trình bày các điểm vốn Nhật Bản",
      intro: "Dùng bản đồ này khi thuyết trình: chọn nhóm ngành, bấm vào điểm để giải thích dự án, sau đó chuyển sang các trang báo cáo để mở rộng luận điểm.",
      legendTitle: "Nhóm vốn",
      detailTitle: "Hồ sơ điểm chọn",
      project: "Dự án hoặc vai trò",
      location: "Vị trí",
      sector: "Phân khúc",
      coordinate: "Tọa độ đại diện",
      confidence: "Độ tin cậy tọa độ",
      reportLens: "Báo cáo",
      listTitle: "Danh mục điểm trên bản đồ",
      categoryLens: {
        Urban: "Lớp đô thị cho thấy công thức liên doanh với chủ đất nội địa: phía Việt Nam xử lý quỹ đất, phía Nhật mang vốn dài hạn và chuẩn vận hành.",
        Industrial: "Lớp công nghiệp bám sát chuỗi cung ứng linh kiện, cảng biển và khu công nghiệp đã có nền tảng sản xuất Nhật Bản.",
        Logistics: "Lớp logistics nối các cảng, sân bay và vành đai tiêu dùng, giúp vốn Nhật kiểm soát lưu kho và phân phối thay vì chỉ xây công trình.",
        Retail: "Lớp bán lẻ đọc được sức mua tỉnh thành cấp 2 và cấp 3, đặc biệt qua mạng AEON và các trung tâm thương mại mới.",
        Energy: "Lớp năng lượng thể hiện vai trò của LNG, lọc hóa dầu và điện nền trong bảo đảm công nghiệp hóa dài hạn.",
        "Public capital": "Lớp vốn công Nhật Bản tạo nền cho tư nhân: ODA, tín dụng xuất khẩu và vốn hạ tầng làm thay đổi giá đất và khả năng triển khai dự án."
      }
    },
    categories: {
      Urban: "Đô thị",
      Industrial: "Công nghiệp",
      Logistics: "Logistics",
      Retail: "Bán lẻ",
      Energy: "Năng lượng",
      "Public capital": "Vốn công"
    },
    regions: {
      title: "Ba cực tăng trưởng không thay thế nhau, chúng bổ sung nhau",
      intro: "Báo cáo mô tả Việt Nam như một hệ thống ba lớp. Miền Bắc giữ vai trò công nghiệp, cảng và năng lượng; miền Trung là dịch vụ chất lượng cao và hạ tầng mềm; miền Nam là thị trường đại đô thị, tiêu dùng và logistics mở rộng.",
      items: [
        {
          id: "north",
          title: "Miền Bắc: công nghiệp, cảng biển, LNG",
          body: "Hà Nội, Vĩnh Phúc, Hưng Yên, Quảng Ninh và Hải Phòng tạo thành vòng cung sản xuất công nghệ cao, logistics cảng và an ninh năng lượng.",
          evidence: ["Quảng Ninh có dự án LNG gần 2 tỷ USD, công suất thiết kế 1.500 MW.", "KCN Thăng Long III của Sumitomo rộng 213 ha, ưu tiên linh kiện và cơ khí chính xác.", "Logicross Hải Phòng nằm tại Nam Đình Vũ với khu đất 151.000 m2 và sàn 88.300 m2."]
        },
        {
          id: "central",
          title: "Miền Trung: dịch vụ, lưu trú, hạ tầng mềm",
          body: "Đà Nẵng nổi lên nhờ FTZ, trung tâm tài chính quốc tế, du lịch, nhân lực tiếng Nhật và các công trình ODA kết nối liên vùng.",
          evidence: ["Nhật Bản dẫn đầu FDI tại Đà Nẵng với 301 dự án, tổng giá trị 1,22 tỷ USD.", "Mikazuki, Wink Hotels và kế hoạch AEON củng cố tầng dịch vụ chất lượng cao.", "Hầm Hải Vân, cảng Tiên Sa và cao tốc Đà Nẵng - Quảng Ngãi là nền tảng logistics."]
        },
        {
          id: "south",
          title: "Miền Nam: đại đô thị, TOD, vành đai logistics",
          body: "TP.HCM, Bình Dương, Đồng Nai, Long An và Tây Ninh là nơi mô hình township, metro, bán lẻ và kho vận gặp sức mua lớn nhất.",
          evidence: ["Grand Park rộng 271 ha, hướng tới đô thị tự vận hành quy mô dân số rất lớn.", "Tokyu Garden City vận hành hệ sinh thái SORA Gardens, MIDORI Park và SORA gardens SC.", "Logicross Nam Thuận, AEON Tân An và AEON Mỹ Tho cho thấy sự lan tỏa về vành đai phía Tây Nam."]
        }
      ]
    },
    strategy: {
      title: "Chiến lược không chỉ là vốn, mà là quyền kiểm soát chuỗi giá trị",
      intro: "Nhóm nhà phát triển Nhật Bản đi cùng chủ đất Việt Nam. Nhóm tổng thầu chuyển từ EPC sang đồng phát triển, hạ tầng số, năng lượng xanh và tài sản vận hành dài hạn.",
      layersTitle: "Bốn lớp giá trị",
      layers: [
        { title: "Vốn công và tín dụng", body: "JICA, JBIC và JOIN giảm ma sát tài chính cho metro, điện, nước, nhà ga và dự án đô thị quy mô lớn." },
        { title: "Đất sạch và đối tác địa phương", body: "Vingroup, Becamex, Nam Long, Ecopark và Phú Mỹ Hưng xử lý phần rủi ro khó nhất của thị trường." },
        { title: "Tài sản vận hành", body: "Township, mall, khách sạn, kho vận và văn phòng tạo dòng tiền chứ không chỉ tạo doanh thu xây lắp." },
        { title: "Công nghệ thi công", body: "BIM, đào hầm, vật liệu giảm phát thải, tự động hóa và quản lý chuẩn Nhật nâng rào cản cạnh tranh." }
      ],
      tableTitle: "Mẫu liên doanh phát triển",
      tableHeaders: ["Nhóm", "Địa bàn", "Tài sản", "Ý nghĩa"],
      developerRows: [
        ["Mitsubishi, Nomura, Vinhomes", "TP.Thủ Đức", "Grand Park", "Liên doanh vào đại đô thị đã có quỹ đất và hạ tầng đầu mối."],
        ["Nomura, Ecopark", "Hưng Yên", "Ecopark Residences", "Đưa chuẩn quản lý đô thị xanh vào quỹ đất sinh thái lớn."],
        ["Becamex Tokyu", "Bình Dương", "Tokyu Garden City", "Tái lập mô hình đô thị tích hợp kiểu Nhật tại thành phố mới."],
        ["Mitsubishi Estate, MOL, Kajima", "Hải Phòng, Long An", "Logicross", "Biến logistics thành nền tảng tài sản vận hành bắc nam."],
        ["Sumitomo Group", "Hà Nội, Hưng Yên, Vĩnh Phúc", "KCN Thăng Long", "Tạo cụm sản xuất linh kiện và nhà cung ứng Nhật Bản."]
      ],
      contractorTitle: "Big 5 đang đổi vai",
      contractors: [
        { name: "Obayashi", body: "Từ nhà máy công nghiệp sang hydro xanh, sinh khối, địa nhiệt và giải pháp năng lượng sạch." },
        { name: "Shimizu", body: "Giữ lợi thế trong metro, hầm ngầm, cầu lớn và công trình đòi hỏi kỹ thuật thi công phức tạp." },
        { name: "Kajima", body: "Vừa thi công, vừa sở hữu tài sản qua Indochina Kajima, Wink Hotels và nền tảng Core5." },
        { name: "Taisei", body: "Chuyển từ hợp đồng Design-Build sang sở hữu văn phòng cho thuê như Taisei Hanoi Office Tower." }
      ]
    },
    signals: {
      title: "Bốn dịch chuyển cần theo dõi",
      intro: "Các xu hướng này biến bản đồ từ danh sách dự án thành hệ thống dự báo nơi vốn Nhật Bản có thể đi tiếp.",
      items: [
        { title: "Hạ tầng số", body: "Luật Viễn thông 2023 và Luật Dữ liệu từ 01/07/2025 định danh data center và cloud là dịch vụ hạ tầng, mở chỗ cho năng lực MEP, PUE và an ninh vận hành của nhà thầu Nhật." },
        { title: "TOD", body: "Metro và ODA tạo xương sống giao thông; Tokyu, Mitsubishi Estate, Nomura và AEON có thể bắt giá trị địa tô quanh các điểm trung chuyển." },
        { title: "Siêu giao thông", body: "Long Thành, Vành đai 3 TP.HCM, Vành đai 4 Hà Nội và đường sắt tốc độ cao đòi hỏi nhà thầu có hồ sơ, công nghệ và vốn chịu được chu kỳ 30-50 năm." },
        { title: "ESG và chuyển đổi xanh", body: "Tiêu chuẩn xanh, vật liệu giảm phát thải và tín dụng rẻ từ Nhật giúp các tập đoàn chịu được chi phí đất và chi phí tuân thủ cao hơn." }
      ]
    },
    analysis: {
      label: "Phân tích",
      title: "Biểu đồ đọc sâu báo cáo",
      intro: "Các biểu đồ dưới đây chuyển phần phân tích dài thành các lớp so sánh: nơi vốn tập trung, loại tài sản đang được ưu tiên, mắt xích tạo giá trị và các mốc thể chế làm thay đổi đường đi của vốn.",
      matrixTitle: "Ma trận vai trò vùng",
      matrixNote: "Điểm 0-100 là mức nhấn mạnh định tính rút từ nội dung báo cáo, không phải dữ liệu thống kê chính thức.",
      regionLabels: { north: "Miền Bắc", central: "Miền Trung", south: "Miền Nam" },
      dimensionLabels: {
        industrial: "Công nghiệp",
        urban: "Đô thị",
        energy: "Năng lượng",
        logistics: "Logistics",
        soft: "Hạ tầng mềm"
      },
      categoryTitle: "Phân bổ bộ điểm đang được trình bày",
      categoryNote: "Biểu đồ này đếm các công ty/tổ chức trong bộ bản đồ hiện tại để thấy trọng tâm trình bày của ứng dụng.",
      valueTitle: "Chuỗi giá trị vốn Nhật Bản",
      valueNote: "Báo cáo cho thấy Nhật Bản không chỉ tham gia một mắt xích. Lợi thế nằm ở việc nối tài chính, đất, vận hành và công nghệ.",
      valueLabels: {
        public: "Vốn công và tín dụng",
        land: "Đối tác đất sạch",
        operations: "Tài sản vận hành",
        technology: "Công nghệ thi công"
      },
      timelineTitle: "Dòng thời gian thể chế và hạ tầng",
      timelineNote: "Những mốc này giải thích tại sao giai đoạn 2024-2026 là cửa sổ thay đổi quan trọng.",
      bubbleTitle: "Định vị vai trò vùng",
      bubbleNote: "Trục ngang là đô thị, trục dọc là logistics, kích thước bong bóng phản ánh năng lượng/hạ tầng nặng.",
      timelineLabels: {
        laws2024: { date: "08/2024", label: "Luật đất đai, nhà ở, kinh doanh BĐS có hiệu lực sớm" },
        dppa2025: { date: "03/2025", label: "DPPA mở đường cho dự án năng lượng mới" },
        data2025: { date: "07/2025", label: "Luật Dữ liệu định danh hạ tầng số" },
        infra2025: { date: "12/2025", label: "234 dự án hạ tầng khởi công/khánh thành" },
        fdi2026: { date: "02/2026", label: "Nhật đạt gần 79 tỷ USD vốn đăng ký lũy kế" }
      }
    }
  },
  en: {
    app: {
      title: "Vietnam Japan Capital Atlas",
      subtitle: "A report navigation interface for Japanese construction, infrastructure and real-estate capital in Vietnam, 2024-2026.",
      reportDate: "Based on deep-research-report.md in this workspace, refreshed on May 15, 2026."
    },
    nav: {
      overview: "Overview",
      map: "Presentation map",
      regions: "Growth poles",
      strategy: "Value chain",
      signals: "Analysis"
    },
    common: {
      language: "Language",
      reportSource: "Report source",
      presentationReady: "Presentation mode",
      jumpToMap: "Open map",
      viewOnMap: "View on map",
      close: "Close",
      evidence: "Evidence",
      projects: "projects",
      investors: "investors",
      sourceLinks: "Sources",
      noApiTitle: "Google Maps API key is missing",
      noApiBody: "The app is using the internal illustrated map. Add VITE_GOOGLE_MAPS_API_KEY to .env.local to enable Google Maps.",
      all: "All"
    },
    overview: {
      title: "From outbound Japanese capital to Vietnam's urban map",
      intro: "The report shows that Japanese capital is not scattered randomly. It follows manufacturing corridors, ports, metro lines, energy nodes and local partners that already control land.",
      metrics: [
        { value: "5,738", label: "Japanese projects accumulated in Vietnam by late February 2026", note: "Registered capital was nearly USD 79B." },
        { value: "USD 38.42B", label: "Vietnam-wide registered FDI in 2025", note: "A strong absorption backdrop for strategic capital." },
        { value: "3 poles", label: "North, Central and South with different jobs", note: "Industry, high-quality services, mega-townships and logistics." },
        { value: "234", label: "major infrastructure projects started or opened on Dec 19, 2025", note: "Total investment exceeded VND 3.4 quadrillion in the report." }
      ],
      thesisTitle: "Core thesis",
      thesis: [
        {
          title: "A weak yen did not stop outbound capital",
          body: "Japanese firms raise low-cost capital at home, then seek yield in young, fast-urbanizing markets."
        },
        {
          title: "New laws act as a quality filter",
          body: "Land, housing, real-estate business, bidding and DPPA reforms raise execution discipline, which fits patient Japanese investors."
        },
        {
          title: "Local partners are the entrance",
          body: "Vinhomes, Phu My Hung, Ecopark, Becamex and Nam Long reduce land risk while Japanese partners add capital, management standards and operations."
        },
        {
          title: "Public infrastructure shapes land value",
          body: "Metro, expressways, ports, airports and power assets pull housing, retail, logistics and supply-chain investment around them."
        }
      ],
      spineTitle: "Report structure",
      spine: [
        "Japanese macro pressure and Vietnam's capital absorption capacity.",
        "A three-region growth map with distinct roles.",
        "Value-chain strategies of developers and general contractors.",
        "Four forward shifts: digital infrastructure, TOD, mega transport and ESG."
      ]
    },
    map: {
      title: "Presentation map of Japanese capital points",
      intro: "Use this view in a meeting: filter by category, select a marker to explain a project, then move into the report pages for the deeper argument.",
      legendTitle: "Capital groups",
      detailTitle: "Selected point",
      project: "Project or role",
      location: "Location",
      sector: "Segment",
      coordinate: "Representative coordinate",
      confidence: "Coordinate confidence",
      reportLens: "Report lens",
      listTitle: "Mapped point directory",
      categoryLens: {
        Urban: "The urban layer shows the joint-venture formula: Vietnamese partners solve land access, while Japanese partners add long capital and operating standards.",
        Industrial: "The industrial layer follows component supply chains, ports and industrial parks with an established Japanese manufacturing base.",
        Logistics: "The logistics layer connects ports, airports and consumption belts, giving Japanese capital control over storage and distribution rather than construction alone.",
        Retail: "The retail layer reveals expectations for durable middle-class demand in tier-2 and tier-3 cities, especially through AEON assets.",
        Energy: "The energy layer shows the role of LNG, refining, petrochemicals and baseload power in long-term industrialization.",
        "Public capital": "Japanese public capital creates the platform for private deals: ODA, export credit and infrastructure finance change land values and project feasibility."
      }
    },
    categories: {
      Urban: "Urban",
      Industrial: "Industrial",
      Logistics: "Logistics",
      Retail: "Retail",
      Energy: "Energy",
      "Public capital": "Public capital"
    },
    regions: {
      title: "The three growth poles do different jobs",
      intro: "The report frames Vietnam as a three-layer system. The North is industry, ports and energy; the Central region is high-quality services and soft infrastructure; the South is mega-urban demand, consumption and outward logistics.",
      items: [
        {
          id: "north",
          title: "North: industry, seaports, LNG",
          body: "Hanoi, Vinh Phuc, Hung Yen, Quang Ninh and Hai Phong form a high-tech production, port logistics and energy-security arc.",
          evidence: ["Quang Ninh has a nearly USD 2B LNG project with 1,500 MW design capacity.", "Sumitomo's Thang Long III industrial park covers 213 ha and prioritizes components and precision mechanics.", "Logicross Hai Phong sits in Nam Dinh Vu with a 151,000 m2 land plot and 88,300 m2 floor area."]
        },
        {
          id: "central",
          title: "Central region: services, hospitality, soft infrastructure",
          body: "Da Nang is gaining force through the FTZ, international financial center, tourism, Japanese-language talent and ODA-backed connectivity.",
          evidence: ["Japan leads FDI in Da Nang with 301 projects and USD 1.22B in value.", "Mikazuki, Wink Hotels and planned AEON assets strengthen the high-quality service layer.", "Hai Van Tunnel, Tien Sa Port and Da Nang - Quang Ngai Expressway support regional logistics."]
        },
        {
          id: "south",
          title: "South: mega-townships, TOD and logistics belts",
          body: "HCMC, Binh Duong, Dong Nai, Long An and Tay Ninh are where townships, metro, retail and warehousing meet the largest demand base.",
          evidence: ["Grand Park covers 271 ha and targets a self-operating urban population at city scale.", "Tokyu Garden City operates the SORA Gardens, MIDORI Park and SORA gardens SC ecosystem.", "Logicross Nam Thuan, AEON Tan An and AEON My Tho show the spread into the south-western belt."]
        }
      ]
    },
    strategy: {
      title: "The strategy is not only capital, it is value-chain control",
      intro: "Japanese developers move with Vietnamese landholders. Japanese contractors are shifting from EPC toward co-development, digital infrastructure, green energy and long-life operating assets.",
      layersTitle: "Four value layers",
      layers: [
        { title: "Public capital and credit", body: "JICA, JBIC and JOIN reduce financing friction for metro, power, water, stations and large urban projects." },
        { title: "Clean land and local partners", body: "Vingroup, Becamex, Nam Long, Ecopark and Phu My Hung handle the hardest market risk." },
        { title: "Operating assets", body: "Townships, malls, hotels, logistics and offices create recurring cash flow, not only construction revenue." },
        { title: "Construction technology", body: "BIM, tunneling, low-carbon materials, automation and Japanese management raise the competitive threshold." }
      ],
      tableTitle: "Development joint-venture pattern",
      tableHeaders: ["Group", "Geography", "Asset", "Meaning"],
      developerRows: [
        ["Mitsubishi, Nomura, Vinhomes", "Thu Duc City", "Grand Park", "Entry into a mega-township with land and trunk infrastructure already assembled."],
        ["Nomura, Ecopark", "Hung Yen", "Ecopark Residences", "Japanese management standards applied to a large green-township land bank."],
        ["Becamex Tokyu", "Binh Duong", "Tokyu Garden City", "A Japanese-style integrated city model rebuilt inside a new provincial city."],
        ["Mitsubishi Estate, MOL, Kajima", "Hai Phong, Long An", "Logicross", "Logistics becomes a north-south operating asset platform."],
        ["Sumitomo Group", "Hanoi, Hung Yen, Vinh Phuc", "Thang Long IP network", "A component and supplier cluster for Japanese manufacturing."]
      ],
      contractorTitle: "The Big 5 are changing roles",
      contractors: [
        { name: "Obayashi", body: "From industrial plants toward green hydrogen, biomass, geothermal and clean-energy solutions." },
        { name: "Shimizu", body: "Defends an edge in metro, underground work, large bridges and projects with high technical complexity." },
        { name: "Kajima", body: "Builds and owns assets through Indochina Kajima, Wink Hotels and the Core5 platform." },
        { name: "Taisei", body: "Moves from Design-Build contracts toward income assets such as Taisei Hanoi Office Tower." }
      ]
    },
    signals: {
      title: "Four shifts to watch next",
      intro: "These shifts turn the map from a project list into a forecast of where Japanese capital may move next.",
      items: [
        { title: "Digital infrastructure", body: "The 2023 Telecom Law and Data Law effective July 1, 2025 classify data centers and cloud as infrastructure services, opening room for Japanese MEP, PUE and security expertise." },
        { title: "TOD", body: "Metro and ODA create the transport spine; Tokyu, Mitsubishi Estate, Nomura and AEON can capture land-value gains around transfer points." },
        { title: "Mega transport", body: "Long Thanh, HCMC Ring Road 3, Hanoi Ring Road 4 and high-speed rail require contractors with records, technology and capital patient enough for 30-50 year cycles." },
        { title: "ESG and green transition", body: "Green standards, low-emission materials and cheap Japanese credit help corporations withstand higher land and compliance costs." }
      ]
    },
    analysis: {
      label: "Analysis",
      title: "Deep-reading charts",
      intro: "These charts turn the long-form analysis into comparison layers: where capital concentrates, which asset types dominate, which value-chain links matter, and which policy events redirect capital.",
      matrixTitle: "Regional role matrix",
      matrixNote: "Scores from 0-100 are qualitative emphasis scores derived from the report narrative, not official statistics.",
      regionLabels: { north: "North", central: "Central", south: "South" },
      dimensionLabels: {
        industrial: "Industrial",
        urban: "Urban",
        energy: "Energy",
        logistics: "Logistics",
        soft: "Soft infra"
      },
      categoryTitle: "Distribution of mapped points",
      categoryNote: "This counts the companies and institutions currently represented in the map set, showing the app's presentation emphasis.",
      valueTitle: "Japanese capital value chain",
      valueNote: "The report shows Japan is not present in only one link. Its advantage is connecting finance, land access, operations and construction technology.",
      valueLabels: {
        public: "Public capital and credit",
        land: "Clean-land partners",
        operations: "Operating assets",
        technology: "Construction technology"
      },
      timelineTitle: "Policy and infrastructure timeline",
      timelineNote: "These milestones explain why 2024-2026 is an important change window.",
      bubbleTitle: "Regional positioning",
      bubbleNote: "Horizontal axis is urban intensity, vertical axis is logistics intensity, bubble size reflects energy and heavy-infrastructure weight.",
      timelineLabels: {
        laws2024: { date: "Aug 2024", label: "Land, housing and real-estate business laws take early effect" },
        dppa2025: { date: "Mar 2025", label: "DPPA opens a path for new energy projects" },
        data2025: { date: "Jul 2025", label: "Data Law defines digital infrastructure" },
        infra2025: { date: "Dec 2025", label: "234 infrastructure projects started or opened" },
        fdi2026: { date: "Feb 2026", label: "Japan nears USD 79B in accumulated registered capital" }
      }
    }
  },
  ja: {
    app: {
      title: "Vietnam Japan Capital Atlas",
      subtitle: "2024-2026年のベトナムにおける日本の建設、インフラ、不動産資本を読むためのレポート型インターフェースです。",
      reportDate: "このワークスペースの deep-research-report.md をもとに、2026年5月15日に構成しました。"
    },
    nav: {
      overview: "概要",
      map: "発表用マップ",
      regions: "成長極",
      strategy: "価値連鎖",
      signals: "分析"
    },
    common: {
      language: "言語",
      reportSource: "レポート出典",
      presentationReady: "発表モード",
      jumpToMap: "マップを開く",
      viewOnMap: "地図で見る",
      close: "閉じる",
      evidence: "根拠",
      projects: "案件",
      investors: "投資家",
      sourceLinks: "出典",
      noApiTitle: "Google Maps API key がありません",
      noApiBody: ".env.local に VITE_GOOGLE_MAPS_API_KEY を追加すると Google Maps が有効になります。現在は内部の説明用マップを表示しています。",
      all: "すべて"
    },
    overview: {
      title: "日本から出る資本がベトナムの都市地図を形づくる",
      intro: "レポートが示すのは、日本資本が無作為に広がっていないということです。製造回廊、港湾、地下鉄、エネルギー拠点、そして土地を押さえた現地パートナーに沿って動いています。",
      metrics: [
        { value: "5,738", label: "2026年2月末時点の日本関連累計案件数", note: "登録資本は約790億米ドルです。" },
        { value: "384.2億米ドル", label: "2025年のベトナム全体の登録FDI", note: "戦略資本を吸収する強い背景です。" },
        { value: "3極", label: "北部、中部、南部が異なる役割を持つ", note: "産業、高品質サービス、大型都市、物流です。" },
        { value: "234", label: "2025年12月19日に着工または開業した主要インフラ案件", note: "レポートでは総投資額が3400兆ドン超とされています。" }
      ],
      thesisTitle: "中心仮説",
      thesis: [
        {
          title: "円安でも海外投資は止まらない",
          body: "日本企業は国内で低コスト資金を調達し、若く都市化が進む市場で利回りを探します。"
        },
        {
          title: "新しい法制度は品質のフィルター",
          body: "土地、住宅、不動産事業、入札、DPPAの改革は実行規律を高め、長期志向の日本投資家に合います。"
        },
        {
          title: "現地パートナーが入口になる",
          body: "Vinhomes、Phu My Hung、Ecopark、Becamex、Nam Long が土地リスクを下げ、日本側は資本、管理基準、運営力を加えます。"
        },
        {
          title: "公共インフラが地価を動かす",
          body: "地下鉄、高速道路、港湾、空港、電力が住宅、小売、物流、サプライチェーン投資を引き寄せます。"
        }
      ],
      spineTitle: "レポート構成",
      spine: [
        "日本側のマクロ圧力とベトナムの資本吸収力。",
        "役割の異なる三つの地域成長マップ。",
        "デベロッパーとゼネコンの価値連鎖戦略。",
        "デジタルインフラ、TOD、大型交通、ESGという四つの変化。"
      ]
    },
    map: {
      title: "日本資本の拠点を示す発表用マップ",
      intro: "会議ではこの画面を使えます。カテゴリで絞り、マーカーを選び、必要に応じて各レポートページで論点を深掘りします。",
      legendTitle: "資本カテゴリ",
      detailTitle: "選択中の拠点",
      project: "案件または役割",
      location: "位置",
      sector: "セグメント",
      coordinate: "代表座標",
      confidence: "座標の信頼度",
      reportLens: "レポート上の読み方",
      listTitle: "マップ掲載拠点",
      categoryLens: {
        Urban: "都市レイヤーは合弁モデルを示します。ベトナム側が土地アクセスを担い、日本側が長期資本と運営基準を加えます。",
        Industrial: "産業レイヤーは部品サプライチェーン、港湾、既存の日本製造拠点を持つ工業団地に沿って広がります。",
        Logistics: "物流レイヤーは港湾、空港、消費圏を結び、建設だけでなく保管と配送を資産化します。",
        Retail: "小売レイヤーはAEONなどを通じ、地方中核都市の中間層需要への期待を示します。",
        Energy: "エネルギーレイヤーはLNG、製油、石化、ベースロード電源が長期工業化に必要であることを示します。",
        "Public capital": "公的資本レイヤーは民間案件の土台です。ODA、輸出信用、インフラ金融が地価と事業可能性を変えます。"
      }
    },
    categories: {
      Urban: "都市",
      Industrial: "産業",
      Logistics: "物流",
      Retail: "小売",
      Energy: "エネルギー",
      "Public capital": "公的資本"
    },
    regions: {
      title: "三つの成長極は同じ役割ではない",
      intro: "レポートはベトナムを三層のシステムとして読みます。北部は産業、港湾、エネルギー。中部は高品質サービスとソフトインフラ。南部は大型都市需要、消費、外延物流です。",
      items: [
        {
          id: "north",
          title: "北部: 産業、港湾、LNG",
          body: "ハノイ、ヴィンフック、フンイエン、クアンニン、ハイフォンが高度製造、港湾物流、エネルギー安全保障の弧を作ります。",
          evidence: ["クアンニンには約20億米ドル、1,500 MW級のLNG案件があります。", "住友のThang Long III工業団地は213 haで、部品と精密機械を重視します。", "Logicross Hai Phong は Nam Dinh Vu にあり、土地151,000 m2、床面積88,300 m2です。"]
        },
        {
          id: "central",
          title: "中部: サービス、ホテル、ソフトインフラ",
          body: "ダナンはFTZ、国際金融センター、観光、日本語人材、ODAによる接続性で存在感を高めています。",
          evidence: ["日本はダナンFDIで首位にあり、301案件、12.2億米ドルです。", "Mikazuki、Wink Hotels、AEON計画が高品質サービス層を強めます。", "ハイヴァントンネル、ティエンサ港、ダナン - クアンガイ高速が物流基盤です。"]
        },
        {
          id: "south",
          title: "南部: 大型都市、TOD、物流ベルト",
          body: "ホーチミン、ビンズオン、ドンナイ、ロンアン、タイニンでは、都市開発、地下鉄、小売、倉庫が最大需要圏と結びつきます。",
          evidence: ["Grand Park は271 haで、都市規模の自律型居住人口を想定します。", "Tokyu Garden City は SORA Gardens、MIDORI Park、SORA gardens SC を運営します。", "Logicross Nam Thuan、AEON Tan An、AEON My Tho は南西ベルトへの広がりを示します。"]
        }
      ]
    },
    strategy: {
      title: "戦略は資本だけでなく、価値連鎖の支配である",
      intro: "日本のデベロッパーはベトナムの土地保有者と動きます。日本のゼネコンはEPCから共同開発、デジタルインフラ、グリーンエネルギー、長期運営資産へ移っています。",
      layersTitle: "四つの価値レイヤー",
      layers: [
        { title: "公的資本と信用", body: "JICA、JBIC、JOIN は地下鉄、電力、水、駅、大型都市案件の資金摩擦を下げます。" },
        { title: "クリーンな土地と現地パートナー", body: "Vingroup、Becamex、Nam Long、Ecopark、Phu My Hung が最も難しい市場リスクを担います。" },
        { title: "運営資産", body: "都市、モール、ホテル、物流、オフィスは建設収入だけでなく継続キャッシュフローを作ります。" },
        { title: "建設技術", body: "BIM、トンネル、低炭素材、自動化、日本式管理が競争のハードルを上げます。" }
      ],
      tableTitle: "開発合弁の型",
      tableHeaders: ["グループ", "地域", "資産", "意味"],
      developerRows: [
        ["Mitsubishi, Nomura, Vinhomes", "Thu Duc City", "Grand Park", "土地と基幹インフラが組み上がった大型都市への参入。"],
        ["Nomura, Ecopark", "Hung Yen", "Ecopark Residences", "大規模な緑地型都市に日本式管理を入れる。"],
        ["Becamex Tokyu", "Binh Duong", "Tokyu Garden City", "日本型の統合都市モデルを地方新都市で再構築する。"],
        ["Mitsubishi Estate, MOL, Kajima", "Hai Phong, Long An", "Logicross", "物流を南北の運営資産プラットフォームにする。"],
        ["Sumitomo Group", "Hanoi, Hung Yen, Vinh Phuc", "Thang Long IP network", "日本製造業向けの部品、サプライヤークラスターを作る。"]
      ],
      contractorTitle: "Big 5 は役割を変えている",
      contractors: [
        { name: "Obayashi", body: "工業プラントからグリーン水素、バイオマス、地熱、クリーンエネルギーへ広げます。" },
        { name: "Shimizu", body: "地下鉄、地下工事、大型橋梁、高度な施工案件で優位性を保ちます。" },
        { name: "Kajima", body: "Indochina Kajima、Wink Hotels、Core5 を通じて建てるだけでなく保有します。" },
        { name: "Taisei", body: "Design-Build 契約から Taisei Hanoi Office Tower のような収益不動産へ移ります。" }
      ]
    },
    signals: {
      title: "次に見るべき四つの変化",
      intro: "これらの変化は、マップを案件一覧ではなく、日本資本が次に向かう場所を読む道具にします。",
      items: [
        { title: "デジタルインフラ", body: "2023年電気通信法と2025年7月1日施行のデータ法により、データセンターとクラウドがインフラサービスとして定義され、日本のMEP、PUE、運用セキュリティの経験が生きます。" },
        { title: "TOD", body: "地下鉄とODAが交通の骨格を作り、Tokyu、Mitsubishi Estate、Nomura、AEON は乗換拠点周辺の地価上昇を取り込めます。" },
        { title: "大型交通", body: "Long Thanh、HCMC環状3号、ハノイ環状4号、高速鉄道には、実績、技術、30-50年の資本忍耐力が必要です。" },
        { title: "ESGとグリーン転換", body: "環境基準、低排出素材、低コストの日本金融は、土地と規制対応コストの上昇に耐える力になります。" }
      ]
    },
    analysis: {
      label: "分析",
      title: "深掘りチャート",
      intro: "長い分析を、資本が集まる場所、優先される資産、価値連鎖の要点、資本の向きを変える政策イベントとして読み替えます。",
      matrixTitle: "地域役割マトリクス",
      matrixNote: "0-100のスコアはレポート本文から作った定性的な強調度であり、公的統計ではありません。",
      regionLabels: { north: "北部", central: "中部", south: "南部" },
      dimensionLabels: {
        industrial: "産業",
        urban: "都市",
        energy: "エネルギー",
        logistics: "物流",
        soft: "ソフトインフラ"
      },
      categoryTitle: "マップ掲載点の分布",
      categoryNote: "現在のマップに含まれる企業、機関を数え、アプリの説明上の重心を示します。",
      valueTitle: "日本資本の価値連鎖",
      valueNote: "レポートは、日本が単一の役割ではなく、金融、土地アクセス、運営、建設技術を接続していることを示します。",
      valueLabels: {
        public: "公的資本と信用",
        land: "土地を持つ現地パートナー",
        operations: "運営資産",
        technology: "建設技術"
      },
      timelineTitle: "制度とインフラのタイムライン",
      timelineNote: "これらの節目が、2024-2026年を重要な変化の窓にしています。",
      bubbleTitle: "地域ポジショニング",
      bubbleNote: "横軸は都市、縦軸は物流、バブルサイズはエネルギーと重インフラの重みを表します。",
      timelineLabels: {
        laws2024: { date: "2024年8月", label: "土地、住宅、不動産事業関連法が前倒し施行" },
        dppa2025: { date: "2025年3月", label: "DPPAが新しいエネルギー案件の道を開く" },
        data2025: { date: "2025年7月", label: "データ法がデジタルインフラを定義" },
        infra2025: { date: "2025年12月", label: "234件のインフラ案件が着工または開業" },
        fdi2026: { date: "2026年2月", label: "日本の累計登録資本が約790億米ドルに接近" }
      }
    }
  }
};

/* ─── SVG Icon System ──────────────────────────────────────────────── */

function IconMapPin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 1.5C5.52 1.5 3.5 3.52 3.5 6c0 3.5 4.5 8.5 4.5 8.5S12.5 9.5 12.5 6C12.5 3.52 10.48 1.5 8 1.5z" />
      <circle cx="8" cy="6" r="1.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconArrowRight({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" />
    </svg>
  );
}

function IconExternalLink({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 10.5l9-9M10.5 1.5H5.5M10.5 1.5V6.5" />
    </svg>
  );
}

function IconClose({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 2l10 10M12 2L2 12" />
    </svg>
  );
}

function IconGrid({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="1.5" y="1.5" width="4" height="4" rx="0.75" />
      <rect x="8.5" y="1.5" width="4" height="4" rx="0.75" />
      <rect x="1.5" y="8.5" width="4" height="4" rx="0.75" />
      <rect x="8.5" y="8.5" width="4" height="4" rx="0.75" />
    </svg>
  );
}

function IconPoles({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="7" cy="2.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="2.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="11.5" cy="11.5" r="1.5" fill="currentColor" stroke="none" />
      <line x1="7" y1="4" x2="3.2" y2="10.1" />
      <line x1="7" y1="4" x2="10.8" y2="10.1" />
      <line x1="4" y1="11.5" x2="10" y2="11.5" />
    </svg>
  );
}

function IconChain({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
      <circle cx="2" cy="7" r="1.5" />
      <circle cx="7" cy="2" r="1.5" />
      <circle cx="12" cy="7" r="1.5" />
      <circle cx="7" cy="12" r="1.5" />
      <line x1="3.5" y1="7" x2="5.5" y2="2.8" />
      <line x1="8.5" y1="2.8" x2="10.5" y2="7" />
      <line x1="3.5" y1="7" x2="5.5" y2="11.2" />
      <line x1="8.5" y1="11.2" x2="10.5" y2="7" />
    </svg>
  );
}

function IconBarChart({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="2" y1="12.5" x2="12" y2="12.5" />
      <line x1="4" y1="12.5" x2="4" y2="6" />
      <line x1="7" y1="12.5" x2="7" y2="3" />
      <line x1="10" y1="12.5" x2="10" y2="8.5" />
    </svg>
  );
}

const PAGE_ICONS = {
  overview: IconGrid,
  map: IconMapPin,
  regions: IconPoles,
  strategy: IconChain,
  signals: IconBarChart,
};

/* ─── End SVG Icon System ──────────────────────────────────────────── */

function getInitialLanguage() {
  if (typeof window === "undefined") return "en";

  const stored = window.localStorage.getItem("capital-atlas-language");
  if (stored && copy[stored]) return stored;

  const browser = window.navigator.language.toLowerCase();
  if (browser.startsWith("vi")) return "vi";
  if (browser.startsWith("ja")) return "ja";
  return "en";
}

function getInitialPage() {
  if (typeof window === "undefined") return "overview";
  const key = window.location.hash.replace("#", "").replace("/", "");
  return PAGE_KEYS.includes(key) ? key : "overview";
}

function toLatLng(coords) {
  return { lat: coords[0], lng: coords[1] };
}

function getStaticPoint(coords) {
  const [lat, lng] = coords;
  const x = ((lng - VIETNAM_BOUNDS.minLng) / (VIETNAM_BOUNDS.maxLng - VIETNAM_BOUNDS.minLng)) * 100;
  const y = (1 - (lat - VIETNAM_BOUNDS.minLat) / (VIETNAM_BOUNDS.maxLat - VIETNAM_BOUNDS.minLat)) * 100;
  return {
    left: `${Math.min(92, Math.max(8, x))}%`,
    top: `${Math.min(92, Math.max(8, y))}%`
  };
}

function projectCoordsToPixel(coords, zoom) {
  const [lat, lng] = coords;
  const sin = Math.sin((lat * Math.PI) / 180);
  const scale = 256 * 2 ** zoom;
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale
  };
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getClusterPixelRadius(zoom) {
  if (zoom < 6) return 52;
  if (zoom < 8) return 42;
  if (zoom < 10) return 32;
  return 24;
}

function createSingleCluster(investor, index) {
  return {
    id: `single-${investor.id}-${index}`,
    investors: [investor],
    coords: investor.coords,
    pixel: null
  };
}

function buildInvestorClusters(list, zoom) {
  const currentZoom = Number.isFinite(zoom) ? zoom : MAP_ZOOM;
  const radius = getClusterPixelRadius(currentZoom);

  if (currentZoom >= CLUSTER_DISABLE_ZOOM) {
    return list.map(createSingleCluster);
  }

  return list.reduce((clusters, investor) => {
    const pixel = projectCoordsToPixel(investor.coords, currentZoom);
    let target = null;
    let targetDistance = Number.POSITIVE_INFINITY;

    for (const cluster of clusters) {
      const distance = getDistance(pixel, cluster.pixel);
      if (distance < radius && distance < targetDistance) {
        target = cluster;
        targetDistance = distance;
      }
    }

    if (!target) {
      clusters.push({
        id: `cluster-${investor.id}`,
        investors: [investor],
        coords: investor.coords,
        pixel
      });
      return clusters;
    }

    target.investors.push(investor);
    const count = target.investors.length;
    target.coords = [
      target.investors.reduce((sum, item) => sum + item.coords[0], 0) / count,
      target.investors.reduce((sum, item) => sum + item.coords[1], 0) / count
    ];
    target.pixel = projectCoordsToPixel(target.coords, currentZoom);
    target.id = `cluster-${target.investors.map((item) => item.id).join("-")}`;
    return clusters;
  }, []);
}

function getClusterExpandZoom(cluster, currentZoom) {
  if (cluster.investors.length <= 1) return currentZoom;

  const nextStepZoom = Math.max(Math.floor(currentZoom) + 1, CLUSTER_EXPAND_MIN_ZOOM);

  for (let zoom = nextStepZoom; zoom <= CLUSTER_EXPAND_MAX_ZOOM; zoom += 0.5) {
    const childClusters = buildInvestorClusters(cluster.investors, zoom);
    if (childClusters.length > 1) {
      return zoom;
    }
  }

  let minDistanceAtWorldZoom = Number.POSITIVE_INFINITY;

  for (let i = 0; i < cluster.investors.length; i += 1) {
    for (let j = i + 1; j < cluster.investors.length; j += 1) {
      const first = projectCoordsToPixel(cluster.investors[i].coords, 0);
      const second = projectCoordsToPixel(cluster.investors[j].coords, 0);
      const distance = getDistance(first, second);
      if (distance > 0 && distance < minDistanceAtWorldZoom) {
        minDistanceAtWorldZoom = distance;
      }
    }
  }

  const zoomForSeparation = Number.isFinite(minDistanceAtWorldZoom)
    ? Math.ceil(Math.log2(getClusterPixelRadius(CLUSTER_EXPAND_MAX_ZOOM) / minDistanceAtWorldZoom))
    : CLUSTER_EXPAND_MAX_ZOOM;
  const targetZoom = Math.max(currentZoom + 2, zoomForSeparation, CLUSTER_EXPAND_MIN_ZOOM);

  return Math.min(Math.max(targetZoom, CLUSTER_EXPAND_MIN_ZOOM), CLUSTER_EXPAND_MAX_ZOOM);
}

function App() {
  const [language, setLanguage] = useState(getInitialLanguage);
  const [activePage, setActivePage] = useState(getInitialPage);
  const [activeId, setActiveId] = useState(investors[0].id);
  const [activeFilter, setActiveFilter] = useState("all");
  const [focusRequest, setFocusRequest] = useState(null);
  const [isCompanyPanelOpen, setCompanyPanelOpen] = useState(false);
  const mapStageRef = useRef(null);

  const t = copy[language];

  const activeInvestor = useMemo(
    () => investors.find((investor) => investor.id === activeId) ?? investors[0],
    [activeId]
  );

  const visibleInvestors = useMemo(
    () => investors.filter((investor) => activeFilter === "all" || investor.category === activeFilter),
    [activeFilter]
  );

  const navigate = useCallback((page) => {
    setActivePage(page);
    if (typeof window !== "undefined" && window.location.hash !== `#${page}`) {
      window.location.hash = page;
    }
  }, []);

  const changeLanguage = useCallback((nextLanguage) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem("capital-atlas-language", nextLanguage);
  }, []);

  const selectInvestor = useCallback(
    (id, options = {}) => {
      const investor = investors.find((item) => item.id === id);
      if (!investor) return;

      if (activeFilter !== "all" && activeFilter !== investor.category) {
        setActiveFilter("all");
      }

      setActiveId(id);

      if (options.focus) {
        setFocusRequest({ id, nonce: Date.now() });
      }

      if (options.showPanel) {
        setCompanyPanelOpen(true);
      }

      if (options.openMap) {
        navigate("map");
      }
    },
    [activeFilter, navigate]
  );

  useEffect(() => {
    const onHashChange = () => {
      const key = window.location.hash.replace("#", "").replace("/", "");
      if (PAGE_KEYS.includes(key)) {
        setActivePage(key);
      }
    };

    onHashChange();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `${t.app.title} | ${t.nav[activePage]}`;
  }, [activePage, language, t]);

  useEffect(() => {
    if (!visibleInvestors.some((investor) => investor.id === activeId)) {
      setActiveId(visibleInvestors[0]?.id ?? investors[0].id);
    }
  }, [activeFilter, activeId, visibleInvestors]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activePage]);

  return (
    <div className="app-shell min-h-screen bg-paper text-ink">
      <Topbar
        activePage={activePage}
        language={language}
        navigate={navigate}
        onLanguageChange={changeLanguage}
        t={t}
      />

      <main id="content" className="mx-auto w-full max-w-[1500px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div key={activePage} className="page-enter">
          {activePage === "overview" ? (
            <OverviewPage navigate={navigate} t={t} />
          ) : null}

          {activePage === "map" ? (
            <MapPage
              activeFilter={activeFilter}
              activeInvestor={activeInvestor}
              focusRequest={focusRequest}
              language={language}
              mapStageRef={mapStageRef}
              isCompanyPanelOpen={isCompanyPanelOpen}
              onCloseCompanyPanel={() => setCompanyPanelOpen(false)}
              selectInvestor={selectInvestor}
              setActiveFilter={setActiveFilter}
              t={t}
              visibleInvestors={visibleInvestors}
            />
          ) : null}

          {activePage === "regions" ? (
            <RegionsPage language={language} selectInvestor={selectInvestor} t={t} />
          ) : null}

          {activePage === "strategy" ? (
            <StrategyPage t={t} />
          ) : null}

          {activePage === "signals" ? (
            <SignalsPage t={t} />
          ) : null}

        </div>
      </main>
    </div>
  );
}

function Topbar({ activePage, language, navigate, onLanguageChange, t }) {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-paper shadow-soft">
      <div className="topbar-accent" />
      <div className="topbar-layout">
        <button type="button" className="brand-button" onClick={() => navigate("overview")}>
          <span className="brand-mark">
            <svg className="absolute inset-0 opacity-[0.22]" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M27 6 C32 8, 33 14, 30 19 C27 23, 22 27, 21 32 C20 36, 22 38, 24 40" stroke="oklch(62% 0.13 168)" strokeWidth="5" strokeLinecap="round" />
            </svg>
            <span className="relative z-10 text-sm font-black tracking-[0.02em]">JP</span>
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-black tracking-normal">{t.app.title}</span>
            <span className="hidden max-w-[560px] truncate text-xs font-medium text-muted sm:block">
              {t.app.subtitle}
            </span>
          </span>
        </button>

        <div className="topbar-actions">
          <PageSelect activePage={activePage} navigate={navigate} t={t} />
          <LanguageSelect language={language} onLanguageChange={onLanguageChange} t={t} />
        </div>

        <nav className="primary-nav" aria-label="Primary">
          {PAGE_KEYS.map((page) => {
            const PageIcon = PAGE_ICONS[page];
            return (
              <button
                key={page}
                type="button"
                aria-current={activePage === page ? "page" : undefined}
                className={`nav-tab ${activePage === page ? "is-active" : ""}`}
                onClick={() => navigate(page)}
              >
                <span className="hidden sm:contents">
                  <PageIcon size={13} />
                </span>
                {t.nav[page]}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

function PageSelect({ activePage, navigate, t }) {
  return (
    <label className="page-select-wrap">
      <span className="sr-only">Navigation</span>
      <select
        value={activePage}
        className="page-select"
        aria-label="Navigation"
        onChange={(event) => navigate(event.target.value)}
      >
        {PAGE_KEYS.map((page) => (
          <option key={page} value={page}>
            {t.nav[page]}
          </option>
        ))}
      </select>
    </label>
  );
}

function LanguageSelect({ language, onLanguageChange, t }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const selectedLanguage = languages.find((item) => item.id === language) ?? languages[0];

  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnOutside = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <div className="language-dropdown shrink-0" ref={dropdownRef}>
      <button
        type="button"
        className="language-dropdown-button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t.common.language}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={`flag flag-${selectedLanguage.id}`} aria-hidden="true" />
        <span>{selectedLanguage.short}</span>
      </button>

      {isOpen ? (
        <div className="language-menu" role="listbox" aria-label={t.common.language}>
          {languages.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`language-option ${language === item.id ? "is-active" : ""}`}
              role="option"
              aria-selected={language === item.id}
              onClick={() => {
                onLanguageChange(item.id);
                setIsOpen(false);
              }}
            >
              <span className={`flag flag-${item.id}`} aria-hidden="true" />
              <span className="language-option-text">
                <strong>{item.short}</strong>
                <span>{item.label}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OverviewPage({ navigate, t }) {
  return (
    <div className="overview-page">
      <section className="atlas-hero">
        <div className="hero-grid" aria-hidden="true" />

        <div className="atlas-hero-copy">
          <div className="eyebrow">{t.nav.overview}</div>
          <h1>
            {t.overview.title}
          </h1>
          <p>{t.overview.intro}</p>
          <div className="atlas-hero-actions">
            <button type="button" className="primary-button" onClick={() => navigate("map")}>
              <IconMapPin size={15} />
              {t.common.jumpToMap}
            </button>
            <button
              type="button"
              className="text-link-button"
              onClick={() => navigate("regions")}
            >
              {t.nav.regions}
              <IconArrowRight size={13} />
            </button>
          </div>
        </div>

        <AtlasVisual t={t} />

        <aside className="report-spine">
          <div className="eyebrow">{t.overview.spineTitle}</div>
          <ol>
            {t.overview.spine.map((item, index) => (
              <li key={item}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="metric-grid" aria-label="Report metrics">
        {t.overview.metrics.map((metric, index) => (
          <MetricTile key={metric.label} metric={metric} tier={index < 2 ? "primary" : "secondary"} />
        ))}
      </section>

      <section className="thesis-section">
        <div className="section-kicker">
          <div className="eyebrow">{t.nav.overview}</div>
          <h2>{t.overview.thesisTitle}</h2>
        </div>
        <div className="thesis-grid">
          {t.overview.thesis.map((item, index) => (
            <article key={item.title} className="thesis-card">
              <div>{String(index + 1).padStart(2, "0")}</div>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AtlasVisual({ t }) {
  const hasLiveMap = Boolean(GOOGLE_MAPS_API_KEY);

  return (
    <div className="atlas-visual" aria-hidden="true">
      <div className={`atlas-visual-map ${hasLiveMap ? "is-live-map" : ""}`}>
        {hasLiveMap ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["marker"]} version="beta">
            <Map
              mapId={GOOGLE_MAP_ID}
              defaultCenter={MAP_CENTER}
              defaultZoom={5.35}
              gestureHandling="none"
              keyboardShortcuts={false}
              clickableIcons={false}
              disableDefaultUI
              style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
            />
          </APIProvider>
        ) : (
          <AtlasFallbackMap t={t} />
        )}
        <div className="atlas-live-overlay">
          <span className="atlas-live-chip atlas-live-chip-north">{t.regions.items[0].title}</span>
          <span className="atlas-live-chip atlas-live-chip-central">{t.regions.items[1].title}</span>
          <span className="atlas-live-chip atlas-live-chip-south">{t.regions.items[2].title}</span>
        </div>
      </div>
      <div className="atlas-visual-caption">
        <span>2024-2026</span>
        <strong>{t.common.presentationReady}</strong>
      </div>
    </div>
  );
}

function AtlasFallbackMap({ t }) {
  return (
    <>
      <span className="atlas-landmass" />
      <span className="atlas-route atlas-route-one" />
      <span className="atlas-route atlas-route-two" />
      <span className="atlas-pin atlas-pin-north">JP</span>
      <span className="atlas-pin atlas-pin-central">FDI</span>
      <span className="atlas-pin atlas-pin-south">TOD</span>
      <span className="atlas-region atlas-region-north">{t.regions.items[0].title}</span>
      <span className="atlas-region atlas-region-central">{t.regions.items[1].title}</span>
      <span className="atlas-region atlas-region-south">{t.regions.items[2].title}</span>
    </>
  );
}

function MetricTile({ metric, tier = "secondary" }) {
  const isPrimary = tier === "primary";
  return (
    <article className={`metric-tile ${isPrimary ? "is-primary" : ""}`}>
      <strong>
        {metric.value}
      </strong>
      <span>{metric.label}</span>
      <span>{metric.note}</span>
    </article>
  );
}

function MapPage({
  activeFilter,
  activeInvestor,
  focusRequest,
  language,
  mapStageRef,
  isCompanyPanelOpen,
  onCloseCompanyPanel,
  selectInvestor,
  setActiveFilter,
  t,
  visibleInvestors
}) {
  return (
    <div className="map-command-page">
      <section className="map-page-header">
        <div>
          <div className="eyebrow">{t.common.presentationReady}</div>
          <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight tracking-normal sm:text-4xl">
            {t.map.title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{t.map.intro}</p>
        </div>
        <FilterControls activeFilter={activeFilter} language={language} setActiveFilter={setActiveFilter} t={t} />
      </section>

      <section className="map-intelligence-strip" aria-label={t.map.detailTitle}>
        <div>
          <span>{t.map.detailTitle}</span>
          <strong>{activeInvestor.name}</strong>
        </div>
        <div>
          <span>{t.map.sector}</span>
          <strong>{localCategory(activeInvestor.category, language, t)}</strong>
        </div>
        <div>
          <span>{t.map.location}</span>
          <strong>{activeInvestor.location}</strong>
        </div>
        <div>
          <span>{t.common.projects}</span>
          <strong>{visibleInvestors.length} / {investors.length}</strong>
        </div>
      </section>

      <section className="map-workspace">
        <div
          ref={mapStageRef}
          className="map-stage"
          aria-label={t.map.title}
        >
          {GOOGLE_MAPS_API_KEY ? (
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["marker"]} version="beta">
              <Map
                mapId={GOOGLE_MAP_ID}
                defaultCenter={MAP_CENTER}
                defaultZoom={MAP_ZOOM}
                gestureHandling="greedy"
                clickableIcons={false}
                disableDefaultUI={false}
                style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
                >
                  <MapFocus focusRequest={focusRequest} />
                <ClusteredInvestorMarkers
                  activeId={activeInvestor.id}
                  investors={visibleInvestors}
                  language={language}
                  onSelect={selectInvestor}
                  t={t}
                />
              </Map>
            </APIProvider>
          ) : (
            <StaticReportMap
              activeId={activeInvestor.id}
              investors={visibleInvestors}
              language={language}
              onSelect={selectInvestor}
              t={t}
            />
          )}
        </div>

        <CompanySidePanel
          investor={activeInvestor}
          isOpen={isCompanyPanelOpen}
          language={language}
          onClose={onCloseCompanyPanel}
          selectInvestor={selectInvestor}
          t={t}
        />
      </section>

      <InvestorDirectory
        investors={visibleInvestors}
        language={language}
        selectInvestor={selectInvestor}
        t={t}
      />
    </div>
  );
}

function MapFocus({ focusRequest }) {
  const map = useMap();

  useEffect(() => {
    if (!map || !focusRequest) return;

    const investor = investors.find((item) => item.id === focusRequest.id);
    if (!investor) return;

    map.panTo(toLatLng(investor.coords));
    map.setZoom(Math.max(map.getZoom() || MAP_ZOOM, 8));
  }, [focusRequest, map]);

  return null;
}

function ClusteredInvestorMarkers({ activeId, investors: visibleInvestors, language, onSelect, t }) {
  const map = useMap();
  const zoomAnimationRef = useRef(null);
  const [zoom, setZoom] = useState(MAP_ZOOM);

  useEffect(() => {
    if (!map) return undefined;

    const updateZoom = () => setZoom(map.getZoom() ?? MAP_ZOOM);
    updateZoom();

    const listener = map.addListener("zoom_changed", updateZoom);
    return () => listener.remove();
  }, [map]);

  useEffect(
    () => () => {
      if (zoomAnimationRef.current) {
        window.clearTimeout(zoomAnimationRef.current);
      }
    },
    []
  );

  const clusters = useMemo(() => buildInvestorClusters(visibleInvestors, zoom), [visibleInvestors, zoom]);

  const zoomGradually = useCallback(
    (targetZoom) => {
      if (!map) return;

      if (zoomAnimationRef.current) {
        window.clearTimeout(zoomAnimationRef.current);
      }

      const step = () => {
        const currentZoom = map.getZoom() ?? zoom;
        const nextZoom = Math.min(Math.floor(currentZoom) + 1, targetZoom);

        if (nextZoom <= currentZoom) {
          map.setZoom(targetZoom);
          zoomAnimationRef.current = null;
          return;
        }

        map.setZoom(nextZoom);

        if (nextZoom < targetZoom) {
          zoomAnimationRef.current = window.setTimeout(step, CLUSTER_ZOOM_STEP_DELAY);
        } else {
          zoomAnimationRef.current = null;
        }
      };

      zoomAnimationRef.current = window.setTimeout(step, 90);
    },
    [map, zoom]
  );

  const openCluster = useCallback(
    (cluster) => {
      if (!map) return;

      const currentZoom = map.getZoom() ?? zoom;
      const targetZoom = Math.ceil(getClusterExpandZoom(cluster, currentZoom));

      map.panTo(toLatLng(cluster.coords));

      if (targetZoom <= currentZoom) {
        map.setZoom(targetZoom);
        return;
      }

      zoomGradually(targetZoom);
    },
    [map, zoom, zoomGradually]
  );

  return clusters.map((cluster) => {
    if (cluster.investors.length === 1) {
      const investor = cluster.investors[0];
      return (
        <SingleInvestorMarker
          key={cluster.id}
          activeId={activeId}
          investor={investor}
          language={language}
          onSelect={onSelect}
          t={t}
        />
      );
    }

    const isActiveCluster = cluster.investors.some((investor) => investor.id === activeId);
    const clusterTitle = cluster.investors.map((investor) => investor.name).join(", ");

    return (
      <AdvancedMarker
        key={cluster.id}
        position={toLatLng(cluster.coords)}
        title={clusterTitle}
        zIndex={isActiveCluster ? 35 : 25}
        onClick={() => openCluster(cluster)}
      >
        <button
          type="button"
          className={`cluster-marker ${isActiveCluster ? "is-active" : ""}`}
          aria-label={`${cluster.investors.length} ${t.common.investors}: ${clusterTitle}`}
          onClick={(event) => {
            event.stopPropagation();
            openCluster(cluster);
          }}
        >
          {cluster.investors.length}
        </button>
      </AdvancedMarker>
    );
  });
}

function SingleInvestorMarker({ activeId, investor, language, onSelect, t }) {
  return (
    <AdvancedMarker
      key={investor.id}
      position={toLatLng(investor.coords)}
      title={investor.name}
      zIndex={activeId === investor.id ? 20 : 10}
      onClick={() => onSelect(investor.id, { focus: true, showPanel: true })}
    >
      <div className="group relative grid place-items-center">
        <button
          type="button"
          className={`investor-marker ${activeId === investor.id ? "is-active" : ""}`}
          data-label={investor.label}
          style={{ "--marker-color": investor.color }}
          aria-label={`${t.common.viewOnMap}: ${investor.name}`}
          onFocus={() => onSelect(investor.id)}
          onClick={(event) => {
            event.stopPropagation();
            onSelect(investor.id, { focus: true, showPanel: true });
          }}
        />
        <span className="pointer-events-none absolute bottom-[44px] left-1/2 min-w-max -translate-x-1/2 rounded-md bg-night px-2.5 py-1.5 text-xs font-black text-paper opacity-0 shadow-soft transition group-hover:opacity-100 group-focus-within:opacity-100">
          {investor.name} · {localCategory(investor.category, language, t)}
        </span>
      </div>
    </AdvancedMarker>
  );
}

function StaticReportMap({ activeId, investors: visibleInvestors, language, onSelect, t }) {
  return (
    <div className="static-map absolute inset-0">
      <div className="absolute left-4 top-4 z-20 max-w-[330px] rounded-lg border border-line bg-paper/95 p-4 shadow-soft">
        <h2 className="text-base font-black">{t.common.noApiTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{t.common.noApiBody}</p>
      </div>
      <div className="map-band map-band-north">
        <span>{t.regions.items[0].title}</span>
      </div>
      <div className="map-band map-band-central">
        <span>{t.regions.items[1].title}</span>
      </div>
      <div className="map-band map-band-south">
        <span>{t.regions.items[2].title}</span>
      </div>
      {visibleInvestors.map((investor) => {
        const point = getStaticPoint(investor.coords);
        return (
          <button
            key={investor.id}
            type="button"
            className={`fallback-pin ${activeId === investor.id ? "is-active" : ""}`}
            style={{ ...point, "--marker-color": investor.color }}
            aria-label={`${t.common.viewOnMap}: ${investor.name}`}
            onClick={() => onSelect(investor.id, { focus: true, showPanel: true })}
          >
            <span>{investor.label}</span>
            <strong>{investor.name}</strong>
            <em>{localCategory(investor.category, language, t)}</em>
          </button>
        );
      })}
    </div>
  );
}

function FilterControls({ activeFilter, language, setActiveFilter, t }) {
  return (
    <div className="filter-panel">
      <div className="eyebrow">{t.map.legendTitle}</div>
      <div aria-label={t.map.legendTitle}>
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            onClick={() => setActiveFilter(filter)}
            className={`filter-button ${activeFilter === filter ? "is-active" : ""}`}
          >
            {filter === "all" ? t.common.all : localCategory(filter, language, t)}
          </button>
        ))}
      </div>
    </div>
  );
}

function CompanySidePanel({ investor, isOpen, language, onClose, selectInvestor, t }) {
  useEffect(() => {
    if (!isOpen) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  return (
    <aside className={`company-drawer ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
      <div className="company-drawer-panel">
        <InvestorDetail investor={investor} language={language} onClose={onClose} selectInvestor={selectInvestor} t={t} />
      </div>
    </aside>
  );
}

function InvestorDetail({ investor, language, onClose, selectInvestor, t }) {
  const lens = t.map.categoryLens[investor.category] ?? t.map.categoryLens.Urban;
  const media = getInvestorMedia(investor);

  return (
    <div>
      <CompanyVisual investor={investor} media={media} variant="hero" language={language} t={t} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="status-chip" style={{ "--chip-color": investor.color }}>
              {localCategory(investor.category, language, t)}
            </span>
            <span className="status-chip" style={{ "--chip-color": investor.color }}>
              {investor.label}
            </span>
          </div>
          <h2 className="mt-4 text-2xl font-black leading-tight tracking-normal">{investor.name}</h2>
        </div>
        <button type="button" className="secondary-button shrink-0" onClick={onClose}>
          <IconClose size={13} />
          {t.common.close}
        </button>
      </div>

      <dl className="mt-5 divide-y divide-line border-y border-line text-sm">
        <DetailRow label={t.map.sector} value={investor.sector} />
        <DetailRow label={t.map.location} value={investor.location} />
        <DetailRow label={t.map.coordinate} value={`${investor.coords[0].toFixed(4)}, ${investor.coords[1].toFixed(4)}`} />
        <DetailRow label={t.map.confidence} value={investor.confidence} />
      </dl>

      <div className="mt-5 rounded-md bg-paper p-4">
        <div className="eyebrow">{t.map.project}</div>
        <p className="mt-2 text-sm leading-6 text-ink">{investor.project}</p>
      </div>

      <div className="mt-4 rounded-md border border-line bg-paper p-4">
        <div className="eyebrow">{t.map.reportLens}</div>
        <p className="mt-2 text-sm leading-6 text-muted">{lens}</p>
      </div>

      <div className="mt-5">
        <div className="eyebrow">{t.common.sourceLinks}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {media.sourceHref ? (
            <a
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-black text-ink no-underline transition hover:border-green hover:bg-surface2 focus:outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
              href={media.sourceHref}
              target="_blank"
              rel="noreferrer"
            >
              {media.sourceLabel}
              <IconExternalLink />
            </a>
          ) : null}
          {investor.sources.map(([label, href]) => (
            <a
              key={href}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-line bg-paper px-2.5 py-1.5 text-xs font-black text-ink no-underline transition hover:border-green hover:bg-surface2 focus:outline-none focus-visible:border-green focus-visible:ring-2 focus-visible:ring-green/20"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {label}
              <IconExternalLink />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompanyVisual({ investor, media, variant = "thumb", language, t }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = media.image && !imageFailed;
  const initials = getInitials(investor.name);
  const categoryLabel = language && t ? localCategory(investor.category, language, t) : investor.category;

  return (
    <figure className={`company-visual ${variant === "hero" ? "is-hero" : "is-thumb"}`}>
      {showImage ? (
        <img src={media.image} alt={media.title || investor.name} loading={variant === "hero" ? "eager" : "lazy"} onError={() => setImageFailed(true)} />
      ) : (
        <div className="company-visual-fallback" style={{ "--visual-color": investor.color }}>
          <strong>{initials}</strong>
          <span>{categoryLabel}</span>
        </div>
      )}
      {media.icon ? (
        <span className="company-icon">
          <img src={media.icon} alt="" loading="lazy" onError={(event) => event.currentTarget.remove()} />
        </span>
      ) : null}
      {variant === "hero" ? (
        <figcaption>
          <strong>{media.title || investor.name}</strong>
          <span>{media.sourceLabel || investor.sector}</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="font-black text-muted">{label}</dt>
      <dd className="m-0 leading-6 text-ink">{value}</dd>
    </div>
  );
}

function InvestorDirectory({ investors: listedInvestors, language, selectInvestor, t }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow">{t.common.investors}</div>
          <h2 className="mt-2 text-2xl font-black tracking-normal">{t.map.listTitle}</h2>
        </div>
        <span className="text-sm font-bold text-muted">
          {listedInvestors.length} / {investors.length} {t.common.projects}
        </span>
      </div>
      <div className="mt-4 grid gap-2">
        {listedInvestors.map((investor) => (
          <article
            key={investor.id}
            className="investor-directory-row"
          >
            <CompanyVisual investor={investor} media={getInvestorMedia(investor)} language={language} t={t} />
            <strong className="text-sm leading-5">{investor.name}</strong>
            <span className="text-sm font-bold text-muted">{localCategory(investor.category, language, t)}</span>
            <span className="text-sm leading-6 text-muted">{investor.location}</span>
            <button
              type="button"
              className="primary-button justify-self-start md:justify-self-end"
              onClick={() => selectInvestor(investor.id, { focus: true, openMap: true, showPanel: true })}
            >
              <IconMapPin size={14} />
              {t.common.viewOnMap}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function RegionsPage({ language, selectInvestor, t }) {
  const regionInvestorMap = {
    north: ["sumitomo", "nomura", "mitsubishi-estate", "join"],
    central: ["kajima", "aeon", "marubeni"],
    south: ["tokyu", "nnr", "hankyu", "sojitz", "jica"]
  };

  return (
    <div className="grid gap-6">
      <SectionHeader title={t.regions.title} body={t.regions.intro} eyebrow={t.nav.regions} />
      <div className="grid gap-4">
        {t.regions.items.map((region, index) => (
          <article key={region.id} className="region-panel">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,0.8fr)_minmax(360px,0.5fr)]">
              <div>
                <div className="eyebrow">0{index + 1}</div>
                <h2 className="mt-3 text-2xl font-black leading-tight tracking-normal sm:text-3xl">{region.title}</h2>
                <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{region.body}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {regionInvestorMap[region.id].map((id) => {
                    const investor = investors.find((item) => item.id === id);
                    if (!investor) return null;
                    return (
                      <button
                        key={id}
                        type="button"
                        className="filter-button"
                        onClick={() => selectInvestor(id, { focus: true, openMap: true, showPanel: true })}
                      >
                        <IconMapPin size={13} />
                        {investor.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <EvidenceList evidence={region.evidence} language={language} t={t} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function EvidenceList({ evidence, t }) {
  return (
    <div className="rounded-lg border border-line bg-paper p-4">
      <div className="eyebrow">{t.common.evidence}</div>
      <ul className="mt-3 grid list-none gap-3 p-0">
        {evidence.map((item, index) => (
          <li key={item} className="grid grid-cols-[30px_minmax(0,1fr)] gap-3 text-sm leading-6 text-muted">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-surface font-black text-ink">{index + 1}</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StrategyPage({ t }) {
  return (
    <div className="grid gap-7">
      <SectionHeader title={t.strategy.title} body={t.strategy.intro} eyebrow={t.nav.strategy} />

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionIntro title={t.strategy.layersTitle} body={t.strategy.intro} />
        <div className="grid gap-3 md:grid-cols-2">
          {t.strategy.layers.map((layer, index) => (
            <article key={layer.title} className="rounded-lg border border-line bg-surface p-5">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-muted">0{index + 1}</div>
              <h2 className="mt-3 text-lg font-black tracking-normal">{layer.title}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{layer.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-line bg-surface p-4">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-black tracking-normal">{t.strategy.tableTitle}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-[0.12em] text-muted">
                {t.strategy.tableHeaders.map((header) => (
                  <th key={header} className="px-3 py-3 font-black">{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.strategy.developerRows.map((row) => (
                <tr key={row.join("-")} className="border-b border-line last:border-b-0">
                  {row.map((cell, index) => (
                    <td key={`${cell}-${index}`} className="px-3 py-4 align-top leading-6 text-muted">
                      {index === 0 ? <strong className="text-ink">{cell}</strong> : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionIntro title={t.strategy.contractorTitle} body={t.strategy.intro} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {t.strategy.contractors.map((contractor) => (
            <article key={contractor.name} className="rounded-lg border border-line bg-surface p-5">
              <h2 className="text-lg font-black tracking-normal">{contractor.name}</h2>
              <p className="mt-3 text-sm leading-6 text-muted">{contractor.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function SignalsPage({ t }) {
  return (
    <div className="grid gap-6">
      <SectionHeader title={t.signals.title} body={t.signals.intro} eyebrow={t.nav.signals} />
      <section className="grid gap-3">
        {t.signals.items.map((item, index) => (
          <article key={item.title} className="signal-row">
            <span className="signal-index">0{index + 1}</span>
            <div>
              <h2 className="text-xl font-black tracking-normal">{item.title}</h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-muted">{item.body}</p>
            </div>
          </article>
        ))}
      </section>
      <AnalysisCharts t={t} />
    </div>
  );
}

function AnalysisCharts({ t }) {
  return (
    <section className="analysis-section">
      <div className="analysis-intro">
        <div className="eyebrow">{t.analysis.label}</div>
        <h2>{t.analysis.title}</h2>
        <p>{t.analysis.intro}</p>
      </div>
      <div className="analysis-grid">
        <ChartCard title={t.analysis.matrixTitle} note={t.analysis.matrixNote}>
          <RegionalRadarChart t={t} />
        </ChartCard>
        <ChartCard title={t.analysis.categoryTitle} note={t.analysis.categoryNote}>
          <CategoryDoughnutChart t={t} />
        </ChartCard>
        <ChartCard title={t.analysis.valueTitle} note={t.analysis.valueNote}>
          <ValueChainBarChart t={t} />
        </ChartCard>
        <ChartCard title={t.analysis.bubbleTitle} note={t.analysis.bubbleNote}>
          <RegionalBubbleChart t={t} />
        </ChartCard>
        <ChartCard title={t.analysis.timelineTitle} note={t.analysis.timelineNote} wide>
          <PolicyTimelineChart t={t} />
        </ChartCard>
      </div>
    </section>
  );
}

function ChartCard({ children, note, title, wide = false }) {
  return (
    <article className={`chart-card ${wide ? "is-wide" : ""}`}>
      <div className="chart-card-head">
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className="chart-body">{children}</div>
    </article>
  );
}

function RegionalRadarChart({ t }) {
  const dimensions = ["industrial", "urban", "energy", "logistics", "soft"];
  const labels = dimensions.map((dimension) => t.analysis.dimensionLabels[dimension]);
  const datasets = regionalMatrixValues.map((region, index) => ({
    label: t.analysis.regionLabels[region.id],
    data: dimensions.map((dimension) => region.values[dimension]),
    borderColor: chartSeriesColors[index],
    backgroundColor: withAlpha(chartSeriesColors[index], 0.14),
    pointBackgroundColor: chartSeriesColors[index],
    pointBorderColor: "oklch(97.7% 0.009 98)",
    pointHoverRadius: 5,
    borderWidth: 2
  }));

  return (
    <Radar
      data={{ labels, datasets }}
      options={{
        ...commonChartOptions(),
        scales: {
          r: {
            angleLines: { color: chartPalette.line },
            grid: { color: chartPalette.line },
            pointLabels: { color: chartPalette.ink, font: { size: 11, weight: 700 } },
            suggestedMin: 0,
            suggestedMax: 100,
            ticks: { backdropColor: "transparent", color: chartPalette.muted, stepSize: 25 }
          }
        }
      }}
    />
  );
}

function CategoryDoughnutChart({ t }) {
  const counts = filters
    .filter((filter) => filter !== "all")
    .map((category) => ({
      category,
      label: localCategory(category, "en", { categories: t.categories }),
      value: investors.filter((investor) => investor.category === category).length
    }));

  return (
    <Doughnut
      data={{
        labels: counts.map((item) => item.label),
        datasets: [
          {
            data: counts.map((item) => item.value),
            backgroundColor: chartSeriesColors,
            borderColor: "oklch(95.8% 0.012 112)",
            borderWidth: 3,
            hoverOffset: 7
          }
        ]
      }}
      options={{
        ...commonChartOptions(),
        cutout: "58%",
        plugins: {
          ...commonChartOptions().plugins,
          legend: { ...commonChartOptions().plugins.legend, position: "bottom" }
        }
      }}
    />
  );
}

function ValueChainBarChart({ t }) {
  const labels = valueChainValues.map((item) => t.analysis.valueLabels[item.id]);

  return (
    <Bar
      data={{
        labels,
        datasets: [
          {
            label: t.analysis.valueTitle,
            data: valueChainValues.map((item) => item.value),
            backgroundColor: [chartPalette.green, chartPalette.sky, chartPalette.gold, chartPalette.violet],
            borderRadius: 7,
            barThickness: 18
          }
        ]
      }}
      options={{
        ...commonChartOptions(),
        indexAxis: "y",
        scales: {
          x: {
            max: 100,
            grid: { color: chartPalette.line },
            ticks: { color: chartPalette.muted }
          },
          y: {
            grid: { display: false },
            ticks: { color: chartPalette.ink, font: { size: 11, weight: 800 } }
          }
        },
        plugins: {
          ...commonChartOptions().plugins,
          legend: { display: false }
        }
      }}
    />
  );
}

function RegionalBubbleChart({ t }) {
  return (
    <Bubble
      data={{
        datasets: regionalMatrixValues.map((region, index) => ({
          label: t.analysis.regionLabels[region.id],
          data: [
            {
              x: region.values.urban,
              y: region.values.logistics,
              r: Math.max(10, region.values.energy / 4)
            }
          ],
          backgroundColor: withAlpha(chartSeriesColors[index], 0.32),
          borderColor: chartSeriesColors[index],
          borderWidth: 2
        }))
      }}
      options={{
        ...commonChartOptions(),
        scales: {
          x: {
            min: 30,
            max: 100,
            grid: { color: chartPalette.line },
            ticks: { color: chartPalette.muted },
            title: { display: true, text: t.analysis.dimensionLabels.urban, color: chartPalette.ink, font: { weight: 900 } }
          },
          y: {
            min: 30,
            max: 100,
            grid: { color: chartPalette.line },
            ticks: { color: chartPalette.muted },
            title: { display: true, text: t.analysis.dimensionLabels.logistics, color: chartPalette.ink, font: { weight: 900 } }
          }
        }
      }}
    />
  );
}

function PolicyTimelineChart({ t }) {
  const labels = timelineValues.map((item) => t.analysis.timelineLabels[item.id].date);

  return (
    <Line
      data={{
        labels,
        datasets: [
          {
            label: t.analysis.timelineTitle,
            data: [52, 64, 72, 92, 100],
            borderColor: chartPalette.green,
            backgroundColor: withAlpha(chartPalette.green, 0.16),
            pointBackgroundColor: chartPalette.green,
            pointBorderColor: "oklch(97.7% 0.009 98)",
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 3,
            fill: true,
            tension: 0.34
          }
        ]
      }}
      options={{
        ...commonChartOptions(),
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: chartPalette.ink, font: { weight: 800 } }
          },
          y: {
            min: 40,
            max: 105,
            grid: { color: chartPalette.line },
            ticks: { color: chartPalette.muted }
          }
        },
        plugins: {
          ...commonChartOptions().plugins,
          legend: { display: false },
          tooltip: {
            ...commonChartOptions().plugins.tooltip,
            callbacks: {
              afterLabel: (context) => {
                const item = timelineValues[context.dataIndex];
                return t.analysis.timelineLabels[item.id].label;
              }
            }
          }
        }
      }}
    />
  );
}

function commonChartOptions() {
  return {
    maintainAspectRatio: false,
    responsive: true,
    plugins: {
      legend: {
        labels: {
          boxWidth: 10,
          boxHeight: 10,
          color: chartPalette.ink,
          font: { size: 11, weight: 800 },
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: chartPalette.ink,
        bodyColor: "oklch(97.7% 0.009 98)",
        borderColor: chartPalette.line,
        borderWidth: 1,
        padding: 10,
        titleColor: "oklch(97.7% 0.009 98)"
      }
    }
  };
}

function SectionHeader({ title, body, eyebrow }) {
  return (
    <section className="max-w-5xl">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h1 className="mt-3 text-3xl font-black leading-tight tracking-normal sm:text-4xl">{title}</h1>
      <p className="mt-4 max-w-3xl text-base leading-7 text-muted">{body}</p>
    </section>
  );
}

function SectionIntro({ title, body, eyebrow }) {
  return (
    <div>
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2 className={`${eyebrow ? "mt-3" : ""} text-2xl font-black leading-tight tracking-normal`}>{title}</h2>
      {body ? <p className="mt-3 text-sm leading-6 text-muted">{body}</p> : null}
    </div>
  );
}

function localCategory(category, language, t) {
  return t.categories[category] ?? copy[language].categories[category] ?? category;
}

export default App;
