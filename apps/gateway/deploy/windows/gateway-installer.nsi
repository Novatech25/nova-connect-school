; ===============================================
; NovaConnect Gateway - Script NSIS
; ===============================================
; Ce script crée un installateur Windows professionnel
; Utilisation: makensis /DVERSION=x.x.x gateway-installer.nsi
;
; Prérequis:
; - NSIS 3.0+: https://nsis.sourceforge.io/
; - Plugin NsProcess: http://nsis.sourceforge.net/NsProcess_plug-in
; ===============================================

!define APP_NAME "NovaConnect Gateway"
!define APP_ID "novaconnect-gateway"
!define APP_PUBLISHER "NovaConnect"
!define APP_URL "https://novaconnect.app"

; Version peut etre passee en ligne de commande: makensis /DVERSION=1.0.0
!ifndef VERSION
  !define VERSION "1.0.0"
!endif

; Fichier de sortie peut etre passe en ligne de commande: makensis /DOUTPUT_FILE=path\to\output.exe
!ifndef OUTPUT_FILE
  !define OUTPUT_FILE "NovaConnect-Gateway-Setup-${VERSION}.exe"
!endif

!define INSTALL_DIR "$PROGRAMFiles\NovaConnect\Gateway"
!define DATA_DIR "$APPDATA\NovaConnect\Gateway"

; ===============================================
; Configuration générale
; ===============================================

!define PRODUCT_NAME "${APP_NAME}"
!define PRODUCT_VERSION "${VERSION}"
!define PRODUCT_PUBLISHER "${APP_PUBLISHER}"
!define PRODUCT_WEB_SITE "${APP_URL}"
!define PRODUCT_DIR_REGKEY "Software\${APP_ID}"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

SetCompressor /SOLID lzma
OutFile "${OUTPUT_FILE}"

; ===============================================
; Interface utilisateur
; ===============================================

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"

; Images (à personnaliser)
;!define MUI_ICON "assets\icon.ico"
;!define MUI_UNICON "assets\icon.ico"
;!define MUI_HEADERIMAGE
;!define MUI_HEADERIMAGE_BITMAP "assets\header.bmp"
;!define MUI_WELCOMEFINISHPAGE_BITMAP "assets\wizard.bmp"

; Pages de l'installateur
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE.tmp"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"

; ===============================================
; Sections d'installation
; ===============================================

Section "Gateway Core" SecGateway
    SectionIn RO

    SetOutPath $INSTDIR

    ; Arrêter le service existant si présent
    Call StopService

    ; Copier les fichiers principaux
    File /r "..\..\src\*.*"
    File "..\..\package.json"
    File "..\..\README.md"

    ; Copier les scripts
    SetOutPath $INSTDIR\scripts
    File /r "scripts\*.ps1"

    ; Copier la configuration example
    SetOutPath $INSTDIR
    File ".env.example"

    ; Créer les répertoires de données
    CreateDirectory "${DATA_DIR}\data"
    CreateDirectory "${DATA_DIR}\logs"
    CreateDirectory "${DATA_DIR}\backups"

    ; Créer le fichier .env s'il n'existe pas
    IfFileExists "${DATA_DIR}\.env" SkipEnv
        CopyFiles /SILENT $INSTDIR\.env.example "${DATA_DIR}\.env"
    SkipEnv:

    ; Enregistrer les infos d'installation
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" $INSTDIR
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Version" ${PRODUCT_VERSION}
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "DataPath" "${DATA_DIR}"

    ; Enregistrer le programme dans Ajout/Suppression de programmes
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninstall.exe"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\scripts\status.ps1"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr HKLM "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD HKLM "${PRODUCT_UNINST_KEY}" "NoRepair" 1

    ; Créer le désinstallateur
    WriteUninstaller "$INSTDIR\uninstall.exe"

    ; Créer les raccourcis
    CreateDirectory "$SMPROGRAMS\${PRODUCT_NAME}"
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME} Admin.lnk" "http://localhost:3001/admin" "" "" 0
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Ouvrir le dossier d'installation.lnk" "$INSTDIR" "" "" 0
    CreateShortCut "$SMPROGRAMS\${PRODUCT_NAME}\Désinstaller.lnk" "$INSTDIR\uninstall.exe"

    ; Exécuter le script d'installation PowerShell
    ExecWait 'powershell.exe -ExecutionPolicy Bypass -File "$INSTDIR\scripts\install-service.ps1"'

    ; Marquer la section comme terminée
    WriteRegDWORD HKLM "${PRODUCT_DIR_REGKEY}" "Gateway" 1

