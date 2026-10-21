import localFont from "next/font/local";

// Same faces as ownitsocial.com, self-hosted so builds don't depend on Google Fonts.
export const archivo = localFont({
  src: [
    { path: "../../assets/fonts/Archivo-700.ttf", weight: "700" },
    { path: "../../assets/fonts/Archivo-900.ttf", weight: "900" },
  ],
  variable: "--font-archivo",
  display: "swap",
});

export const montserrat = localFont({
  src: [
    { path: "../../assets/fonts/Montserrat-Regular.ttf", weight: "400" },
    { path: "../../assets/fonts/Montserrat-Medium.ttf", weight: "500" },
    { path: "../../assets/fonts/Montserrat-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-montserrat",
  display: "swap",
});
