"""Pure, three-way AKP reconciliation. No network, credentials or writes."""
import copy
import json
import sys

FIELDS = {
    'status': 'STATUS', 'priority': 'PRIORYTET', 'location': 'ADRES',
    'client_name': 'KLIENT', 'client_phone': 'TELEFON',
    'client_email': 'EMAIL', 'iproc_number': 'NR_IPROC',
    'lm_number': 'NR_LM', 'due_date': 'PLAN_START',
}

def project(row):
    result = {field: row.get(column, '') or '' for field, column in FIELDS.items()}
    status = row.get('STATUS', '')
    result['status'] = 'ZAKONCZONE' if status.startswith('WYKONANE_ROZLICZONE') else status
    result['priority'] = row.get('PRIORYTET') if row.get('PRIORYTET') in ('WYSOKI', 'KRYTYCZNY') else 'NORMALNY'
    result['due_date'] = row.get('PLAN_START') or row.get('DATA_POMIARU') or ''
    result['client_address'] = result['location']
    result['title'] = (row.get('TYP_PRACY', '') + ' — ' + row.get('KLIENT', ''))[:180]
    result['instructions'] = '\n'.join(filter(None, [
        'Klient: '+row['KLIENT'] if row.get('KLIENT') else '',
        'Telefon: '+row['TELEFON'] if row.get('TELEFON') else '',
        'Wykonawca wg Google: '+row['PRACOWNICY']+' (konto/przydział do potwierdzenia)' if row.get('PRACOWNICY') else '',
        'Następny krok: '+row['NASTEPNY_KROK'] if row.get('NASTEPNY_KROK') else '',
        'Blokada: '+row['BLOKADA'] if row.get('BLOKADA') else '',
    ]))[:2500]
    return result


def plan(base, sheet, app):
    """Return guarded patches. Any conflict blocks the entire record."""
    key = base.get('ID_AKP')
    if not key or sheet.get('ID_AKP') != key or app.get('akp_id') != key:
        raise ValueError('Identity mismatch')
    b, s = project(base), project(sheet)
    sheet_patch, app_patch, conflicts = {}, {}, []
    # Address is represented by two API fields; detect disagreeing app edits.
    address_edits = {app.get(k) or '' for k in ('location', 'client_address') if (app.get(k) or '') != b[k]}
    if len(address_edits) > 1:
        conflicts.append('address')
    for field, column in FIELDS.items():
        av = app.get(field) or ''
        if field == 'location' and len(address_edits) == 1:
            av = next(iter(address_edits))
        sheet_changed, app_changed = s[field] != b[field], av != b[field]
        if sheet_changed and app_changed and s[field] != av:
            conflicts.append(field)
        elif sheet_changed:
            app_patch[field] = s[field] or None
            if field == 'location': app_patch['client_address'] = s[field] or None
        elif app_changed:
            sheet_patch[column] = av
            if field == 'location': app_patch.update(location=av or None, client_address=av or None)
    # Arbitrary app text cannot safely be split into client/type/next-step fields.
    # Keep it and require reconciliation instead of corrupting the source history.
    for field in ('title', 'instructions'):
        av = app.get(field) or ''
        if av != b[field] and av != s[field]:
            conflicts.append(field + '_needs_review')
        elif s[field] != b[field]:
            app_patch[field] = s[field]
    if conflicts:
        return {'akp_id': key, 'conflicts': sorted(set(conflicts)), 'sheet_patch': {}, 'app_patch': {}, 'ack_allowed': False}
    merged_sheet = copy.deepcopy(sheet)
    merged_sheet.update(sheet_patch)
    merged_projection = project(merged_sheet)
    for field in ('title', 'instructions'):
        if (app.get(field) or '') != merged_projection[field]:
            app_patch[field] = merged_projection[field]
    return {'akp_id': key, 'conflicts': [], 'sheet_patch': sheet_patch, 'app_patch': app_patch,
            'expected_updated_at': app.get('updated_at'), 'merged_source': merged_sheet,
            'ack_allowed': True}

if __name__ == '__main__':
    data = json.load(sys.stdin)
    print(json.dumps(plan(data['base'], data['sheet'], data['app']), ensure_ascii=False))
