"""Generates a payslip / compensation confirmation PDF for a candidate's payroll setup."""
import os
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer

PAYSLIP_DIR = "backend/uploads/payslips"

ANNUAL_CTC = 900000


def compute_salary_breakdown() -> dict:
    """Fixed CTC of Rs. 9,00,000 per annum, broken down into standard components."""
    earnings = {
        "Basic Salary": 360000,
        "House Rent Allowance (HRA)": 180000,
        "Special Allowance": 195000,
        "Conveyance Allowance": 19200,
        "Medical Allowance": 15000,
        "Performance Bonus": 100000,
        "Leave Travel Allowance (LTA)": 30800,
    }
    gross_annual = sum(earnings.values())

    deductions = {
        "Provident Fund (Employee Contribution)": 43200,
        "Professional Tax": 2400,
    }
    total_deductions = sum(deductions.values())
    net_annual = gross_annual - total_deductions

    return {
        "annual_ctc": ANNUAL_CTC,
        "earnings": earnings,
        "gross_annual": gross_annual,
        "gross_monthly": round(gross_annual / 12),
        "deductions": deductions,
        "total_deductions": total_deductions,
        "net_annual": net_annual,
        "net_monthly": round(net_annual / 12),
    }


def _table_style(header=False, highlight=False):
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
    ]
    if header:
        style += [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#6366f1")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ]
    if highlight:
        style.append(("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#eef2ff")))
    return TableStyle(style)


def generate_payslip_pdf(candidate_id: int, candidate_name: str, role: str, bank_details: dict, salary_breakdown: dict) -> str:
    """Builds the PDF and returns its file path."""
    os.makedirs(PAYSLIP_DIR, exist_ok=True)
    file_path = f"{PAYSLIP_DIR}/payslip_{candidate_id}.pdf"

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle("PayslipTitle", parent=styles["Title"], fontSize=18)
    heading_style = ParagraphStyle("PayslipHeading", parent=styles["Heading2"], spaceBefore=14, spaceAfter=6)

    doc = SimpleDocTemplate(file_path, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    elements = []

    elements.append(Paragraph("Payroll &amp; Compensation Confirmation", title_style))
    elements.append(Paragraph(f"Generated on {datetime.date.today().strftime('%d %b %Y')}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    elements.append(Paragraph("Employee Details", heading_style))
    employee_table = Table([
        ["Name", candidate_name or "-"],
        ["Role", role or "-"],
        ["Employee ID", str(candidate_id)],
    ], colWidths=[5 * cm, 10 * cm])
    employee_table.setStyle(_table_style())
    elements.append(employee_table)

    elements.append(Paragraph("Bank Details", heading_style))
    bank_table = Table([
        ["Bank Name", bank_details.get("bank_name", "-")],
        ["Account Number", bank_details.get("account_number", "-")],
        ["PAN Number", bank_details.get("pan_number", "-")],
    ], colWidths=[5 * cm, 10 * cm])
    bank_table.setStyle(_table_style())
    elements.append(bank_table)

    elements.append(Paragraph(f"Annual CTC: Rs. {salary_breakdown['annual_ctc']:,}", heading_style))
    earnings_rows = [["Earnings Component", "Annual (Rs.)", "Monthly (Rs.)"]]
    for label, amount in salary_breakdown["earnings"].items():
        earnings_rows.append([label, f"{amount:,}", f"{round(amount / 12):,}"])
    earnings_rows.append(["Gross Earnings", f"{salary_breakdown['gross_annual']:,}", f"{round(salary_breakdown['gross_monthly']):,}"])
    earnings_table = Table(earnings_rows, colWidths=[7 * cm, 4 * cm, 4 * cm])
    earnings_table.setStyle(_table_style(header=True))
    elements.append(earnings_table)
    elements.append(Spacer(1, 8))

    deduction_rows = [["Deductions", "Annual (Rs.)"]]
    for label, amount in salary_breakdown["deductions"].items():
        deduction_rows.append([label, f"{amount:,}"])
    deduction_rows.append(["Total Deductions", f"{salary_breakdown['total_deductions']:,}"])
    deduction_table = Table(deduction_rows, colWidths=[10 * cm, 5 * cm])
    deduction_table.setStyle(_table_style(header=True))
    elements.append(deduction_table)
    elements.append(Spacer(1, 8))

    net_table = Table([
        ["Net Annual Salary", f"Rs. {salary_breakdown['net_annual']:,}"],
        ["Net Monthly Salary", f"Rs. {salary_breakdown['net_monthly']:,}"],
    ], colWidths=[10 * cm, 5 * cm])
    net_table.setStyle(_table_style(highlight=True))
    elements.append(net_table)

    elements.append(Spacer(1, 20))
    elements.append(Paragraph(
        "This is a system-generated document produced as part of the onboarding process. "
        "Please verify your bank details are correct and contact HR immediately for any corrections.",
        styles["Italic"]
    ))

    doc.build(elements)
    return file_path