SectionEnd

Section "Configuration initiale" SecConfig
    SetOutPath $INSTDIR

    ; Ouvrir le fichier de configuration
    ExecWait 'notepad.exe "${DATA_DIR}\.env"'

    MessageBox MB_OK|MB_ICONINFORMATION \
        "Configuration terminée.$\n$\nN'oubliez pas d'activer votre licence avec:$\n$\ncd $INSTDIR$\n\
        bun run activate --license VOTRE_CLE --school VOTRE_SCHOOL_ID"

SectionEnd

Section "Démarrer le service" SecStart
    Call StartService
SectionEnd

; ===============================================
; Section de désinstallation
; ===============================================

Section "Uninstall"
    ; Arrêter le service
    Call un.StopService

    ; Supprimer le service
    nsExec::ExecToLog 'nssm remove NovaConnectGateway confirm'

    ; Supprimer les raccourcis
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\${PRODUCT_NAME} Admin.lnk"
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\Ouvrir le dossier d'installation.lnk"
    Delete "$SMPROGRAMS\${PRODUCT_NAME}\Désinstaller.lnk"
    RMDir "$SMPROGRAMS\${PRODUCT_NAME}"

    ; Supprimer les fichiers
    RMDir /r $INSTDIR

    ; Demander si on supprime les données
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Voulez-vous supprimer toutes les données?$\n$\n\
        Cela inclut la base de données, les logs et la configuration." \
        IDNO NoDeleteData

    RMDir /r "${DATA_DIR}"
    NoDeleteData:

    ; Supprimer les clés de registre
    DeleteRegKey HKLM "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Run\${APP_ID}"

    MessageBox MB_OK|MB_ICONINFORMATION \
        "${PRODUCT_NAME} a été désinstallé avec succès."

SectionEnd

; ===============================================
; Fonctions utilitaires
; ===============================================

Function StopService
    nsExec::ExecToLog 'net stop NovaConnectGateway'
FunctionEnd

Function StartService
    nsExec::ExecToLog 'net start NovaConnectGateway'
FunctionEnd

Function un.StopService
    nsExec::ExecToLog 'net stop NovaConnectGateway'
FunctionEnd

; ===============================================
; Descriptions des sections
; ===============================================

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
    !insertmacro MUI_DESCRIPTION_TEXT ${SecGateway} \
        "Installation du service NovaConnect Gateway et de tous les fichiers nécessaires."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecConfig} \
        "Configuration initiale du service (identifiants Supabase, etc)."
    !insertmacro MUI_DESCRIPTION_TEXT ${SecStart} \
        "Démarrer automatiquement le service après l'installation."
!insertmacro MUI_FUNCTION_DESCRIPTION_END

; ===============================================
; Callbacks d'installation
; ===============================================

Function .onInit
    ; Vérifier si déjà installé
    ReadRegStr $R0 HKLM "${PRODUCT_DIR_REGKEY}" ""
    StrCmp $R0 "" done

    MessageBox MB_YESNO|MB_ICONQUESTION \
        "${PRODUCT_NAME} est déjà installé.$\n$\nVoulez-vous le désinstaller avant de réinstaller?" \
        IDYES uninst IDNO done

    uninst:
        ClearErrors
        ExecWait '$R0\uninstall.exe _?=$INSTDIR'
        IfErrors uninst_failed done

    uninst_failed:
        MessageBox MB_OK|MB_ICONEXCLAMATION \
            "La désinstallation a échoué.$\n$\nVeuillez désinstaller manuellement avant de continuer."
        Abort

    done:
FunctionEnd

Function un.onInit
    MessageBox MB_YESNO|MB_ICONQUESTION \
        "Êtes-vous sûr de vouloir désinstaller ${PRODUCT_NAME}?" \
        IDYES NoAbort
    Abort
    NoAbort:
FunctionEnd
