import json
import sqlite3
import datetime
import io
from database.db import get_db
from app import create_app
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT

MAROON = colors.HexColor('#800000')
DARK_MAROON = colors.HexColor('#4a0000')
LIGHT_BG = colors.HexColor('#fef7f7')
ROW_ALT = colors.HexColor('#fafafa')
BORDER_COLOR = colors.HexColor('#e5e7eb')
GREEN = colors.HexColor('#059669')
RED = colors.HexColor('#dc2626')
GREY_TEXT = colors.HexColor('#6b7280')

app = create_app()
with app.app_context():
    db = get_db()
    user_id = 1
    user = db.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    accounts = db.execute('SELECT * FROM accounts WHERE user_id = ?', (user_id,)).fetchall()
    txns = db.execute('''
        SELECT t.*, a.account_number, a.account_type 
        FROM transactions t 
        JOIN accounts a ON t.account_id = a.id 
        WHERE a.user_id = ? 
        ORDER BY t.transaction_date DESC
    ''', (user_id,)).fetchall()

    try:
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=50)
        elements = []
        styles = getSampleStyleSheet()
        bank_name_style = ParagraphStyle('BankName', parent=styles['Title'], fontSize=28, textColor=MAROON, fontName='Helvetica-Bold', spaceAfter=2, alignment=TA_LEFT)
        subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, textColor=GREY_TEXT, spaceAfter=4)
        section_title = ParagraphStyle('SectionTitle', parent=styles['Normal'], fontSize=13, textColor=MAROON, fontName='Helvetica-Bold', spaceBefore=20, spaceAfter=10)
        info_style = ParagraphStyle('InfoStyle', parent=styles['Normal'], fontSize=10, textColor=colors.HexColor('#374151'), leading=16)
        footer_style = ParagraphStyle('FooterStyle', parent=styles['Normal'], fontSize=8, textColor=GREY_TEXT, alignment=TA_CENTER, spaceBefore=20)
        amount_credit = ParagraphStyle('AmtCredit', parent=styles['Normal'], fontSize=9, textColor=GREEN, fontName='Helvetica-Bold', alignment=TA_RIGHT)
        amount_debit = ParagraphStyle('AmtDebit', parent=styles['Normal'], fontSize=9, textColor=RED, fontName='Helvetica-Bold', alignment=TA_RIGHT)
        elements.append(Paragraph("SmartBank", bank_name_style))
        elements.append(Paragraph("Premium Digital Banking Statement", subtitle_style))
        elements.append(Spacer(1, 4))
        elements.append(HRFlowable(width="100%", thickness=2, color=MAROON, spaceAfter=16))
        
        gen_date = datetime.datetime.now().strftime('%d %B %Y, %I:%M %p')
        info_data = [
            ['Customer Name', user['name'] or '—', 'Statement Date', gen_date],
            ['Email', user['email'] or '—', 'Customer ID', f"UID-{user['id']:06d}"],
            ['Phone', dict(user).get('phone') or '—', 'Total Accounts', str(len(accounts))],
        ]
        
        info_table = Table(info_data, colWidths=[100, 160, 100, 160])
        info_table.setStyle(TableStyle([
            ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
            ('FONTNAME', (2,0), (2,-1), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 9),
            ('TEXTCOLOR', (0,0), (0,-1), GREY_TEXT),
            ('TEXTCOLOR', (2,0), (2,-1), GREY_TEXT),
            ('TEXTCOLOR', (1,0), (1,-1), colors.HexColor('#111827')),
            ('TEXTCOLOR', (3,0), (3,-1), colors.HexColor('#111827')),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ]))
        elements.append(info_table)
        elements.append(Spacer(1, 12))
        
        if accounts:
            elements.append(Paragraph("Account Summary", section_title))
            acc_header = ['Account Number', 'Type', 'IFSC', 'Balance (₹)']
            acc_rows = [acc_header]
            total_balance = 0
            for acc in accounts:
                bal = float(acc['balance'])
                total_balance += bal
                acc_rows.append([
                    acc['account_number'],
                    (acc['account_type'] or 'Savings').title(),
                    dict(acc).get('ifsc_code') or 'SMTB0000001',
                    f"₹{bal:,.2f}"
                ])
            acc_rows.append(['', '', 'Total Balance', f"₹{total_balance:,.2f}"])
            acc_table = Table(acc_rows, colWidths=[140, 100, 120, 160])
            acc_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), MAROON),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,0), 10),
                ('FONTSIZE', (0,1), (-1,-1), 9),
                ('BOTTOMPADDING', (0,0), (-1,0), 10),
                ('TOPPADDING', (0,0), (-1,0), 10),
                ('BOTTOMPADDING', (0,1), (-1,-1), 7),
                ('TOPPADDING', (0,1), (-1,-1), 7),
                ('ALIGN', (3,0), (3,-1), 'RIGHT'),
                ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                ('LINEABOVE', (0,-1), (-1,-1), 1.5, MAROON),
                ('GRID', (0,0), (-1,-2), 0.5, BORDER_COLOR),
                ('ROUNDEDCORNERS', [6, 6, 0, 0]),
            ]))
            elements.append(acc_table)
            elements.append(Spacer(1, 16))
        
        elements.append(Paragraph("Transaction History", section_title))
        
        if not txns:
            elements.append(Paragraph("No transactions found for this period.", info_style))
        else:
            total_credit = sum(float(t['amount']) for t in txns if t['type'] == 'credit')
            total_debit = sum(float(t['amount']) for t in txns if t['type'] == 'debit')
            summary_data = [
                ['Total Credits', 'Total Debits', 'Net Flow'],
                [f"₹{total_credit:,.2f}", f"₹{total_debit:,.2f}", f"₹{(total_credit - total_debit):,.2f}"]
            ]
            summary_table = Table(summary_data, colWidths=[173, 173, 174])
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
                ('TEXTCOLOR', (0,0), (-1,0), GREY_TEXT),
                ('FONTSIZE', (0,0), (-1,0), 8),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,1), (-1,1), 12),
                ('FONTNAME', (0,1), (-1,1), 'Helvetica-Bold'),
                ('TEXTCOLOR', (0,1), (0,1), GREEN),
                ('TEXTCOLOR', (1,1), (1,1), RED),
                ('TEXTCOLOR', (2,1), (2,1), MAROON),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 10),
                ('TOPPADDING', (0,0), (-1,-1), 10),
                ('BOX', (0,0), (-1,-1), 1, BORDER_COLOR),
                ('LINEBEFORE', (1,0), (1,-1), 0.5, BORDER_COLOR),
                ('LINEBEFORE', (2,0), (2,-1), 0.5, BORDER_COLOR),
                ('ROUNDEDCORNERS', [8, 8, 8, 8]),
            ]))
            elements.append(summary_table)
            elements.append(Spacer(1, 12))
            data = [['Date', 'Description', 'Account', 'Ref', 'Type', 'Amount (₹)']]
            for t in txns:
                amt = float(t['amount'])
                amt_str = f"+₹{amt:,.2f}" if t['type'] == 'credit' else f"-₹{amt:,.2f}"
                desc = t['description']
                if len(desc) > 28:
                    desc = desc[:28] + '…'
                ref = (dict(t).get('reference_number') or '—')[:12]
                data.append([
                    t['transaction_date'][:10],
                    desc,
                    '••' + t['account_number'][-4:],
                    ref,
                    t['type'].upper(),
                    amt_str
                ])
            txn_table = Table(data, colWidths=[68, 148, 55, 82, 45, 122])
            txn_style = [
                ('BACKGROUND', (0,0), (-1,0), MAROON),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,0), 9),
                ('FONTSIZE', (0,1), (-1,-1), 8),
                ('BOTTOMPADDING', (0,0), (-1,0), 10),
                ('TOPPADDING', (0,0), (-1,0), 10),
                ('BOTTOMPADDING', (0,1), (-1,-1), 6),
                ('TOPPADDING', (0,1), (-1,-1), 6),
                ('ALIGN', (5,0), (5,-1), 'RIGHT'),
                ('ALIGN', (4,0), (4,-1), 'CENTER'),
                ('GRID', (0,0), (-1,-1), 0.4, BORDER_COLOR),
            ]
            for i in range(1, len(data)):
                if i % 2 == 0:
                    txn_style.append(('BACKGROUND', (0,i), (-1,i), ROW_ALT))
                if data[i][4] == 'CREDIT':
                    txn_style.append(('TEXTCOLOR', (5,i), (5,i), GREEN))
                else:
                    txn_style.append(('TEXTCOLOR', (5,i), (5,i), RED))
                txn_style.append(('FONTNAME', (5,i), (5,i), 'Helvetica-Bold'))
            txn_table.setStyle(TableStyle(txn_style))
            elements.append(txn_table)
        
        elements.append(Spacer(1, 30))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=BORDER_COLOR, spaceAfter=10))
        elements.append(Paragraph("This is a computer-generated statement from SmartBank Digital Banking.", footer_style))
        elements.append(Paragraph("It does not require a physical signature. For disputes, contact support@smartbank.in", footer_style))
        doc.build(elements)
        print("SUCCESS")
    except Exception as e:
        import traceback
        traceback.print_exc()
