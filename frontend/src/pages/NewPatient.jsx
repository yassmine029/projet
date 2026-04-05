import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import { Upload, Info, Lock, CheckCircle, FileImage } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPatient } from '../api';

const PATHOLOGIES = [
	'Alzheimer',
	'Épilepsie',
	'Autre',
	'Non défini',
];
const STADES = [
	'Précoce',
	'Modéré',
	'Avancé',
	'Non défini',
];
const ANTECEDENTS = [
	'Oui',
	'Non',
	'Inconnu',
];

export default function NewPatient() {
	const navigate = useNavigate();
	const [form, setForm] = useState({
		nom: '',
		prenom: '',
		date_naissance: '',
		sexe: '', // 'M' ou 'F'
		telephone: '',
		email: '',
		pathologie: '',
		stade: '',
		antecedents: '',
		notes: '',
		files: [],
	});
	const [errors, setErrors] = useState({});
	const [uploadError, setUploadError] = useState('');
	const [submitting, setSubmitting] = useState(false);

	const handleChange = e => {
		const { name, value } = e.target;
		let newValue = value;
		if (name === 'sexe') {
			if (value === 'Masculin') newValue = 'M';
			else if (value === 'Féminin') newValue = 'F';
		}
		setForm(f => ({ ...f, [name]: newValue }));
		setErrors(e => ({ ...e, [name]: '' }));
	};

	const handleFileChange = e => {
		let files = Array.from(e.target.files);
		// If directory upload, flatten all files
		if (e.target.webkitEntries && e.target.webkitEntries.length > 0) {
			// Not all browsers support webkitEntries, but if present, flatten
			files = [];
			const traverse = (entry, path = "") => {
				if (entry.isFile) {
					entry.file(file => files.push(file));
				} else if (entry.isDirectory) {
					const reader = entry.createReader();
					reader.readEntries(entries => {
						entries.forEach(en => traverse(en, path + entry.name + "/"));
					});
				}
			};
			Array.from(e.target.webkitEntries).forEach(entry => traverse(entry));
		}
		setForm(f => ({ ...f, files }));
		setUploadError('');
	};

	const handleDrop = e => {
		e.preventDefault();
		let files = Array.from(e.dataTransfer.files);
		setForm(f => ({ ...f, files }));
		setUploadError('');
	};

	const handleDragOver = e => {
		e.preventDefault();
	};

	const validate = () => {
		const newErrors = {};
		if (!form.nom) newErrors.nom = 'Requis';
		if (!form.prenom) newErrors.prenom = 'Requis';
		if (!form.date_naissance) newErrors.date_naissance = 'Requis';
		if (!form.sexe) newErrors.sexe = 'Requis';
		return newErrors;
	};

	const handleSubmit = async e => {
		e.preventDefault();
		const newErrors = validate();
		if (Object.keys(newErrors).length > 0) {
			setErrors(newErrors);
			return;
		}
		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append('nom', form.nom);
			formData.append('prenom', form.prenom);
			formData.append('date_naissance', form.date_naissance);
			formData.append('sexe', form.sexe);
			formData.append('telephone', form.telephone);
			formData.append('email', form.email);
			formData.append('pathologie', form.pathologie);
			formData.append('stade', form.stade);
			formData.append('antecedents', form.antecedents);
			formData.append('notes', form.notes);
			if (form.files && form.files.length > 0) {
				for (let i = 0; i < form.files.length; i++) {
					formData.append('files', form.files[i]);
				}
			}
			await createPatient(formData);
			setSubmitting(false);
			navigate('/dashboard/patients');
		} catch (err) {
			setSubmitting(false);
			setUploadError('Erreur lors de la création du patient.');
		}
	};

	return (
		<div className="flex min-h-screen bg-[#f8fafc]">
			<Sidebar />
			<main className="flex-1 ml-64 px-0 md:px-12 py-10">
				<div className="max-w-3xl mx-auto">
					{/* Info Banner */}
					<div className="flex items-center gap-3 mb-8 p-4 rounded-xl border-l-4 border-[#0A1172] bg-white shadow-sm">
						<Info className="w-5 h-5 text-[#0A1172]" />
						<span className="text-sm font-semibold text-[#0A1172]">Le numéro de dossier sera généré automatiquement après enregistrement</span>
					</div>

					<form onSubmit={handleSubmit} className="space-y-10 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.04)] border border-slate-50 p-8">
						{/* Section 1 */}
						<section>
							<h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Informations personnelles</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Nom <span className="text-red-500">*</span></label>
									<input name="nom" value={form.nom} onChange={handleChange} required className={`w-full p-3 rounded-xl border ${errors.nom ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400`} placeholder="Nom de famille" />
									{errors.nom && <div className="text-xs text-red-500 mt-1 font-medium">{errors.nom}</div>}
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Prénom <span className="text-red-500">*</span></label>
									<input name="prenom" value={form.prenom} onChange={handleChange} required className={`w-full p-3 rounded-xl border ${errors.prenom ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400`} placeholder="Prénom" />
									{errors.prenom && <div className="text-xs text-red-500 mt-1 font-medium">{errors.prenom}</div>}
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Date de naissance <span className="text-red-500">*</span></label>
									<input type="date" name="date_naissance" value={form.date_naissance} onChange={handleChange} required className={`w-full p-3 rounded-xl border ${errors.date_naissance ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all`} />
									{errors.date_naissance && <div className="text-xs text-red-500 mt-1 font-medium">{errors.date_naissance}</div>}
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Sexe <span className="text-red-500">*</span></label>
									<select name="sexe" value={form.sexe === 'M' ? 'Masculin' : form.sexe === 'F' ? 'Féminin' : ''} onChange={handleChange} required className={`w-full p-3 rounded-xl border ${errors.sexe ? 'border-red-400' : 'border-slate-200'} focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white`}>
										<option value="">Sélectionner</option>
										<option value="Masculin">Masculin</option>
										<option value="Féminin">Féminin</option>
									</select>
									{errors.sexe && <div className="text-xs text-red-500 mt-1 font-medium">{errors.sexe}</div>}
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Téléphone</label>
									<input name="telephone" value={form.telephone} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400" placeholder="Numéro de téléphone" />
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Adresse e-mail</label>
									<input name="email" value={form.email} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all placeholder:text-slate-400" placeholder="Adresse e-mail" />
								</div>
							</div>
						</section>

						{/* Section 2 */}
						<section>
							<h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Informations médicales</h2>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Pathologie suspectée</label>
									<select name="pathologie" value={form.pathologie} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
										<option value="">Sélectionner</option>
										{PATHOLOGIES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
									</select>
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Stade clinique</label>
									<select name="stade" value={form.stade} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
										<option value="">Sélectionner</option>
										{STADES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
									</select>
								</div>
								<div>
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Antécédents familiaux</label>
									<select name="antecedents" value={form.antecedents} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all bg-white">
										<option value="">Sélectionner</option>
										{ANTECEDENTS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
									</select>
								</div>
								<div className="md:col-span-2">
									<label className="block text-sm font-bold text-[#1a1f3c] mb-2">Notes cliniques</label>
									<textarea name="notes" value={form.notes} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 focus:border-[#4f6ef7] focus:ring-1 focus:ring-[#4f6ef7] outline-none transition-all min-h-[100px] resize-y placeholder:text-slate-400" placeholder="Notes, observations, etc." />
								</div>
							</div>
						</section>

						{/* Section 3 */}
						<section>
							<h2 className="text-lg font-bold text-[#1a1f3c] mb-6">Upload des images IRM</h2>
							<div className="mb-4">
								<div
									className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 transition-colors ${uploadError ? 'border-red-400 bg-red-50' : 'border-[#4f6ef7] bg-blue-50/30'}`}
									onDrop={handleDrop}
									onDragOver={handleDragOver}
									style={{ cursor: 'pointer' }}
								>
									<Upload className="w-8 h-8 text-[#4f6ef7] mb-2" />
									<span className="font-semibold text-[#1a1f3c]">Glissez-déposez vos fichiers ici ou <span className="underline">cliquez pour sélectionner</span></span>
									<input
										type="file"
										accept=".nii,.nii.gz,.dcm,.jpg,.jpeg,.png,.tif,.tiff,.bmp"
										multiple
										onChange={handleFileChange}
										className="hidden"
										id="file-upload"
									/>
									<label htmlFor="file-upload" className="mt-2 px-4 py-2 bg-[#4f6ef7] text-white rounded-lg font-bold text-xs cursor-pointer hover:bg-blue-600 transition-colors">Choisir des fichiers ou dossiers</label>
									<div className="flex gap-2 mt-4 flex-wrap">
										<span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">.nii</span>
										<span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">.nii.gz</span>
										<span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">.dcm</span>
										<span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">.jpg</span>
										<span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">.jpeg</span>
										<span className="px-2 py-1 rounded bg-green-100 text-green-700 text-xs font-bold">.png</span>
										<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-bold">.tif</span>
										<span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700 text-xs font-bold">.tiff</span>
										<span className="px-2 py-1 rounded bg-pink-100 text-pink-700 text-xs font-bold">.bmp</span>
									</div>
									<div className="mt-2 text-xs text-[#0A1172] font-medium">Séquence T1 ou images médicales (IRM, radiologie, etc.)</div>
									{uploadError && <div className="text-xs text-red-500 mt-2 font-medium">{uploadError}</div>}
									{form.files.length > 0 && (
										<div className="mt-4 w-full">
											<div className="text-xs font-bold text-[#1a1f3c] mb-2">Fichiers sélectionnés :</div>
											<ul className="text-xs text-[#4f6ef7] space-y-1">
												{form.files.map((f, i) => (
													<li key={i} className="flex items-center gap-2"><FileImage className="w-4 h-4" /> {f.name}</li>
												))}
											</ul>
										</div>
									)}
								</div>
							</div>
							<div className="flex items-center gap-2 mt-2">
								<input type="checkbox" checked disabled className="accent-[#10b981] w-4 h-4" id="anonymize" />
								<label htmlFor="anonymize" className="text-sm font-semibold text-[#10b981] flex items-center gap-1">
									<Lock className="w-4 h-4" /> Anonymisation DICOM obligatoire
								</label>
								<span className="text-xs text-slate-500 ml-2">Cette option est imposée pour la protection des données patient.</span>
							</div>
						</section>

						{/* Actions */}
						<div className="flex justify-end gap-3 pt-8 border-t border-slate-100 mt-8">
							<button
								type="button"
								className="px-6 py-2.5 rounded-xl text-sm font-bold text-[#6b7280] hover:bg-slate-200 transition-colors"
								onClick={() => window.history.back()}
								disabled={submitting}
							>
								Annuler
							</button>
							<button
								type="submit"
								className="flex items-center gap-2 px-8 py-2.5 bg-[#4f6ef7] text-white rounded-xl text-sm font-bold shadow-[0_4px_14px_rgba(79,110,247,0.3)] hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								disabled={submitting}
							>
								{submitting ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : <CheckCircle className="w-4 h-4" />} Enregistrer le patient
							</button>
						</div>
					</form>
				</div>
			</main>
		</div>
	);
}