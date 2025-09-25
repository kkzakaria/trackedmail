# Email Editor - Architecture Modulaire

Ce dossier contient la refactorisation modulaire du composant EmailEditor, décomposé en composants plus petits et maintenables.

## Structure du Dossier

```
email-editor/
├── components/           # Composants UI réutilisables
│   ├── attachment-manager.tsx     # Gestion des pièces jointes
│   ├── color-palette.tsx          # Palette de couleurs réutilisable
│   ├── email-recipient-fields.tsx # Champs destinataires (À, Cc, Cci)
│   ├── formatting-toolbar.tsx     # Barre d'outils de formatage complète
│   ├── rich-text-editor.tsx      # Éditeur de contenu riche
│   └── toolbar-button.tsx        # Bouton standardisé pour la toolbar
├── hooks/               # Hooks personnalisés
│   ├── use-attachments.ts        # Gestion des fichiers et miniatures
│   ├── use-email-form.ts         # États du formulaire et validation
│   ├── use-keyboard-shortcuts.ts # Raccourcis clavier
│   └── use-text-formatting.ts   # Commandes de formatage de texte
├── types/               # Définitions TypeScript
│   └── index.ts         # Types partagés (EmailFormData, TextFormattingState, etc.)
├── utils/               # Utilitaires
│   └── file-helpers.tsx # Helpers pour les fichiers (icônes, tailles)
├── index.ts            # Point d'entrée avec exports
└── README.md           # Cette documentation
```

## Composants

### EmailRecipientFields

- **Responsabilité** : Champs destinataires (À, Cc, Cci) et sujet
- **Props** : États des champs + callbacks de mise à jour
- **Fonctionnalités** : Affichage conditionnel Cc/Cci, validation

### FormattingToolbar

- **Responsabilité** : Barre d'outils complète de formatage de texte
- **Props** : État du formatage + callbacks d'actions
- **Fonctionnalités** : Formatage riche, couleurs, alignement, listes, insertion

### AttachmentManager

- **Responsabilité** : Affichage et gestion des pièces jointes
- **Props** : Liste des fichiers + callbacks de suppression
- **Fonctionnalités** : Miniatures, icônes par type, taille des fichiers

### RichTextEditor

- **Responsabilité** : Zone d'édition de contenu avec contentEditable
- **Props** : Contenu + callback de changement
- **Fonctionnalités** : Édition riche, placeholder, ref forwarding

### ColorPalette

- **Responsabilité** : Palette de couleurs réutilisable
- **Props** : Type (text/highlight) + callback de sélection
- **Fonctionnalités** : Couleurs prédéfinies + sélecteur personnalisé

### ToolbarButton

- **Responsabilité** : Bouton standardisé avec tooltip
- **Props** : Icône, tooltip, action, état actif
- **Fonctionnalités** : Apparence cohérente, accessibilité

## Hooks

### useEmailForm

- **Responsabilité** : Gestion des états du formulaire email
- **Exports** : `formState`, `updateField`, `toggleCc/Bcc`, `resetForm`, `getFormData`
- **Fonctionnalités** : État centralisé, validation, reset

### useTextFormatting

- **Responsabilité** : Commandes de formatage de texte riche
- **Exports** : `formatting`, `editorRef`, fonctions de formatage
- **Fonctionnalités** : Couleurs, alignement, titres, formats, liens

### useAttachments

- **Responsabilité** : Gestion des fichiers et miniatures
- **Exports** : `attachments`, `attachmentPreviews`, fonctions de gestion
- **Fonctionnalités** : Upload, miniatures, validation, suppression

### useKeyboardShortcuts

- **Responsabilité** : Raccourcis clavier pour l'éditeur
- **Exports** : `editorRef` (pour synchronisation)
- **Fonctionnalités** : Ctrl+B/I/U/Z, Tab, détection sélection

## Types

### EmailFormData & EmailFormState

```typescript
interface EmailFormData {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  content: string;
}

interface EmailFormState extends EmailFormData {
  showCc: boolean;
  showBcc: boolean;
}
```

### TextFormattingState

```typescript
interface TextFormattingState {
  currentTextColor: string;
  currentHighlightColor: string;
  currentAlignment: "left" | "center" | "right" | "justify";
  currentStyle: "normal" | "<h1>" | "<h2>" | "<h3>";
}
```

### AttachmentState

```typescript
interface AttachmentState {
  attachments: File[];
  attachmentPreviews: { [key: string]: string };
}
```

## Avantages de la Refactorisation

### ✅ Maintenabilité

- **Séparation des responsabilités** : Chaque composant a un rôle spécifique
- **Réutilisabilité** : ColorPalette, ToolbarButton utilisables ailleurs
- **Testabilité** : Hooks et composants isolés, plus faciles à tester

### ✅ Performance

- **Re-renders optimisés** : Hooks séparés limitent les mises à jour
- **Lazy loading possible** : Composants peuvent être importés à la demande
- **Memoization** : Callbacks wrappés dans useCallback

### ✅ Developer Experience

- **TypeScript strict** : Types explicites pour toutes les interfaces
- **Auto-complétion** : Meilleure expérience IDE avec types séparés
- **Debugging facilité** : Stack traces plus claires avec noms explicites

### ✅ Code Quality

- **Réduction de 1079 → ~150 lignes** pour le composant principal
- **Single Responsibility Principle** respecté
- **Patterns consistants** : Hooks + composants controlés

## Migration depuis l'Ancien Code

L'ancien composant monolithique de 1079 lignes a été décomposé en :

- **6 composants** réutilisables
- **4 hooks personnalisés** avec logique métier
- **Types explicictes** pour la sécurité TypeScript
- **Utilitaires** pour la réutilisabilité

Toutes les fonctionnalités sont préservées à 100%, avec une architecture plus maintenable et évolutive.

## Usage

```typescript
import { EmailEditor } from "@/components/email-editor";

// Utilisation directe - l'API publique reste identique
<EmailEditor />

// Ou utilisation des composants individuels
import {
  EmailRecipientFields,
  FormattingToolbar,
  useEmailForm,
  useTextFormatting
} from "@/components/email-editor";
```
