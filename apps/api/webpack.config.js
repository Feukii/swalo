// Configuration webpack du build de production NestJS.
//
// Objectif : build TRANSPILE-ONLY. Le `nest build` par défaut ajoute
// ForkTsCheckerWebpackPlugin qui re-vérifie les types et exige tous les
// @types/* en environnement de build. Sur l'hébergeur de prod (Render),
// ces devDependencies @types ne sont pas fiablement présentes, ce qui faisait
// échouer le build (TS7016 sur express, uuid, pdfmake, nodemailer…).
//
// La vérification de types complète est déjà assurée par la CI (tsc --noEmit)
// à chaque PR. Ici on ne veut qu'émettre le JavaScript : on retire le
// type-checker du build. ts-loader reste en transpileOnly (défaut Nest).
module.exports = function (options) {
  return {
    ...options,
    plugins: (options.plugins || []).filter(
      plugin =>
        !plugin ||
        !plugin.constructor ||
        plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin'
    ),
  };
};
