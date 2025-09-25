import { ComingSoonSection } from "@/components/coming-soon-section";
import { BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <ComingSoonSection
      title="Analyses"
      description="Découvrez des insights détaillés sur vos campagnes de relance. Analysez les performances, les taux de réponse et optimisez votre stratégie email."
      icon={<BarChart3 size={32} />}
      features={[
        "Tableaux de bord interactifs",
        "Taux de réponse détaillés",
        "Analyses temporelles",
        "Rapports personnalisés",
        "Comparaisons de campagnes",
        "Export des données",
      ]}
    />
  );
}
