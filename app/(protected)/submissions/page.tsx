import { ComingSoonSection } from "@/components/coming-soon-section";
import { Upload } from "lucide-react";

export default function SubmissionsPage() {
  return (
    <ComingSoonSection
      title="Soumissions"
      description="Gérez vos soumissions d'emails en toute simplicité. Importez, organisez et suivez vos campagnes de relance depuis une interface intuitive."
      icon={<Upload size={32} />}
      features={[
        "Import d'emails groupé",
        "Gestion de campagnes",
        "Templates personnalisés",
        "Planification automatique",
        "Validation des données",
        "Historique complet",
      ]}
    />
  );
}
