@api_view(['POST'])
def save_orientation(request):
    patient_id = request.data.get('patient_id')
    if not patient_id:
        return Response({'error': 'patient_id est requis.'}, status=status.HTTP_400_BAD_REQUEST)
    instance, _ = PatientImageOrientation.objects.get_or_create(patient_id=int(patient_id))
    serializer = OrientationSerializer(instance, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
@api_view(['GET'])
def load_orientation(request, patient_id):
    try:
        instance = PatientImageOrientation.objects.get(patient_id=patient_id)
    except PatientImageOrientation.DoesNotExist:
        return Response({'detail': 'Aucune orientation trouvee.'}, status=status.HTTP_404_NOT_FOUND)
    serializer = OrientationSerializer(instance)
    return Response(serializer.data)
@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def viewer_upload_image(request):
    patient_id = request.data.get('patient_id')
    image_file = request.FILES.get('image')
    if not patient_id:
        return Response({'error': 'patient_id est requis.'}, status=status.HTTP_400_BAD_REQUEST)
    if not image_file:
        return Response({'error': 'Aucun fichier image fourni.'}, status=status.HTTP_400_BAD_REQUEST)
    obj = PatientImage.objects.create(patient_id=int(patient_id), image=image_file)
    serializer = PatientImageSerializer(obj, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)
@api_view(['GET'])
def list_patients(request):
    if not request.user or not request.user.is_authenticated:
        print(f'Yassmine now the list_patients endpoint FAILED - not authenticated')
        return JsonResponse({'error': 'login required'}, status=401)
    print(f'Yassmine now the list_patients endpoint works - user: {request.user.username}')
    qs = Series.objects.filter(user=request.user).values_list('patient_id', flat=True).distinct()
    if qs.exists():
        patients = {}
        for pid in qs:
            patients[pid] = {'_id': pid, 'patient_id': pid, 'meta': {'series_count': 0}}
        for s in Series.objects.filter(user=request.user):
            pid = s.patient_id
            if pid in patients:
                patients[pid]['meta']['series_count'] += 1
        print(f'Yassmine now the list_patients SUCCESS - found {len(patients)} patients from DB')
        return JsonResponse(list(patients.values()), safe=False)
    print(f'Yassmine now the list_patients SUCCESS - found 0 patients')
    return JsonResponse([], safe=False)
@api_view(['GET'])
def get_patient_series(request, patient_id):
    if not request.user or not request.user.is_authenticated:
        print(f'Yassmine now the get_patient_series endpoint FAILED - not authenticated')
        return JsonResponse({'error': 'login required'}, status=401)
    print(f'Yassmine now the get_patient_series endpoint works - patient_id: {patient_id}, user: {request.user.username}')
    out = []
    qs = Series.objects.filter(patient_id=patient_id, user=request.user).order_by('-created_at')
    skip_names = {'ref.png', 'patient.png', 'preview_ref.png', 'preview_patient.png'}
    for s in qs:
        for rel in s.files or []:
            rel_norm = rel.replace('\\', '/')
            name = os.path.basename(rel_norm)
            if name in skip_names:
                continue
            out.append({'series_id': s.id, 'job_id': s.job_id, 'relpath': rel_norm, 'filename': name, 'created_at': s.created_at.isoformat(), 'user': s.user.username if s.user else None})
    print(f'Yassmine now the get_patient_series SUCCESS - patient_id: {patient_id}, returned {len(out)} series')
    return JsonResponse(out, safe=False)
def _dashboard_patient_payload(patient):
    return {'id': str(patient.id), 'num_dossier': patient.dossier_number, 'nom': patient.nom, 'prenom': patient.prenom, 'date_naissance': patient.date_naissance.isoformat() if patient.date_naissance else None, 'sexe': patient.sexe, 'autres_maladies': patient.autres_maladies, 'created_at': patient.created_at.isoformat() if patient.created_at else None}
@api_view(['POST'])
@permission_classes([AllowAny])
def create_contact_request(request):
    data = request.data if hasattr(request, 'data') else {}
    subject_map = {'Demande de dÚmonstration': 'demonstration', 'IntÚgration clinique': 'integration', 'Support technique': 'support', 'Partenariat': 'partnership', 'Autre': 'other'}
    normalized_subject = subject_map.get(str(data.get('subject', '')).strip(), str(data.get('subject', 'demonstration')).strip().lower())
    if normalized_subject not in {'demonstration', 'integration', 'support', 'partnership', 'other'}:
        normalized_subject = 'other'
    payload = {'full_name': data.get('full_name') or data.get('fullName') or '', 'email': data.get('email') or '', 'institution': data.get('institution') or '', 'subject': normalized_subject, 'message': data.get('message') or ''}
    serializer = ContactRequestSerializer(data=payload)
    if serializer.is_valid():
        contact = serializer.save()
        return Response({'ok': True, 'message': 'Contact request created successfully', 'contact_request_id': contact.id}, status=status.HTTP_201_CREATED)
    return Response({'ok': False, 'error': 'Invalid contact request data', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
def _admin_scope_users(request):
    if request.user.is_staff:
        return User.objects.all()
    return User.objects.filter(id=request.user.id)
def _admin_scope_patients(request):
    if request.user.is_staff:
        return Patient.objects.all()
    return Patient.objects.filter(doctor=request.user)
def _admin_scope_series(request):
    if request.user.is_staff:
        return Series.objects.all()
    return Series.objects.filter(user=request.user)
def _admin_scope_reclamations(request):
    if request.user.is_staff:
        return Reclamation.objects.all()
    return Reclamation.objects.filter(user=request.user)
@api_view(['GET'])
@login_required
def admin_dashboard_overview(request):
    series_qs = _admin_scope_series(request)
    patients_qs = _admin_scope_patients(request)
    reclamations_qs = _admin_scope_reclamations(request)
    analyses_totales = int(series_qs.count())
    patients_actifs = int(patients_qs.count())
    rapports_generes = int(reclamations_qs.count())
    recent = []
    for s in series_qs.order_by('-created_at')[:6]:
        recent.append({'action': 'Analyse IRM cÚrÚbrale', 'user': s.user.username if s.user else 'Utilisateur inconnu', 'type': 'Segmentation', 'status': 'segmentation', 'date': s.created_at.isoformat() if s.created_at else None})
    for r in reclamations_qs.order_by('-date')[:6]:
        recent.append({'action': f'RÚclamation {r.numero}', 'user': r.user.username, 'type': 'Rapport', 'status': 'rapport', 'date': r.date.isoformat() if r.date else None})
    recent.sort(key=lambda x: x.get('date') or '', reverse=True)
    return JsonResponse({'ok': True, 'stats': {'analyses_totales': analyses_totales, 'patients_actifs': patients_actifs, 'rapports_generes': rapports_generes, 'taux_precision': 99.2, 'deltas': {'analyses_totales': 12.5, 'patients_actifs': 8.2, 'rapports_generes': 23.1, 'taux_precision': 0.3}}, 'activity': recent[:8], 'repartition': [{'label': 'Segmentation IRM', 'percent': 42}, {'label': 'PET-Scan', 'percent': 28}, {'label': 'SPECT', 'percent': 18}, {'label': 'Rapports', 'percent': 12}]})
@api_view(['GET'])
@login_required
def admin_dashboard_accounts(request):
    users_qs = _admin_scope_users(request).order_by('-date_joined')
    accounts = []
    for i, u in enumerate(users_qs[:100], start=1):
        if not u.last_login:
            status_label = 'En attente'
        else:
            status_label = 'Actif' if u.is_active else 'Inactif'
        accounts.append({'id': f'USR-{i:03d}', 'username': u.username, 'full_name': u.get_full_name() or u.username, 'email': u.email or '-', 'role': 'Super Admin' if u.is_superuser else 'Admin' if u.is_staff else 'Clinicien', 'status': status_label, 'last_login': u.last_login.isoformat() if u.last_login else None})
    return JsonResponse({'ok': True, 'count': len(accounts), 'accounts': accounts})
@api_view(['GET'])
@login_required
def admin_dashboard_history(request):
    series_qs = _admin_scope_series(request)
    reclamations_qs = _admin_scope_reclamations(request)
    items = []
    for s in series_qs.order_by('-created_at')[:20]:
        items.append({'title': 'Analyse IRM cÚrÚbrale', 'subtitle': f"{(s.user.username if s.user else 'Utilisateur')} À SÚrie {s.job_id[:8]}", 'type': 'Segmentation', 'status': 'segmentation', 'date': s.created_at.isoformat() if s.created_at else None})
    for r in reclamations_qs.order_by('-date')[:20]:
        items.append({'title': f'RÚclamation {r.numero}', 'subtitle': f'{r.user.username} À Ticket support', 'type': 'Rapport', 'status': 'rapport', 'date': r.date.isoformat() if r.date else None})
    items.sort(key=lambda x: x.get('date') or '', reverse=True)
    return JsonResponse({'ok': True, 'items': items[:20]})
@api_view(['GET'])
@login_required
def admin_dashboard_settings(request):
    user = request.user
    return JsonResponse({'ok': True, 'profile': {'full_name': user.get_full_name() or user.username, 'email': user.email or '-', 'role': 'Super Admin' if user.is_superuser else 'Admin' if user.is_staff else 'Clinicien'}, 'security': {'two_factor': True, 'session_expiration': '30 min', 'password_rotation': '90 jours'}, 'notifications': {'email': True, 'push': True, 'auto_reports': False, 'security_alerts': True}, 'platform': {'language': 'Franþais', 'timezone': 'Europe/Paris (UTC+2)', 'date_format': 'DD/MM/YYYY'}})
