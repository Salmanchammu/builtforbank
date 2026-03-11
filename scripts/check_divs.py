import sys

with open('frontend/staffdash.html', 'r', encoding='utf-8') as f:
    html = f.read()

dashboard_idx = html.find('id="dashboard"')
services_idx = html.find('id="services"')
support_idx = html.find('id="supportdesk"')

def count_balance(text):
    return text.count('<div') - text.count('</div')

print('Dashboard -> Services balance:', count_balance(html[dashboard_idx:services_idx]))
print('Services -> Support balance:', count_balance(html[services_idx:support_idx]))
print('Support -> End balance:', count_balance(html[support_idx:]))
