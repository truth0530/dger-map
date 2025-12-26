import type { Config } from "tailwindcss";
import path from "path";

const config: Config = {
  content: [
    path.join(process.cwd(), "src/pages/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(process.cwd(), "src/components/**/*.{js,ts,jsx,tsx,mdx}"),
    path.join(process.cwd(), "src/app/**/*.{js,ts,jsx,tsx,mdx}"),
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
