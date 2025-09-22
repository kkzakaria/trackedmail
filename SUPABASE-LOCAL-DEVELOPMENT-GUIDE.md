# Guide de dévéloppement local supabase

## Commandes usuels supabase cli en developpement local

- **supabase status** : vérifier le status de supabase
- **supabase start** : Démarrer supabase
- **supabase stop** : arrêter supabase
- **supabase migration new nom_migration** : Crée une nouvelle migration. Cette commande ajoutera un préfix horodaté automatiquement au nom de la migration
- **supabase migration up** : appliquer toutes les migrations localements
- **supabase migration up nom_migration** : appliquer localement une migration spécifique
- **supabase db reset** : réinitialise la base de données et applique toutes les migration localement
- **supabase functions new nom_function** : créer une nouvelle Edge Funtion
- **supabase functions serve nom_fonction** : déployer une fonction localement

## Test de Edge Fubction localement avec curl

exemple de test d'une foncton edge qui affiche "Hello ${name}" ou ${name} est une variable

### Étape 1 : générez une nouvelle fonction Edge

Créer la fonction avec la commande **supabase functions new hello-world**
Cela crée une nouvelle fonction dans supabase/functions/hello-world/index.ts

```typescript
Deno.serve(async req => {
  const { name } = await req.json();
  const data = {
    message: `Hello ${name}!`,
  };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
});
```

Cette fonction accepte une charge utile JSON avec un namechamp et renvoie un message d'accueil.

### Étape 2 : Testez votre fonction localement

supabase start # démarrer tous les services supabases
supabase functions serve hello-world # déployer la fonction localement

### Étape 4 : Envoyer une demande de test

Exécutez **supabase status** pour voir votre clé anonyme locale et d'autres informations d'identification.

```texte
curl -i --location --request POST 'http://localhost:54321/functions/v1/hello-world' \
  --header 'Authorization: Bearer SUPABASE_PUBLISHABLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"name":"Functions"}'
```

Après avoir exécuté cette commande curl, vous devriez voir :
{ "message": "Hello Functions!" }

## Sources et références

<https://supabase.com/docs/guides/local-development>
<https://supabase.com/docs/guides/functions>
