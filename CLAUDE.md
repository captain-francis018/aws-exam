# CLAUDE.md

Ce fichier donne le contexte du projet à Claude Code. Lis-le avant toute modification.

## Vue d'ensemble

Application web statique (sans build, sans framework) qui prépare à l'examen AWS Certified Cloud Practitioner (CLF-C02) : cours par module, QCM de pratique, et examen blanc chronométré de 65 questions. Destinée à des camarades de formation à Orange Digital Center (Dakar), hébergée sur Vercel.

**Stack** : HTML/CSS/JS vanilla + Tailwind CDN (utilitaire seulement, pas de build step). Aucun framework, aucun bundler, aucune dépendance npm en production.

## Architecture — à comprendre avant de toucher au code

C'est le point le plus important du projet : **tout le contenu est pré-rendu et statique, il n'y a aucune génération HTML au runtime et aucun `fetch()`.**

- `index.html` contient les 8 onglets (`<div class="tab-section" id="section-XXX">`) déjà remplis avec leur HTML final, empilés les uns sous les autres et cachés/affichés en CSS (`display:none`/`block`).
- Changer d'onglet = `loadContent(tabId)` dans `app.js` bascule juste le `display`, **ne régénère rien**. C'est volontaire : une version précédente générait le HTML en JS à chaque clic, ce qui causait des lenteurs et des plantages silencieux (voir section Historique).
- Les données des questions (QCM + examen) sont embarquées directement dans `index.html` :
  ```html
  <script>
      window.EMBEDDED_DATA = {"qcm": [...], "simulation": [...]};
  </script>
  ```
  Pas de fichier `.json` séparé, pas de `fetch`. C'est lu une fois dans `app.js` au chargement (`let quizData = window.EMBEDDED_DATA.qcm;`).

**Conséquence pratique** : pour modifier du contenu de cours (Module 1 à 4, Comparaisons), il faut éditer le HTML directement dans `index.html` à l'intérieur du bon `<div class="tab-section" id="section-moduleX">`. Il n'y a pas de template séparé à éditer puis recompiler.

**Pour modifier les questions**, éditer le JSON inline dans `window.EMBEDDED_DATA` (chercher cette chaîne dans `index.html`). Format d'une question :

```json
{
  "id": 166,
  "domain": "S3",
  "question": "Texte de la question ?",
  "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "correct": 1,
  "explanation": "Pourquoi B est la bonne réponse.",
  "difficulty": "moyen",
  "scenario": false
}
```

- `correct` : un entier (QCM simple) ou un tableau d'entiers pour une question à choix multiples (`"type": "multiple"` doit alors être ajouté).
- `difficulty` : `"facile"` / `"moyen"` / `"difficile"` — utilisé par le sélecteur de niveau dans l'examen blanc.
- `scenario` : `true` place la question en toute fin d'examen, après un séparateur visuel. Réservé aux questions à mise en situation complexe.
- Les IDs doivent rester uniques dans tout le tableau `simulation` (convention actuelle : 101-103 = scénarios originaux, 144-165 = questions rédigées pour couvrir les lacunes, 201-240 = questions du QCM réutilisées avec +200 sur leur ID d'origine).

## Fichiers du projet

| Fichier | Rôle |
|---|---|
| `index.html` | Tout le contenu : 8 onglets pré-rendus + données embarquées (`EMBEDDED_DATA`) |
| `app.js` | Logique : navigation, QCM, moteur d'examen (timer, filtrage difficulté, scoring, révision) |
| `styles.css` | CSS custom (le gros du style). Tailwind n'est utilisé que pour le sélecteur de difficulté et le filtre de révision — ne pas migrer le reste sans bonne raison, le CSS custom est volumineux et fonctionnel |
| `vercel.json` | Headers de cache pour le déploiement |
| `LANCER_APPLICATION.bat` | Double-clic Windows pour ouvrir `index.html` en local (fonctionne nativement, pas de serveur requis grâce à l'architecture sans `fetch`) |
| `DEPLOYMENT.md` | Guide de déploiement Vercel (GitHub ou CLI) |
| `cloud-practitioner-02 (1).pdf` | Support de cours source, non lié au code, gardé pour référence |

## Commandes utiles

Pas de build, pas de `npm install` nécessaire pour faire tourner l'app. Pour tester en local :

```bash
# Option simple : ouvrir directement (fonctionne, zéro dépendance réseau)
open index.html  # ou double-clic / LANCER_APPLICATION.bat sous Windows

# Option serveur local (utile pour simuler le comportement Vercel)
python3 -m http.server 8000
```

Vérification de syntaxe JS avant tout commit :
```bash
node --check app.js
```

Pas de suite de tests automatisée formelle dans le repo. Pour valider une modification de `index.html`/`app.js`, le réflexe utilisé pendant le développement est un test jsdom rapide en ligne de commande (charger la page, simuler des clics, vérifier le DOM résultant) — utile en particulier après une modification du moteur d'examen.

## Pièges connus / historique des bugs

Ces bugs ont déjà été corrigés mais le risque de régression existe si on retouche les zones concernées :

1. **`generateEC2Content`** (contenu Module 3, section EC2) : une des catégories d'instances dans les données source a un champ `hardware` au lieu de `characteristics`. Le code fait `cat.characteristics || cat.hardware || []` — ne pas régresser ce fallback, sinon le module replante silencieusement (spinner infini, perçu comme "lenteur").
2. **Pas de fallback réseau requis** : ne jamais réintroduire de `fetch()` vers un fichier JSON externe pour le contenu de cours ou les questions — c'est ce qui causait des erreurs CORS quand l'app était ouverte en `file://` directement (cas d'usage réel : des camarades ouvrent le fichier sans serveur).
3. **`scrollIntoView` est appelé avec `?.()`** (optional chaining) dans `app.js` — gardé ainsi car non supporté dans certains environnements de test ; sans impact en navigateur réel, mais ne pas retirer le `?.` sans vérifier.
4. **Distracteurs de QCM** : éviter que la bonne réponse soit systématiquement la plus longue/détaillée des 4 options, et éviter les distracteurs absurdes ("Désactiver CloudTrail pour le compte root" etc.) — ça rend les réponses devinables sans connaître le sujet. Les options doivent être de longueur et de ton comparables.

## Conventions de contenu

- Tout le texte UI est en **français**.
- L'examen CLF-C02 (édition en vigueur) a 4 domaines pondérés : Cloud Concepts 24%, Sécurité 30%, Technologie 34%, Facturation 12% — toute nouvelle question doit avoir un `domain` cohérent avec un de ces axes, et la répartition globale des questions doit rester globalement alignée sur ces poids si on en ajoute beaucoup.
- Couleurs de marque utilisées dans `styles.css` : orange AWS `#FF9900` (`--primary-color`), bleu marine AWS `#232F3E` (`--secondary-color`).
- Le design custom (cartes, badges, tableaux comparatifs) suit des classes déjà définies dans `styles.css` (`.module-card`, `.detail-box`, `.tip-box`, `.warning-box`, `.info-box`, `.comparison-table`, `.difficulty-badge`, `.scenario-badge`) — réutiliser ces classes plutôt qu'en créer de nouvelles pour rester cohérent visuellement.

## Déploiement

Vercel, site statique, aucune configuration de build. Voir `DEPLOYMENT.md` pour le détail (push GitHub + import Vercel, ou `vercel --prod` en CLI). Le `vercel.json` gère uniquement les en-têtes de cache HTTP.
