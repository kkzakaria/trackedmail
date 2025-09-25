import { ComingSoonSection } from "@/components/coming-soon-section";
import { FileText } from "lucide-react";

export default function DocumentationPage() {
  return (
    <ComingSoonSection
      title="Documentations"
      description="Préparez et éditez vos fichiers pour les emails. Gérez vos pièces jointes, templates de documents et ressources partagées pour optimiser vos campagnes de relance."
      icon={<FileText size={32} />}
      features={[
        "Gestionnaire de pièces jointes",
        "Éditeur de templates",
        "Bibliothèque de documents",
        "Formats multiples supportés",
        "Prévisualisation intégrée",
        "Organisation par dossiers",
      ]}
    />
  );
}
