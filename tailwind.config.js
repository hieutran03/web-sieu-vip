export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "oklch(20% 0.022 176)",
        paper: "oklch(98% 0.012 91)",
        surface: "oklch(95.5% 0.017 110)",
        surface2: "oklch(90.5% 0.038 154)",
        line: "oklch(77% 0.026 154)",
        muted: "oklch(42% 0.032 176)",
        green: "oklch(39% 0.12 164)",
        jade: "oklch(58% 0.13 168)",
        gold: "oklch(66% 0.14 76)",
        coral: "oklch(57% 0.16 38)",
        sky: "oklch(50% 0.12 235)",
        violet: "oklch(52% 0.16 286)",
        night: "oklch(16% 0.024 176)"
      },
      boxShadow: {
        focus: "0 10px 28px rgb(23 43 38 / 0.16)",
        soft: "0 16px 48px rgb(23 43 38 / 0.08)"
      }
    }
  },
  plugins: []
};
