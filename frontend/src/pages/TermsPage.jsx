import React from 'react'
import { Activity } from 'lucide-react'

export default function TermsPage({ onBack }) {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-semibold text-slate-900">BrainCore</span>
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
        <h1 className="text-5xl font-bold text-slate-900 mb-3">Conditions d'utilisation</h1>
        <p className="text-slate-500 text-base mb-8">Dernière mise à jour : Mars 2026</p>
        <hr className="border-slate-200 mb-12" />

        {/* Content */}
        <div className="space-y-12 text-slate-700 text-base leading-relaxed">
          {/* Intro */}
          <p>
            Bienvenue sur BrainCore (la « Plateforme »). BrainCore est une plateforme d'imagerie médicale assistée par intelligence artificielle dédiée à la segmentation automatique de l'hippocampe sur les images IRM et au recalage d'images multi-modalités. Veuillez lire attentivement ces Conditions d'utilisation (« Conditions ») avant d'accéder à la Plateforme ou de l'utiliser. En accédant à la Plateforme ou en l'utilisant, vous reconnaissez expressément que vous avez lu, compris et acceptez d'être lié par ces Conditions et notre Politique de Confidentialité. Si vous n'acceptez pas ces Conditions, veuillez ne pas accéder à la Plateforme ni l'utiliser.
          </p>

          {/* Section 1 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Éligibilité et utilisation professionnelle</h2>
            <p className="mb-4">
              L'accès à BrainCore est strictement réservé aux professionnels de santé qualifiés, notamment les médecins, neurologues, radiologues et chercheurs médicaux exerçant au sein d'une institution clinique ou de recherche agréée. En créant un compte, vous déclarez et garantissez que vous êtes un professionnel de santé agréé et que votre utilisation de la Plateforme est conforme à toutes les lois, réglementations et normes professionnelles applicables à votre exercice.
            </p>
            <p>
              BrainCore n'est pas destinée à être utilisée par le public général, les étudiants sans supervision clinique appropriée ou les personnes agissant en dehors du champ de leurs qualifications professionnelles. Toute utilisation de la Plateforme à des fins non cliniques, non professionnelles ou non autorisées est strictement interdite et peut entraîner la suspension ou la fermeture immédiate du compte.
            </p>
          </div>

          {/* Section 2 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Statut réglementaire et limitations cliniques</h2>
            <p className="mb-4">
              BrainCore est un logiciel d'aide à la décision clinique et ne constitue pas un dispositif médical au sens du Règlement (UE) 2017/745 concernant les dispositifs médicaux (MDR). Les masques de segmentation, les métriques de recalage et autres résultats générés par les modèles d'intelligence artificielle de BrainCore sont fournis uniquement à titre informatif et d'aide à la décision.
            </p>
            <p>
              Ces résultats ne constituent pas des diagnostics médicaux, des recommandations cliniques ou des prescriptions thérapeutiques. BrainCore décline expressément toute responsabilité en cas de décisions cliniques prises en fonction des résultats de la Plateforme. Le clinicien traitant conserve l'intégrité et l'exclusivité de la responsabilité concernant toutes les décisions diagnostiques et thérapeutiques prises en rapport avec les soins des patients. Les professionnels de santé utilisant BrainCore doivent vérifier indépendamment tous les résultats avant de prendre une décision clinique quelconque.
            </p>
          </div>

          {/* Section 3 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Données patients et exigences d'anonymisation</h2>
            <p className="mb-4">
              Le chargement et le traitement des données d'imagerie médicale sur BrainCore sont soumis à des exigences de conformité strictes. Vous êtes seul responsable de vous assurer que toutes les images médicales chargées sur la Plateforme ont été complètement anonymisées avant le chargement, y compris la suppression de tous les métadonnées DICOM identifiants tels que le nom du patient, la date de naissance, le numéro de dossier médical, le nom de l'établissement et toute autre information de santé protégée définie par la loi applicable.
            </p>
            <p>
              Vous devez obtenir tous les consentements et autorisations des patients requis par la loi applicable, notamment le Règlement Général sur la Protection des Données (RGPD) et la législation nationale applicable en matière de protection des données, avant de charger des données relatives aux patients. BrainCore traite les images chargées uniquement en mémoire volatile (RAM) et ne conserve pas les données d'imagerie médicale au-delà de la session active, sauf si explicitement demandé par l'utilisateur. Toute violation de ces obligations est la seule responsabilité de l'utilisateur et peut entraîner une responsabilité juridique.
            </p>
          </div>

          {/* Section 4 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Sécurité du compte et accès</h2>
            <p className="mb-4">
              Vous êtes responsable de la confidentialité de vos identifiants de compte, notamment votre adresse e-mail et votre mot de passe. Vous acceptez de notifier BrainCore immédiatement à security@braincore.com dès que vous devenez conscient d'un accès non autorisé à votre compte ou de toute autre violation de sécurité. BrainCore ne sera pas responsable des pertes ou dommages résultant de votre défaut à maintenir la confidentialité de vos identifiants.
            </p>
            <p>
              Vous ne devez pas partager votre compte avec des tiers ou permettre à des tiers d'accéder à la Plateforme à l'aide de vos identifiants. Vous ne pouvez pas utiliser le compte d'un autre utilisateur ou faire une fausse déclaration concernant votre identité. BrainCore se réserve le droit de suspendre ou de résilier tout compte qu'elle soupçonne raisonnablement d'être compromis ou utilisé en violation de ces Conditions.
            </p>
          </div>

          {/* Section 5 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Propriété intellectuelle</h2>
            <p className="mb-4">
              Tous les éléments de BrainCore, y compris notamment les modèles d'intelligence artificielle, les algorithmes de segmentation, les pipelines de recalage, les interfaces utilisateur, le code logiciel, les bases de données, la documentation et les marques commerciales, sont la propriété exclusive de BrainCore et sont protégés par les lois de la propriété intellectuelle applicables et les traités internationaux. Rien dans ces Conditions ne peut être interprété comme vous accordant une licence ou le droit d'utiliser une propriété intellectuelle de BrainCore, sauf comme expressément autorisé ici.
            </p>
            <p>
              Vous ne pouvez pas reproduire, copier, modifier, créer des travaux dérivés à partir de, rétro-concevoir, décompiler ou désassembler aucun composant de la Plateforme. Vous ne pouvez pas extraire, scraper ou autrement collecter des données de la Plateforme à des fins commerciales sans autorisation écrite préalable de BrainCore. L'accès non autorisé ou l'utilisation de tout contenu protégé par la propriété intellectuelle constitue une violation de droits d'auteur et peut vous exposer à une responsabilité pénale et civile.
            </p>
          </div>

          {/* Section 6 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Exclusion de garanties</h2>
            <p className="text-sm font-mono text-slate-600 leading-relaxed">
              LA PLATEFORME EST FOURNIE « EN L'ÉTAT » ET « TEL QUE DISPONIBLE » SANS GARANTIES D'AUCUNE SORTE, EXPRESSES OU IMPLICITES. BRAINCORE EXCLUT EXPRESSÉMENT TOUTES LES GARANTIES, Y COMPRIS NOTAMMENT LES GARANTIES IMPLICITES DE QUALITÉ MARCHANDE, D'ADÉQUATION À UN USAGE PARTICULIER ET D'ABSENCE DE CONTREFAÇON. BRAINCORE NE GARANTIT PAS QUE LA PLATEFORME SERA ININTERROMPUE, EXEMPTE D'ERREURS OU EXEMPTE DE VIRUS OU D'AUTRES COMPOSANTS NUISIBLES.
            </p>
          </div>

          {/* Section 7 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Limitation de responsabilité</h2>
            <p className="text-sm font-mono text-slate-600 leading-relaxed mb-4">
              DANS LA MESURE MAXIMALE AUTORISÉE PAR LA LOI APPLICABLE, BRAINCORE NE SHALL PAS ÊTRE RESPONSABLE DE TOUS LES DOMMAGES INDIRECTS, ACCIDENTELS, SPÉCIAUX, CONSÉCUTIFS OU PUNITIFS, Y COMPRIS NOTAMMENT LA PERTE DE DONNÉES, LA PERTE DE PROFITS OU L'INTERRUPTION D'ACTIVITÉ, DÉCOULANT DE OU EN CONNEXION AVEC VOTRE UTILISATION DE LA PLATEFORME, MÊME SI BRAINCORE A ÉTÉ AVISÉE DE LA POSSIBILITÉ DE TELS DOMMAGES.
            </p>
            <p>
              Certaines juridictions n'autorisent pas les limitations de responsabilité, cette limitation peut donc ne pas s'appliquer à vous. Dans ces cas, la responsabilité de BrainCore sera limitée dans la mesure autorisée par la loi applicable.
            </p>
          </div>

          {/* Section 8 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Modifications des Conditions</h2>
            <p>
              BrainCore se réserve le droit de modifier ces Conditions à tout moment à sa seule discrétion. Les modifications prendront effet dix (10) jours après la publication des Conditions révisées. Votre utilisation continue de la Plateforme après cette période constitue votre acceptation des Conditions modifiées. Nous notifierons les utilisateurs enregistrés des modifications matérielles via leur adresse e-mail professionnelle enregistrée. Si vous n'acceptez pas les Conditions modifiées, vous devez cesser d'utiliser la Plateforme.
            </p>
          </div>

          {/* Section 9 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Loi applicable et juridiction</h2>
            <p>
              Ces Conditions sont régies et interprétées conformément à la loi française applicable et aux réglementations de l'Union Européenne régissant la protection des données et le commerce électronique. Tout différend découlant de ou en connexion avec ces Conditions sera soumis à la juridiction exclusive des tribunaux compétents de Paris, France. Vous et BrainCore acceptez tous deux de vous soumettre à la juridiction personnelle de ces tribunaux.
            </p>
          </div>

          {/* Section 10 */}
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Contact</h2>
            <p>
              Si vous avez des questions concernant ces Conditions, veuillez nous contacter à : <a href="mailto:legal@braincore.com" className="text-blue-600 underline hover:text-blue-700">legal@braincore.com</a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <hr className="border-slate-200 my-16" />
        <div className="text-center text-sm text-slate-400">
          <p>© 2026 BrainCore. Tous droits réservés. | <a href="#" className="text-blue-600 underline hover:text-blue-700">Conditions d'utilisation</a> | <a href="#" className="text-blue-600 underline hover:text-blue-700">Politique de Confidentialité</a> | <a href="mailto:contact@braincore.com" className="text-blue-600 underline hover:text-blue-700">Contact</a></p>
        </div>
      </div>
    </div>
  )
}
