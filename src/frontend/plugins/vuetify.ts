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
          background: "#f6f1e8",
          surface: "#fffaf1",
          primary: "#5d7f78",
          secondary: "#8b7bb8",
          accent: "#d89a72",
          error: "#b85c5c",
          info: "#6f8fa8",
          success: "#6f9b7a",
          warning: "#c49a4a"
        }
      }
    }
  }
});
