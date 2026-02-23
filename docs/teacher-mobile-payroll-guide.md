# Teacher Mobile Payroll - User Guide

## Welcome to Your Mobile Payroll Interface

This guide helps you navigate and use the payroll features available on your mobile device.

## Getting Started

### Accessing the Payroll Section

1. Open the NovaConnect mobile app
2. Log in with your teacher credentials
3. Tap the **"Payroll"** tab in the bottom navigation bar (cash icon)

> **Note**: The Payroll tab is only visible for users with the "Teacher" role. If you don't see it, please contact your school administrator.

## Interface Overview

### Main Payroll Screen

When you open the Payroll section, you'll see:

#### 1. Current Month Estimate (Blue Card)

At the top, you'll see an estimate of your **current month's payroll**:

![Current Month Estimate](screenshots/mobile-payroll-estimate.png)

**What it shows:**
- **Heures validées**: Total validated hours this month
- **Montant estimé**: Estimated amount based on your hourly rate
- **Séances validées**: Number of validated sessions

**Important:** This is an **estimate**. The final amount may vary based on adjustments (primes, retenues, etc.).

#### 2. Statistics Cards

Four cards display your overall payroll history:

| Card | Description |
|------|-------------|
| **Heures Total** | All validated hours across all periods |
| **Montant Brut** | Gross amount before deductions |
| **Payé** (Green) | Amount already paid to you |
| **En attente** (Yellow) | Amount pending payment |

#### 3. Filter Buttons

Three buttons to filter your payroll entries:
- **Toutes**: Show all entries
- **Payées**: Only paid entries
- **En attente**: Only pending entries

#### 4. Payroll Entries List

Scrollable list of your payroll history. Each card shows:
- Period name (e.g., "Novembre 2024")
- Status badge (Brouillon, En attente, Payé)
- Date range
- Validated hours
- Net amount

## Viewing Payroll Details

### Opening a Payroll Entry

1. **Tap on any payroll entry card** in the list
2. The detail screen will open showing:
   - Period name and status
   - Main information (hours, rate, amounts)
   - Adjustments (if any)
   - Detailed breakdown by class and subject
   - Payment history (if paid)
   - Download PDF button

### Understanding the Detail Screen

#### Header Section

![Payroll Detail Header](screenshots/mobile-payroll-detail-header.png)

- **Period Name**: Large title at the top
- **Status Badge**: Color-coded badge showing current status

#### Main Information Card

| Field | Description |
|-------|-------------|
| **Heures validées** | Total validated hours for this period |
| **Taux horaire** | Your hourly rate in FCFA |
| **Montant brut** | Subtotal: hours × rate |
| **Net à payer** | Final amount after all adjustments |

#### Adjustments Section

If there are any adjustments (primes, bonuses, deductions), you'll see them listed here:

| Color | Meaning |
|-------|---------|
| 🟢 Green | Positive adjustment (bonus, prime) |
| 🔴 Red | Negative adjustment (deduction, retenue) |

#### Hours Breakdown Table

This table shows **detailed breakdown** of your hours by class and subject:

![Hours Breakdown Table](screenshots/mobile-payroll-breakdown.png)

**Columns:**
- **Classe**: Class name (e.g., "6ème A", "5ème B")
- **Matière**: Subject taught (e.g., "Mathématiques", "Physique")
- **Période**: Payroll period name
- **Heures**: Total hours for this class/subject
- **Séances**: Number of teaching sessions
- **Taux**: Hourly rate applied
- **Montant**: Amount earned for this class/subject

**Total Row**: Bottom row shows aggregated totals

> **Tip**: Swipe the table horizontally to see all columns on small screens.

#### Payment History

If you've received payments for this period, you'll see:
- Payment date
- Payment method (Cash, Bank Transfer, Mobile Money, etc.)
- Amount paid

## Downloading Your Pay Slip (PDF)

### How to Download

1. Open a payroll entry detail
2. Scroll to the bottom
3. Tap **"Télécharger la fiche PDF"** button
4. The PDF will open in your device's browser or PDF viewer
5. From there, you can:
   - Share it (email, messaging apps, etc.)
   - Save it to your device
   - Print it

### What's Included in the PDF

Your official pay slip includes:
- School information and logo
- Your personal information
- Payroll period dates
- Detailed breakdown of hours by class/subject
- Hourly rate calculation
- All adjustments (primes, retenues, avances)
- Net amount to be paid
- Payment details (if paid)
- Official generation date and slip number

