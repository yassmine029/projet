import React, { useEffect, useState } from 'react';
import Sidebar from '../components/Sidebar';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Hash, Calendar, Mail, Phone, FileImage, CheckCircle, AlertTriangle, Edit, Trash2, Lock } from 'lucide-react';

// Dummy fetch function (replace with real API call)
const fetchPatient = async (id) => {
	// Simulate API
	return {
		id,
		nom: 'Dupont',
		prenom: 'Marie',
		num_dossier: 'DOS-2024-0013',
		created_at: '2024-03-01',
		date_naissance: '1972-06-15',
		sexe: 'Féminin',
		telephone: '0612345678',
		email: 'marie.dupont@hopital.com',
		pathologie: 'Alzheimer',
		stade: 'Modéré',
		antecedents: 'Oui',
		notes: 'Patiente suivie pour troubles mnésiques évolutifs.',
		anonymisation: true,
		mri_files: [
			{ name: 'IRM_T1_2024.nii.gz', format: '.nii.gz', uploaded: '2024-03-02' },
			{ name: 'IRM_T1_2023.dcm', format: '.dcm', uploaded: '2023-12-10' },
		],
		analyses: [],
	};
};

const BADGE_COLORS = {
	'Alzheimer': 'bg-blue-100 text-blue-700',
	'Épilepsie': 'bg-pink-100 text-pink-700',
	'Autre': 'bg-slate-100 text-slate-700',
	'Non défini': 'bg-slate-100 text-slate-400',
	'Précoce': 'bg-green-100 text-green-700',
	'Modéré': 'bg-yellow-100 text-yellow-700',
	'Avancé': 'bg-red-100 text-red-700',
};

function initials(nom, prenom) {
	return `${(prenom?.[0]||'').toUpperCase()}${(nom?.[0]||'').toUpperCase()}`;
}

function calcAge(dob) {
	if (!dob) return '?';
	const d = new Date(dob);
	const diff = Date.now() - d.getTime();
	const age = new Date(diff).getUTCFullYear() - 1970;
	return age;
}

export default function PatientProfile() {
	const { id } = useParams();
	const navigate = useNavigate();
	const [patient, setPatient] = useState(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		setLoading(true);
		fetchPatient(id).then(p => { setPatient(p); setLoading(false); });
	}, [id]);

	if (loading) return <div className="p-10 text-center text-[#6b7280]">Chargement du profil patient...</div>;
	if (!patient) return <div className="p-10 text-center text-red-600">Patient introuvable.</div>;

	return (
		<div className="flex min-h-screen bg-[#f8fafc]">
			<Sidebar />
			<main className="flex-1 ml-64 px-0 md:px-12 py-10">
				<div className="max-w-4xl mx-auto space-y-8">
					{/* Header */}
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 p-8">
						<div className="flex items-center gap-6">
							<div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-white text-3xl font-extrabold shadow-sm border-4 border-blue-100">
								{initials(patient.nom, patient.prenom)}
							</div>
							<div>
								<div className="flex items-center gap-3 mb-2">
									<h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{patient.nom} {patient.prenom}</h1>
									<span className="px-3 py-1 rounded-lg bg-blue-50 text-blue-600 text-xs font-bold tracking-wide">{patient.num_dossier}</span>
								</div>
								<div className="flex items-center gap-2 text-[#6b7280] text-sm font-medium">
									<Calendar className="w-4 h-4" />
									Inscrit le {new Date(patient.created_at).toLocaleDateString()}<span className="mx-2 text-slate-300">•</span>
									{calcAge(patient.date_naissance)} ans
								</div>
							</div>
						</div>
						<div className="flex gap-3 mt-4 md:mt-0">
							<button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-[#6b7280] border border-slate-200 hover:bg-slate-100 transition-colors">
								<Edit className="w-4 h-4" /> Modifier
							</button>
							<button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors">
								<Trash2 className="w-4 h-4" /> Supprimer
							</button>
						</div>
					</div>

					{/* Info Cards */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						{/* Card 1: Personal */}
						<div className="bg-white rounded-2xl border border-slate-50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 space-y-4">
							<h2 className="text-base font-bold text-slate-900 mb-4">Informations personnelles</h2>
							<div className="flex items-center gap-3 text-sm"><User className="w-4 h-4 text-blue-600" /> {patient.nom} {patient.prenom}</div>
							<div className="flex items-center gap-3 text-sm"><Calendar className="w-4 h-4 text-blue-600" /> {new Date(patient.date_naissance).toLocaleDateString()}</div>
							<div className="flex items-center gap-3 text-sm"><span className={`px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold`}>{patient.sexe}</span></div>
							<div className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 text-blue-600" /> {patient.telephone || <span className="text-slate-400">—</span>}</div>
							<div className="flex items-center gap-3 text-sm"><Mail className="w-4 h-4 text-blue-600" /> {patient.email || <span className="text-slate-400">—</span>}</div>
						</div>
						{/* Card 2: Medical */}
						<div className="bg-white rounded-2xl border border-slate-50 shadow-[0_4px_24px_rgba(0,0,0,0.04)] p-6 space-y-4">
							<h2 className="text-base font-bold text-slate-900 mb-4">Informations médicales</h2>
							<div className="flex items-center gap-3 text-sm">
								<span className={`px-2 py-1 rounded font-bold text-xs ${BADGE_COLORS[patient.pathologie] || 'bg-slate-100 text-slate-700'}`}>{patient.pathologie}</span>
								<span className={`px-2 py-1 rounded font-bold text-xs ${BADGE_COLORS[patient.stade] || 'bg-slate-100 text-slate-700'}`}>{patient.stade}</span>
							</div>
							<div className="flex items-center gap-3 text-sm">
								<span className="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Antécédents familiaux : {patient.antecedents}</span>
							</div>
							<div className="flex items-center gap-3 text-sm">
								<span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> Anonymisation DICOM active</span>
							</div>
							<div className="text-sm text-slate-700"><span className="font-bold">Notes cliniques :</span> {patient.notes || <span className="text-slate-400">—</span>}</div>
						</div>
					</div>

					{/* MRI Files Section */}
					<div>
						<h2 className="text-lg font-bold text-slate-900 mb-4">Images IRM</h2>
						{patient.mri_files && patient.mri_files.length > 0 ? (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								{patient.mri_files.map((file, i) => (
									<div key={i} className="flex items-center gap-4 bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
										<span className={`px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold`}>{file.format}</span>
										<FileImage className="w-6 h-6 text-blue-600" />
										<div className="flex-1">
											<div className="font-semibold text-slate-900 text-sm">{file.name}</div>
											<div className="text-xs text-slate-500">Uploadé le {new Date(file.uploaded).toLocaleDateString()}</div>
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="text-slate-400 italic text-sm">Aucun fichier IRM uploadé.</div>
						)}
					</div>

					{/* Analysis History Section */}
					<div>
						<h2 className="text-lg font-bold text-slate-900 mb-4">Historique des analyses</h2>
						{(!patient.analyses || patient.analyses.length === 0) ? (
							<div className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-xl p-6 text-slate-500 text-sm">
								<AlertTriangle className="w-5 h-5 text-slate-400" />
								Aucune analyse lancée pour ce patient. Les analyses se lancent depuis la section Analyses MRI.
							</div>
						) : (
							<div> {/* TODO: List analyses */} </div>
						)}
					</div>
				</div>
			</main>
		</div>
	);
}