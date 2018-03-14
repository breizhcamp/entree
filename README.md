Scan des billets
================

Cette application permet de scanner les billets des participants ainsi que de rechercher
dans les billets vendus.
Une fois le billet identifié, l'application affiche le bureau auquel récupérer son badge.

API
---
```
POST /s
{s: "recherche"}
```

recherche :
 * soit une partie du nom, du prénom, de la société ou de l'email
 * soit le contenu du QR Code (numéro sur 7 car) ou du code-barre (11 num + 1 num de checkum)
 
Réponse : Un tableau contenant les objets suivants :

```javascript
[{
	id: "Identifiant du billet (ex: T123-5487-E35210)",
	barcode: "Code barre (ex: 1234567)",
	nom: "Nom du participant",
	prenom: "Prenom du participant",
	mail: "Adresse e-mail du participant",
	societe: "Société du participant si définie",
	type: "Type du billet (ex: Conférences (jeudi et vendredi))",
	days: ["2018-03-29", "2018-03-30"], //jours de la conférence auquel le participant a accès
	desk: "Lettre du bureau où récupérer son badge (ex: B)",
	checkin: "Date d'enregistrement de la personne, s'affiche donc si le badge a déjà été scanné (ex: 2018-03-28T10:01:01)"
}]
```

Si l'appel ne retourne qu'une seule occurence dans le tableau, le billet est automatiquement validé 
et envoyé sur les écrans de contrôle.

```
POST /checkin
{id: "identifiant du billet"}
```

Permet de valider un billet et de l'envoyer sur les écrans de contrôle

```
DELETE /checkin
{id: "identifiant du billet"}
```

Permet de dévalider un billet et l'enlève des écrans de contrôle
