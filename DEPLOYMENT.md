# 🚀 Déploiement sur Vercel

Ce projet est un site statique (HTML/CSS/JS, pas de build) — Vercel le détecte automatiquement, aucune configuration spéciale n'est nécessaire à part le `vercel.json` déjà inclus (cache des fichiers JS/CSS/JSON).

## Méthode 1 — Via GitHub (recommandée, mises à jour automatiques)

1. **Pousse le projet sur GitHub** (avec ton compte `captain-francis018`) :
   ```bash
   cd aws-exam
   git init
   git add .
   git commit -m "Initial commit - AWS Cloud Practitioner training app"
   git branch -M main
   git remote add origin https://github.com/captain-francis018/aws-exam.git
   git push -u origin main
   ```

2. **Va sur [vercel.com](https://vercel.com)** et connecte-toi avec ton compte GitHub.

3. Clique **"Add New Project"** → sélectionne le repo `aws-exam`.

4. Vercel détecte automatiquement "Other" (site statique) :
   - **Build Command** : laisser vide
   - **Output Directory** : laisser vide (racine)

5. Clique **Deploy**. En ~30 secondes, tu obtiens une URL du type :
   ```
   https://aws-exam-tonpseudo.vercel.app
   ```

6. **Partage ce lien à tes camarades** — il fonctionne immédiatement, pas d'installation requise de leur côté.

7. Avantage : à chaque `git push` sur `main`, Vercel redéploie automatiquement la nouvelle version.

## Méthode 2 — Via la CLI Vercel (rapide, sans GitHub)

```bash
# Installer la CLI (une seule fois)
npm install -g vercel

# Dans le dossier du projet
cd aws-exam
vercel login          # suit le lien envoyé par email
vercel                # déploiement de test (preview)
vercel --prod         # déploiement en production -> URL définitive
```

La CLI te donne directement l'URL publique à la fin de la commande.

## Notes

- Le fichier `cloud-practitioner-02 (1).pdf` n'est pas utilisé par l'application (aucun lien dans le code) — tu peux le retirer du repo si tu veux un déploiement plus léger, ou le garder comme document de référence pour toi.
- Domaine personnalisé possible gratuitement : Vercel → Project Settings → Domains.

## ⚠️ Important : questions de simulation incomplètes

Le module "Examen Blanc" n'a actuellement que **3 questions** réelles (pas 65 comme annoncé dans le README). L'app fonctionne correctement avec ces 3 questions (timer, score, correction détaillée), mais pour un vrai examen blanc de 65 questions il faut en ajouter.

Pour ajouter des questions, ouvre `index.html` et cherche cette ligne :
```html
<script>
    window.EMBEDDED_DATA = {"qcm": [...], "simulation": [...]};
</script>
```

Ajoute des objets dans le tableau `"simulation"` en suivant ce format :
```json
{
  "id": 104,
  "domain": "S3",
  "question": "Ta question ici ?",
  "options": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
  "correct": 1,
  "explanation": "Pourquoi c'est la bonne réponse."
}
```

Pour une question à choix multiples (QRM, type "Sélectionnez DEUX réponses") :
```json
{
  "id": 105,
  "domain": "VPC",
  "question": "Ta question avec plusieurs bonnes réponses ?",
  "options": ["A", "B", "C", "D", "E"],
  "correct": [0, 2],
  "type": "multiple",
  "explanation": "Pourquoi A et C sont correctes."
}
```

Le format JSON ci-dessus est le seul nécessaire — pas besoin d'un fichier séparé, tout est directement dans `index.html`.
