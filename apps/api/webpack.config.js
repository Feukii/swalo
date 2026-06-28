// Configuration webpack du build de production NestJS.
//
// Deux objectifs :
//
// 1) Build TRANSPILE-ONLY : on retire ForkTsCheckerWebpackPlugin. Le build par
//    défaut re-vérifie les types et exige tous les @types/* en environnement de
//    build, ce qui faisait échouer Render (TS7016 sur express, uuid, pdfmake…).
//    Le type-check complet reste assuré par la CI (tsc --noEmit) à chaque PR.
//
// 2) BUNDLER @swalo/core dans la sortie : par défaut Nest externalise tout
//    node_modules, donc l'API require `@swalo/core/...` au runtime depuis
//    packages/core/dist. Sur Render ce dist n'est pas fiablement présent au
//    runtime (gestion symlink/copie du workspace) → MODULE_NOT_FOUND sur
//    @swalo/core/dist/schemas/index.js. En bundlant @swalo/core, le code du
//    package partagé est inclus dans main.js → aucune dépendance runtime à son dist.
module.exports = function (options) {
  const isSwaloCore = request =>
    request === '@swalo/core' || request.startsWith('@swalo/core/');

  return {
    ...options,
    externals: [
      ({ request }, callback) => {
        // Bundler @swalo/core (et ses sous-chemins).
        if (request && isSwaloCore(request)) {
          return callback();
        }
        // Externaliser les autres specifiers "nus" (packages node_modules),
        // comme le fait Nest par défaut. Le reste (relatif/absolu) est bundlé.
        const isBare =
          request &&
          !request.startsWith('.') &&
          !request.startsWith('/') &&
          !/^[A-Za-z]:[\\/]/.test(request);
        if (isBare) {
          return callback(null, 'commonjs ' + request);
        }
        return callback();
      },
    ],
    plugins: (options.plugins || []).filter(
      plugin =>
        !plugin ||
        !plugin.constructor ||
        plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
    ),
  };
};
