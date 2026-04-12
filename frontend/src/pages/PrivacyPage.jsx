import React from 'react'
import { Activity } from 'lucide-react'

export default function PrivacyPage({ onBack }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-900">NeuroScan</span>
          </div>
          <button
            onClick={onBack}
            className="text-slate-500 hover:text-slate-700 font-normal text-sm transition-colors"
          >
            ← Retour
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Title Section */}
        <h1 className="text-5xl font-bold text-slate-900 mb-3">Politique de Confidentialité</h1>
        <p className="text-slate-500 text-base mb-8">Dernière mise à jour : Mars 2026</p>
        <hr className="border-slate-200 mb-12" />

        {/* Content */}
        <div className="space-y-12 text-slate-700 text-base leading-relaxed">
          {/* Intro */}
          <p>
            Cette Politique de Confidentialité décrit comment NeuroScan (« nous », « notre » ou « NeuroScan ») collecte, utilise, divulgue et protège les informations vous concernant lorsque vous utilisez la plateforme NeuroScan (la « Plateforme »). Cette Politique s'applique à tous les utilisateurs de la Plateforme, notamment les professionnels de santé enregistrés et les chercheurs autorisés. Nous nous engageons à protéger votre vie privée et à traiter vos données personnelles conformément à la législation applicable en matière de protection des données, notamment le Règlement Général sur la Protection des Données (UE) 2016/679 (« RGPD ») et les lois nationales applicables en matière de protection des données.
          </p>

          {/* Section 1 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Responsable du traitement</h2>
            <p>
              NeuroScan SAS (SIRET : 12345678901234), située à 123 Rue de la Médecine, 75001 Paris, France, est le responsable du traitement responsable du traitement de vos données personnelles en vertu du RGPD. Notre Délégué à la Protection des Données peut être contacté à <a href="mailto:dpo@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">dpo@neuroscan.com</a>. Nous nous engageons à répondre à toutes les demandes d'exercice des droits des personnes concernées et aux demandes de renseignements relatifs à la confidentialité dans un délai de 72 heures ouvrables.
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Informations que nous collectons</h2>
            <p className="mb-6">
              Nous collectons les catégories de données personnelles suivantes :
            </p>
            <div className="overflow-x-auto mb-6">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Catégorie</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Éléments de données</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Finalité</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Base légale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Données de compte</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Nom, prénom, titre professionnel, spécialité, affiliation hospitalière, e-mail professionnel</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Création et authentification du compte</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Exécution du contrat (Art. 6.1.b RGPD)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Données d'utilisation</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Horodatages de connexion, historique d'analyse, durée de session, utilisation des fonctionnalités</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Sécurité et amélioration des services</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Intérêts légitimes (Art. 6.1.f RGPD)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Images médicales</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Images IRM chargées pour segmentation ou recalage</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Traitement IA et génération de résultats</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Consentement explicite (Art. 6.1.a RGPD)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Données techniques</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Adresse IP, type de navigateur, informations sur l'appareil, en-têtes HTTP</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Surveillance de la sécurité</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Intérêts légitimes (Art. 6.1.f RGPD)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Traitement des images médicales</h2>
            <p>
              Les données d'imagerie médicale chargées sur NeuroScan bénéficient d'un traitement spécialisé garantissant une confidentialité et une sécurité maximales. Toutes les images sont traitées exclusivement en mémoire volatile (RAM) et ne sont jamais écrites dans le stockage persistant (disque dur) sauf s'il est explicitement demandé par l'utilisateur via une action de sauvegarde. Les images chargées sont automatiquement converties en format NIfTI (.nii.gz) pour un traitement optimisé de l'intelligence artificielle et sont garanties d'être complètement supprimées à la fin de chaque session active, sans traces subsistant sur nos serveurs. Nous n'utilisons pas les images médicales chargées pour le réentraînement du modèle, l'amélioration d'algorithmes ou toute autre utilisation secondaire sans obtenir votre consentement écrit explicite et séparé. Tous les traitements des images médicales sont effectués en pleine conformité avec l'Article 9 du RGPD concernant les catégories spéciales de données et les réglementations nationales applicables en matière de protection des données médicales.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Conservation des données</h2>
            <p className="mb-6">
              Nous conservons vos données personnelles pour la période nécessaire aux fins énoncées dans cette Politique ou selon les exigences légales :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Catégorie de données</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Période de conservation</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Base légale</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Données de compte</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Durée du compte + 30 jours après fermeture</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Contrat</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Images médicales</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Fin de la session active (max 24 heures)</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Consentement</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Journaux de sécurité</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">12 mois glissants</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Obligation légale (sécurité)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Dossiers de facturation</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">5 ans</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Obligation légale (comptabilité)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Mesures de sécurité technique et organisationnelle</h2>
            <p className="mb-4">
              NeuroScan met en œuvre des mesures de sécurité technique et organisationnelle complètes pour protéger vos données personnelles contre l'accès non autorisé, la modification, la divulgation ou la destruction :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Mesure de sécurité</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Implémentation</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Chiffrement en transit</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">TLS 1.3 avec confidentialité persistante ; protocoles obsolètes désactivés</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Chiffrement au repos</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">AES-256-GCM avec gestion sécurisée des clés</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Authentification</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Tokens JWT RS256 avec courte expiration ; MFA obligatoire</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Stockage des mots de passe</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Hachage bcrypt avec coefficient de coût 12</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Contrôle d'accès</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Contrôle d'accès basé sur les rôles (RBAC) avec principe du moindre privilège</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Surveillance de la sécurité</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Enregistrement des accès en temps réel et détection des anomalies</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Accès de tiers</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Strictement interdit sans Accord de Traitement des Données signé</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Vos droits en vertu du RGPD</h2>
            <p className="mb-6">
              Vous disposez des droits suivants concernant vos données personnelles, qui peuvent être exercés en contactant notre Délégué à la Protection des Données :
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Droit</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Description</th>
                    <th className="bg-slate-50 text-left px-4 py-3 font-semibold text-slate-700 border border-slate-300">Comment l'exercer</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit d'accès</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Obtenir une copie de vos données personnelles et des informations sur leur traitement</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">E-mail <a href="mailto:privacy@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">privacy@neuroscan.com</a></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit de rectification</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Corriger les données personnelles inexactes ou incomplètes</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Via les paramètres du compte ou par e-mail à <a href="mailto:privacy@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">privacy@neuroscan.com</a></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit à l'effacement</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Demander la suppression de votre compte et des données associées</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">E-mail <a href="mailto:privacy@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">privacy@neuroscan.com</a></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit à la portabilité</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Recevoir vos données au format JSON/CSV pour transfert à un autre responsable</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">E-mail <a href="mailto:privacy@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">privacy@neuroscan.com</a></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit d'opposition</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Vous opposer à certaines activités de traitement basées sur les intérêts légitimes</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">E-mail <a href="mailto:privacy@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">privacy@neuroscan.com</a></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top font-medium">Droit de plainte</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">Déposer une plainte auprès de votre autorité nationale de protection des données</td>
                    <td className="px-4 py-3 text-slate-600 border border-slate-300 align-top">CNIL (France) ou autorité équivalente dans votre juridiction</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Cookies et technologies de suivi</h2>
            <p>
              NeuroScan utilise uniquement des cookies techniques strictement nécessaires pour maintenir votre session authentifiée et assurer la fonctionnalité de la plateforme. Nous n'utilisons pas de cookies publicitaires, de cookies d'analyse ou de technologies de suivi tiers. Tous les cookies de session sont chiffrés, ont les drapeaux sécurisé et HTTP-only activés et expirent à la fin de la session. Nous ne vendons, ne partageons et ne commercialisons pas les données de cookies avec un tiers.
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Modifications de cette Politique de Confidentialité</h2>
            <p>
              Nous pouvons mettre à jour cette Politique de Confidentialité de temps à autre pour refléter les changements dans nos pratiques ou la loi applicable. Nous vous notifierons de tout changement matériel en affichant la Politique mise à jour sur la Plateforme et en indiquant la date d'entrée en vigueur en haut de ce document. Votre utilisation continue de la Plateforme après ces modifications constitue votre acceptation de la Politique de Confidentialité mise à jour.
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Contact et Délégué à la Protection des Données</h2>
            <p>
              Pour toute demande liée à la confidentialité ou pour exercer vos droits en vertu du RGPD, veuillez contacter notre Délégué à la Protection des Données à <a href="mailto:dpo@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">dpo@neuroscan.com</a>. Nous nous engageons à répondre à toutes les demandes dans un délai de 72 heures ouvrables. Vous pouvez également contacter notre département juridique général à <a href="mailto:legal@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">legal@neuroscan.com</a> pour les demandes non liées à la confidentialité.
            </p>
          </div>
        </div>

        {/* Footer */}
        <hr className="border-slate-200 my-16" />
        <div className="text-center text-sm text-slate-400">
          <p>© 2026 NeuroScan. Tous droits réservés. | <a href="#" className="text-blue-600 underline hover:text-blue-700">Conditions d'utilisation</a> | <a href="#" className="text-blue-600 underline hover:text-blue-700">Politique de Confidentialité</a> | <a href="mailto:contact@neuroscan.com" className="text-blue-600 underline hover:text-blue-700">Contact</a></p>
        </div>
      </div>
    </div>
  )
}
