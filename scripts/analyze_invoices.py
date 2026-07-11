"""Read-only invoice analyzer. It never moves or modifies source PDFs."""
from __future__ import annotations
import hashlib, json, re, sys
from datetime import datetime
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"C:\Users\rc-19\Desktop\Rodrigo\FINAN")
MONTHS = {'janeiro':'01','fevereiro':'02','março':'03','abril':'04','maio':'05','junho':'06','julho':'07','agosto':'08','setembro':'09','outubro':'10','novembro':'11','dezembro':'12'}

def br(value: str | None):
    if not value: return None
    value = value.replace('.', '').replace(',', '.')
    try: return round(float(value), 2)
    except ValueError: return None

def text(pdf: Path):
    reader = PdfReader(str(pdf))
    # Itaú PDFs with embedded text sometimes return one character per line;
    # layout mode preserves enough positioning to read the statement header.
    mode = 'layout' if pdf.name.lower().startswith('fatura_itau') else None
    return '\n'.join((page.extract_text(extraction_mode=mode) if mode else page.extract_text() or '') for page in reader.pages)

def first(pattern, source, flags=re.I):
    match = re.search(pattern, source, flags)
    return match.group(1).strip() if match else None

def parse(pdf: Path):
    raw = text(pdf); flat = ' '.join(raw.split()); issuer = 'Nubank' if pdf.name.lower().startswith('nubank') else 'PicPay' if pdf.name.lower().startswith('picpay') else 'Itaú'
    record = {'filename': pdf.name, 'format':'PDF', 'issuer':issuer, 'sha256':hashlib.sha256(pdf.read_bytes()).hexdigest(), 'bytes':pdf.stat().st_size, 'pages':len(PdfReader(str(pdf)).pages), 'status':'needs_review', 'transactions':[], 'raw_summary':{}}
    if issuer == 'Nubank':
        record['reference_month'] = first(r'fatura de ([a-zç]+)', flat)
        record['due_date'] = first(r'Data de vencimento:\s*(\d{1,2} [A-Z]{3} \d{4})', flat)
        record['total'] = br(first(r'fatura de [a-zç]+, no valor de R\$\s*([\d.,]+)', flat))
        record['raw_summary'] = {'previous': br(first(r'Fatura anterior R\$\s*([\d.,]+)', flat)), 'purchases': br(first(r'Total de compras de todos os cartões,.*?R\$\s*([\d.,]+)', flat)), 'other': br(first(r'Outros lançamentos R\$\s*([\d.,]+)', flat))}
        for match in re.finditer(r'(\d{2} [A-Z]{3})\s+(?:•{4}\s+)?(.+?)\s+([−-]?R\$\s*[\d.,]+)', flat):
            amount = br(match.group(3).replace('R$','').replace('−','-'))
            record['transactions'].append({'date':match.group(1), 'original_description':match.group(2).strip(), 'amount':amount, 'type':'credit' if amount is not None and amount < 0 else 'expense', 'confidence':'medium'})
    elif issuer == 'PicPay':
        record['due_date'] = first(r'Vencimento\s+(\d{2}/\d{2}/\d{4})', flat); record['closed_at'] = first(r'(\d{2} de [A-Za-zç]+)Fechamento', flat)
        record['total'] = br(first(r'Total da sua fatura R\$\s*([\d.,]+)', flat)); record['raw_summary'] = {'previous':br(first(r'Fatura anterior\s*([\d.,]+)', flat)), 'payments':br(first(r'Pagamento recebido\s*(-?[\d.,]+)', flat)), 'credits':br(first(r'Créditos e estornos\s*(-?[\d.,]+)', flat)), 'purchases':br(first(r'Despesas do mês\s*([\d.,]+)', flat))}
        for match in re.finditer(r'(\d{2}/\d{2})\s+(.+?)\s+([\d.,]+)(?=\s|$)', flat):
            record['transactions'].append({'date':match.group(1), 'original_description':match.group(2).strip(), 'amount':br(match.group(3)), 'type':'expense', 'confidence':'low'})
    else:
        record['due_date'] = first(r'Vencimento:\s*(\d{2}/\d{2}/\d{4})', flat); record['closed_at'] = first(r'Emissão:\s*(\d{2}/\d{2}/\d{4})', flat); record['total'] = br(first(r'Total\s*desta?\s*fatura\s*([\d.,]+)', flat)); record['card'] = first(r'Cartão\s+([\dX.]+)', flat)
        record['raw_summary'] = {'previous':br(first(r'Total\s*da\s*fatura\s*anterior\s*([\d.,]+)', flat)), 'payments':br(first(r'Pagamentos?\s*efetuados?\s*([-\d.,]+)', flat)), 'current':br(first(r'Lançamentos\s*atuais\s*([\d.,]+)', flat))}
    # A header total alone is not enough: Itaú OCR-layout statements still
    # require manual line-item review when no transaction rows were extracted.
    record['status'] = 'ready_for_review' if record['total'] is not None and not (issuer == 'Itaú' and not record['transactions']) else 'needs_review'
    return record

files = sorted(ROOT.glob('*.pdf'))
results = [parse(pdf) for pdf in files]
seen = {}; duplicates=[]
for item in results:
    if item['sha256'] in seen: duplicates.append({'filename':item['filename'], 'duplicate_of':seen[item['sha256']]})
    else: seen[item['sha256']] = item['filename']
print(json.dumps({'source_directory':str(ROOT), 'files':results, 'duplicates':duplicates, 'read_only':True}, ensure_ascii=False, indent=2))
