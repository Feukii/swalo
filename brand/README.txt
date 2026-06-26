SWALO — PAQUET D'ASSETS DE MARQUE
==================================
Tous les fichiers à intégrer dans l'application, sur le web et sur les supports.
Se référer au "Guide de marque complet" (PDF) pour les règles d'usage.

ARBORESCENCE
------------
svg/          Les 5 logos vectoriels (redimensionnables à l'infini)
              - swalo_icone_marine.svg     (icône principale)
              - swalo_icone_ciel.svg       (icône sur fond sombre)
              - swalo_icone_contour.svg    (1 couleur : tampon, gravure)
              - swalo_horizontal_marine.svg (logo+nom sur marine)
              - swalo_horizontal_blanc.svg  (logo+nom sur fond clair)

png/          Mêmes logos en PNG (512px / 1024px / 1280px)

app_icons/    Icônes d'application prêtes à intégrer
              - ios_icon_*.png        (20 → 1024px, fond plein)
              - android_*dpi_*.png    (mdpi → xxxhdpi, coins arrondis)
              - android_maskable_512x512.png  (icône adaptative Android)
              - android_playstore_512x512.png (Play Store)

favicon/      Pour le site web
              - favicon.ico, favicon.svg
              - favicon_16/32/48/180/192/512.png
              - site.webmanifest      (manifeste PWA)
              - head_snippet.html     (à coller dans le <head>)

social/       Réseaux sociaux
              - profil_1080x1080.png
              - banniere_1640x624.png
              - template_post_1080x1080.png (+ .svg éditable)

tokens/       Design tokens — source unique de vérité (couleurs, typo, rayons)
              - swalo_tokens.json   (format neutre)
              - swalo_tokens.css    (variables CSS — web)
              - swalo_tokens.ts     (constantes — React / React Native)

COULEURS CLÉS
-------------
Marine   #102A43   (couleur reine)
Bleu ciel #0EA5E9  (action)
Ciel clair #38BDF8 (accent logo)
Vert #10B981 / Rouge #EF4444 / Ambre #F59E0B (sens fonctionnel strict)
