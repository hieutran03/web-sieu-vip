export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "oklch(22% 0.018 176)",
        paper: "oklch(97.7% 0.009 98)",
        surface: "oklch(95.8% 0.012 112)",
        surface2: "oklch(91.4% 0.041 154)",
        line: "oklch(82% 0.022 154)",
        muted: "oklch(46% 0.028 176)",
        green: "oklch(47% 0.11 162)",
        jade: "oklch(62% 0.13 168)",
        gold: "oklch(69% 0.14 76)",
        coral: "oklch(60% 0.16 38)",
        sky: "oklch(54% 0.12 235)",
        violet: "oklch(55% 0.16 286)",
        night: "oklch(18% 0.02 176)"
      },
      boxShadow: {
        focus: "0 10px 28px rgb(23 43 38 / 0.16)",
        soft: "0 16px 48px rgb(23 43 38 / 0.08)"
      }
    }
  },
  plugins: []
};
