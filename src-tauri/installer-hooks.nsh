!macro NSIS_HOOK_PREINSTALL
  nsExec::ExecToLog 'cmd /C taskkill /F /IM prism-runtime.exe >nul 2>nul'
  Pop $0
  nsExec::ExecToLog 'cmd /C taskkill /F /IM prism-backend-x86_64-pc-windows-msvc.exe >nul 2>nul'
  Pop $0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::ExecToLog 'cmd /C taskkill /F /IM prism-runtime.exe >nul 2>nul'
  Pop $0
  nsExec::ExecToLog 'cmd /C taskkill /F /IM prism-backend-x86_64-pc-windows-msvc.exe >nul 2>nul'
  Pop $0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  RMDir /r "$LOCALAPPDATA\Prism\logs"
  RMDir "$LOCALAPPDATA\Prism"
!macroend
