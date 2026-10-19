!macro customInstall
  WriteRegStr SHELL_CONTEXT "Software\Classes\linka-play" "" "URL:Linka Play game"
  WriteRegStr SHELL_CONTEXT "Software\Classes\linka-play" "URL Protocol" ""
  WriteRegStr SHELL_CONTEXT "Software\Classes\linka-play\shell\open\command" "" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\"'
!macroend

!macro customUnInstall
  ReadRegStr $R0 SHELL_CONTEXT "Software\Classes\linka-play\shell\open\command" ""
  ${If} $R0 == '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" $\"%1$\"'
    DeleteRegKey SHELL_CONTEXT "Software\Classes\linka-play"
  ${EndIf}
!macroend