## Understanding Status Badges

| Status | Color | Meaning |
|--------|-------|---------|
| **Brouillon** | Gray | Period is being prepared, not yet finalized |
| **En attente** | Yellow | Payroll calculated, waiting for payment |
| **Payé** | Green | Payment completed and recorded |
| **Annulé** | Red | Period cancelled (rare) |

## Notifications

You'll receive **push notifications** for:

### 1. Hours Validated 📝

When an admin validates your teaching hours:
```
✅ Heures validées
Vos heures du 15/11/2024 ont été validées (2.50h)
```

### 2. Payment Recorded 💰

When a payment is recorded:
```
💰 Paiement effectué
Un paiement de 150,000 FCFA a été enregistré pour la période Novembre 2024
```

**Tap a notification** to open the relevant payroll entry directly.

## Refreshing Data

### Pull to Refresh

If you think the data is outdated:
1. **Touch and hold** the payroll list
2. **Pull down** slowly
3. Release when you see the refresh indicator
4. Wait for the data to reload

The app automatically refreshes when you:
- Open the Payroll tab
- Return to the app from background

## Troubleshooting

### "No Data" or Empty List

**Possible causes:**
- You haven't taught any classes yet
- No lesson logs have been validated
- Payroll periods haven't been created

**Solution:** Contact your school administrator.

### Can't Download PDF

**Possible causes:**
- Poor internet connection
- Server is processing the PDF
- Browser doesn't support PDF viewing

**Solutions:**
1. Check your internet connection
2. Wait a few seconds and try again
3. Try a different browser
4. Clear your browser cache

### Current Month Estimate Shows 0

**Possible causes:**
- No hours validated this month
- Month just started (no lessons yet)
- Lessons not yet validated by admin

**Solution:** This is normal at the start of a month or before validations.

### Wrong Amount in Estimate

**Important:** The estimate is **not final**. It:
- Uses your last known hourly rate
- Doesn't include adjustments (primes, retenues)
- Doesn't account for pending changes

**Final amount** will be calculated when the payroll period is closed.

## FAQ

### Q: How often is payroll calculated?

**A:** Typically monthly. Your school sets the payroll periods (e.g., 1st to last day of each month).

### Q: When will I be paid?

**A:** Payment timing depends on your school's policy. Check with your administrator for specific payment dates.

### Q: Why is my estimate different from the final amount?

**A:** The estimate doesn't include:
- Adjustments (bonuses, deductions)
- Potential rate changes
- Admin corrections

The final amount is shown when the period status changes to "En attente" or "Payé".

### Q: Can I edit my payroll entries?

**A:** No. Payroll entries are managed by school administrators. If you see an error:
1. Note the period and amount
2. Contact your school administrator
3. They can make corrections through the admin panel

### Q: How long are PDF slips available?

**A:** PDF slips are stored indefinitely. You can download them anytime.

### Q: Can I access older payroll entries?

**A:** Yes. All your historical payroll entries are available. Scroll through the list or use filters.

### Q: What if I lose my phone?

**A:** Your data is safe in the cloud. Simply:
1. Reinstall the app on your new device
2. Log in with your credentials
3. All your payroll data will be available

## Best Practices

### Daily/Weekly

✅ **Check notifications** for validated hours
✅ **Review your estimate** to track earnings

### Monthly

✅ **Download PDF slips** for your records
✅ **Verify hours** in the breakdown table
✅ **Report discrepancies** to admin promptly

### Annually

✅ **Save all PDF slips** for tax purposes
✅ **Compare total earnings** with your records
✅ **Update your personal info** if changed

## Contact & Support

If you have issues or questions:

1. **Check this guide first** - most issues are covered here
2. **Contact your school administrator** - they manage payroll
3. **Technical issues** - contact NovaConnect support

## Privacy & Security

🔒 **Your payroll data is private:**
- Only you can see your payroll information
- School administrators can view/edit for management purposes
- Data is encrypted in transit and at rest
- Push notifications don't contain sensitive details

🔐 **Keep your account secure:**
- Don't share your login credentials
- Log out if using a shared device
- Keep your app updated

---

**Version**: 1.0
**Last Updated**: January 2025
**App Version**: NovaConnect Mobile 2.x

For the latest updates and features, check the app store for updates.
