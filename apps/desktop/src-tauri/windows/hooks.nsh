; OpenDock may have hidden the Windows taskbar. Put it back before the files go,
; and stop OpenDock from launching at sign-in once it's removed.
!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec '"$INSTDIR\${MAINBINARYNAME}.exe" --restore-taskbar'
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${PRODUCTNAME}"
!macroend
