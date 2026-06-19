# Share Files

Petite app web pour déposer un fichier et obtenir un lien de téléchargement direct, exploitable par un agent IA via `curl`.

## Fonctionnement

- Page web (`/`) avec un formulaire pour uploader un fichier et choisir une durée de validité (1h, 24h, 3j, 7j).
- L'upload renvoie un lien du type `https://votre-domaine/files/<id>`.
- Ce lien est téléchargeable directement avec `curl -O -J <lien>`.
- Le lien expire automatiquement après la durée choisie (le fichier est alors supprimé du disque).

## Lancer en local

```bash
npm install
npm start
```

L'app écoute sur le port `3000` (configurable via `PORT`).

## Déploiement avec Docker

```bash
docker compose up -d --build
```

Le service écoute sur le port `3000` de l'hôte. Les fichiers sont persistés dans un volume Docker nommé `share-files-uploads`.

### Variables d'environnement

| Variable            | Défaut | Description                                      |
|---------------------|--------|---------------------------------------------------|
| `PORT`              | 3000   | Port d'écoute du serveur                          |
| `DEFAULT_TTL_HOURS`  | 24     | Durée de validité par défaut des liens (heures)   |
| `MAX_TTL_HOURS`      | 168    | Durée de validité maximale autorisée (heures)     |
| `PUBLIC_BASE_URL`    | (vide) | URL publique à utiliser dans les liens générés (ex: `https://files.mondomaine.fr`). Si vide, déduite de la requête. |

Pour un déploiement derrière un reverse proxy (Nginx, Traefik...) avec un nom de domaine, configurez `PUBLIC_BASE_URL` pour que les liens générés soient corrects (et pensez à servir l'app en HTTPS).

## Utilisation par un agent IA

Après l'upload, l'app renvoie une commande prête à l'emploi, par exemple :

```bash
curl -O -J https://votre-domaine/files/3f9c2e1a-...
```

`-J` utilise le nom de fichier d'origine, `-O` l'écrit sur disque.
