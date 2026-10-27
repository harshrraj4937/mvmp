import localFont from "next/font/local";

/** Gillu's bundled fonts (SIL OFL, licence texts alongside the files). */
export const dmSans = localFont({
  display: "swap",
  src: [
    { path: "./fonts/font-0.ttf", style: "normal", weight: "400" },
    { path: "./fonts/font-1.ttf", style: "normal", weight: "500" },
    { path: "./fonts/font-2.ttf", style: "normal", weight: "600" },
    { path: "./fonts/font-3.ttf", style: "normal", weight: "700" },
  ],
  variable: "--font-dm-sans",
});

export const fraunces = localFont({
  display: "swap",
  src: [
    { path: "./fonts/font-4.ttf", style: "italic", weight: "400" },
    { path: "./fonts/font-5.ttf", style: "italic", weight: "500" },
    { path: "./fonts/font-6.ttf", style: "normal", weight: "400" },
    { path: "./fonts/font-7.ttf", style: "normal", weight: "500" },
    { path: "./fonts/font-8.ttf", style: "normal", weight: "600" },
  ],
  variable: "--font-fraunces",
});
