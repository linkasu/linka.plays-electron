import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

export default createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "linkaLight",
    themes: {
      linkaLight: {
        dark: false,
        colors: {
          background: "#fbf7ef",
          surface: "#ffffff",
          primary: "#6c5ce7",
          secondary: "#00a8a8",
          accent: "#ff8a3d",
          error: "#d7263d"
        }
      }
    }
  }
});
