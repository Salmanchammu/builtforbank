import re

for filepath in [r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\staffdash.html', r'c:\Users\salma\Downloads\smart-bank-v2-FIXED\smartbank_v2\frontend\admindash.html']:
    with open(filepath, 'r', encoding='utf-8') as f:
        html = f.read()

    # Fix </link> closing tags introduced by BeautifulSoup html.parser
    html = html.replace('</link>', '')

    # Fix </style> and </script> getting mashed
    html = html.replace('</style></head>', '</style>\n</head>')

    # Fix </div></body> mash
    html = html.replace('</div></body>', '</div>\n</body>')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Fixed formatting in {filepath}")
