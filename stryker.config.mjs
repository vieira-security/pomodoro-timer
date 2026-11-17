// Testes de mutação: o Stryker introduz pequenos bugs ("mutantes") no código
// e verifica se algum teste falha. Mutante que sobrevive = teste fraco.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mjs" },
  mutate: ["public/js/core.js", "public/js/i18n.js"],
  reporters: ["clear-text", "progress", "html", "json"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  coverageAnalysis: "perTest",
  // Os poucos sobreviventes restantes são mutantes equivalentes (não mudam o comportamento),
  // ex.: tirar "bell" da lista de sons não muda nada porque valor inválido já cai no padrão "bell".
  thresholds: { high: 95, low: 90, break: 95 },
  tempDirName: ".stryker-tmp",
};
