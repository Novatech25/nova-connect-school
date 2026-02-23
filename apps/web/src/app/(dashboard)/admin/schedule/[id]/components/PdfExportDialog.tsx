'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileDown, Check } from 'lucide-react'
import type { PdfColorTheme } from '@/lib/pdf/schedule-pdf'

// ─── Thèmes prédéfinis ────────────────────────────────────────────────────────

export const PDF_COLOR_THEMES: { id: string; label: string; theme: PdfColorTheme }[] = [
  {
    id: 'blue',
    label: 'Bleu (défaut)',
    theme: {
      headerBg:    [15,  40,  90],
      headerAccent:[37,  99, 235],
      slotBg:      [219, 234, 254],
      slotText:    [30,  64, 175],
      slotContBg:  [239, 246, 255],
      slotContText:[96, 130, 200],
    },
  },
  {
    id: 'green',
    label: 'Vert émeraude',
    theme: {
      headerBg:    [6,   78,  59],
      headerAccent:[16, 185, 129],
      slotBg:      [209, 250, 229],
      slotText:    [6,   95,  70],
      slotContBg:  [236, 253, 245],
      slotContText:[52, 160, 120],
    },
  },
  {
    id: 'violet',
    label: 'Violet royal',
    theme: {
      headerBg:    [46,  16, 101],
      headerAccent:[139, 92, 246],
      slotBg:      [237, 233, 254],
      slotText:    [91,  33, 182],
      slotContBg:  [245, 243, 255],
      slotContText:[124, 90, 200],
    },
  },
  {
    id: 'orange',
    label: 'Orange ardent',
    theme: {
      headerBg:    [67,  20,   7],
      headerAccent:[234, 88,  12],
      slotBg:      [254, 215, 170],
      slotText:    [154, 52,  18],
      slotContBg:  [255, 237, 213],
      slotContText:[194, 100, 60],
    },
  },
  {
    id: 'slate',
    label: 'Ardoise',
    theme: {
      headerBg:    [15,  23,  42],
      headerAccent:[100, 116, 139],
      slotBg:      [226, 232, 240],
      slotText:    [51,  65,  85],
      slotContBg:  [241, 245, 249],
      slotContText:[100, 116, 139],
    },
  },
  {
    id: 'red',
    label: 'Bordeaux',
    theme: {
      headerBg:    [76,  5,   25],
      headerAccent:[190, 18,  60],
      slotBg:      [254, 205, 211],
      slotText:    [136, 19,  55],
      slotContBg:  [255, 228, 230],
      slotContText:[180, 60,  90],
    },
  },
  {
    id: 'teal',
    label: 'Turquoise',
    theme: {
      headerBg:    [8,   75,  89],
      headerAccent:[20, 184, 166],
      slotBg:      [204, 251, 241],
      slotText:    [15, 118, 110],
      slotContBg:  [236, 254, 255],
      slotContText:[45, 160, 150],
    },
  },
  {
    id: 'amber',
    label: 'Or scolaire',
    theme: {
      headerBg:    [67,  40,   2],
      headerAccent:[217, 119, 6],
      slotBg:      [254, 243, 199],
      slotText:    [146, 64,  14],
      slotContBg:  [255, 251, 235],
      slotContText:[180, 100, 30],
    },
  },
]

// ─── Aperçu d'un thème ───────────────────────────────────────────────────────

function ThemePreview({ theme }: { theme: PdfColorTheme }) {
  const toHex = (rgb: [number, number, number]) =>
    `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`
  return (
    <div className="overflow-hidden rounded border" style={{ width: 64, height: 44 }}>
      {/* Mini en-tête */}
      <div
        className="flex items-center justify-center"
        style={{ background: toHex(theme.headerBg), height: 14 }}
      >
        <div
          className="h-1 w-8 rounded"
          style={{ background: toHex(theme.headerAccent) }}
        />
      </div>
      {/* Mini grille */}
      <div className="grid grid-cols-3 gap-px p-0.5" style={{ background: '#e2e8f0', height: 30 }}>
        {/* colonne heure */}
        <div className="rounded-sm bg-slate-100" />
        {/* créneaux */}
        <div className="rounded-sm" style={{ background: toHex(theme.slotBg) }} />
        <div className="rounded-sm bg-white" />
        <div className="rounded-sm bg-white" />
        <div className="rounded-sm" style={{ background: toHex(theme.slotBg) }} />
        <div className="rounded-sm" style={{ background: toHex(theme.slotContBg) }} />
      </div>
    </div>
  )
}

// ─── Dialog principal ─────────────────────────────────────────────────────────

interface PdfExportDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onConfirm: (theme: PdfColorTheme) => void
  isGenerating?: boolean
}

export function PdfExportDialog({
  open,
  onOpenChange,
  onConfirm,
  isGenerating = false,
}: PdfExportDialogProps) {
  const [selectedId, setSelectedId] = useState('blue')

  const selectedTheme = PDF_COLOR_THEMES.find(t => t.id === selectedId)!.theme

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileDown className="h-5 w-5" />
            Télécharger l&apos;emploi du temps (PDF)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Choisissez un thème de couleurs pour votre PDF :
          </p>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PDF_COLOR_THEMES.map(({ id, label, theme }) => (
              <button
                key={id}
                type="button"
                onClick={() => setSelectedId(id)}
                className={`group relative flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-all hover:shadow-md ${
                  selectedId === id
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-transparent hover:border-muted-foreground/30'
                }`}
              >
                <ThemePreview theme={theme} />
                <span className="text-center text-xs font-medium leading-tight">
                  {label}
                </span>
                {selectedId === id && (
                  <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Annuler
          </Button>
          <Button
            onClick={() => onConfirm(selectedTheme)}
            disabled={isGenerating}
          >
            <FileDown className="mr-2 h-4 w-4" />
            {isGenerating ? 'Génération...' : 'Télécharger'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
