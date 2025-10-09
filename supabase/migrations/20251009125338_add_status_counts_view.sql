-- Migration: Vue simple pour comptages globaux des statuts d'emails
-- Description: Fournit les comptages globaux de chaque status pour affichage dans le dropdown de filtres
-- Performance: COUNT(*) GROUP BY est tres rapide avec index sur status

-- =====================================================
-- Vue simple pour comptages globaux de statuts
-- =====================================================
-- Calcule les comptages en temps reel (toujours a jour)
-- Utilisee pour afficher les totaux dans le dropdown de filtres de status
CREATE VIEW tracked_emails_status_counts AS
SELECT
  status,
  COUNT(*) as count
FROM tracked_emails
GROUP BY status;

-- =====================================================
-- Documentation
-- =====================================================
COMMENT ON VIEW tracked_emails_status_counts IS
  'Comptages globaux des statuts d''emails trackes en temps reel. Utilisee pour afficher les totaux dans le dropdown de filtres (ex: "En attente 45, Repondu 58"). Mise a jour automatique car c''est une vue simple.';
