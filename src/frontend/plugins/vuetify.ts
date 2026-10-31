import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import { appearanceThemes } from "../themes";
import { initializeAppearance, useAppearanceTheme } from "../core/themeSettings";

const vuetify = createVuetify({
  components,
  directives,
  defaults: {
    VCard: { rounded: "xl" },
    VBtn: { rounded: "xl" },
    VDialog: { transition: "fade-transition" },
  },
  theme: {
    defaultTheme: useAppearanceTheme().themeId.value,
    themes: Object.fromEntries(
      Object.values(appearanceThemes).map((theme) => [
        theme.id,
        { dark: false, colors: theme.colors },
      ]),
    ),
  },
});

initializeAppearance((id) => {
  vuetify.theme.change(id);
});
export default vuetify;
