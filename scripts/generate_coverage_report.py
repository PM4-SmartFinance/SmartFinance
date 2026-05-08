import json, os
out='/tmp/coverage_report.md'
lines=[]
lines.append('## Test Coverage Report')
lines.append('')
lines.append('| Module | Current | Baseline | Delta |')
lines.append('|--------|---------|----------|-------|')

def pct_of(path):
    with open(path,'r') as f:
        j=json.load(f)
    return j['total']['lines']['pct'], j

# backend
back_sum='backend/coverage/coverage-summary.json'
if os.path.exists(back_sum):
    back_cur, back_json = pct_of(back_sum)
    back_base=None
    base_path='coverage/baseline-backend-summary.json'
    if os.path.exists(base_path):
        back_base, _ = pct_of(base_path)
    if back_base is None:
        lines.append(f'| Backend | {back_cur}% | - | - |')
    else:
        delta=round(back_cur - back_base,2)
        lines.append(f'| Backend | {back_cur}% | {back_base}% | {delta}% |')

# frontend
front_sum='frontend/coverage/coverage-summary.json'
if os.path.exists(front_sum):
    front_cur, front_json = pct_of(front_sum)
    front_base=None
    base_path='coverage/baseline-frontend-summary.json'
    if os.path.exists(base_path):
        front_base, _ = pct_of(base_path)
    if front_base is None:
        lines.append(f'| Frontend | {front_cur}% | - | - |')
    else:
        delta=round(front_cur - front_base,2)
        lines.append(f'| Frontend | {front_cur}% | {front_base}% | {delta}% |')

# per-file backend
if os.path.exists(back_sum):
    lines.append('')
    lines.append('#### Backend Per-File Coverage')
    cnt=0
    for k,v in back_json.items():
        if k=='total':
            continue
        lines.append(f"- **{k}**: {v['lines']['pct']}%")
        cnt+=1
        if cnt>=20:
            break

# per-file frontend
if os.path.exists(front_sum):
    with open(front_sum,'r') as f:
        fj=json.load(f)
    lines.append('')
    lines.append('#### Frontend Per-File Coverage')
    cnt=0
    for k,v in fj.items():
        if k=='total':
            continue
        lines.append(f"- **{k}**: {v['lines']['pct']}%")
        cnt+=1
        if cnt>=20:
            break

with open(out,'w') as f:
    f.write('\n'.join(lines))
print('Wrote', out)
