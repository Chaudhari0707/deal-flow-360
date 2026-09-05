import maxFileLines from "./max-file-lines";
import noExportedTypesInSource from "./no-exported-types-in-source";
import noNodejsImports from "./no-nodejs-imports";
import noNodejsInClient from "./no-nodejs-in-client";
import preferSrcAlias from "./prefer-src-alias";
import requireLiveFormValidation from "./require-live-form-validation";
import sortTypesAndKeys from "./sort-types-and-keys";
import tailwindCanonicalClasses from "./tailwind-canonical-classes";

const plugin = {
  meta: {
    name: "local",
  },
  rules: {
    "max-file-lines": maxFileLines,
    "no-exported-types-in-source": noExportedTypesInSource,
    "no-nodejs-in-client": noNodejsInClient,
    "no-nodejs-imports": noNodejsImports,
    "prefer-src-alias": preferSrcAlias,
    "require-live-form-validation": requireLiveFormValidation,
    "sort-types-and-keys": sortTypesAndKeys,
    "tailwind-canonical-classes": tailwindCanonicalClasses,
  },
};

export default plugin;
