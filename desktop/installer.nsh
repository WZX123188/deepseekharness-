# 自定义：安装时让用户勾选是否创建快捷方式
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

Var dshDesktopChecked
Var dshStartMenuChecked

Function dshShortcutPage
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 0 100% 20u "请选择要创建的快捷方式："
  Pop $0
  ${NSD_CreateCheckbox} 0 25u 100% 10u "创建桌面快捷方式"
  Pop $dshDesktopChecked
  ${NSD_SetState} $dshDesktopChecked ${BST_CHECKED}
  ${NSD_CreateCheckbox} 0 45u 100% 10u "创建开始菜单快捷方式"
  Pop $dshStartMenuChecked
  ${NSD_SetState} $dshStartMenuChecked ${BST_CHECKED}
  nsDialogs::Show
FunctionEnd

Page custom dshShortcutPage

!macro customInstall
  ${NSD_GetState} $dshDesktopChecked $0
  ${If} $0 != ${BST_CHECKED}
    Delete "$newDesktopLink"
  ${EndIf}
  ${NSD_GetState} $dshStartMenuChecked $0
  ${If} $0 != ${BST_CHECKED}
    Delete "$newStartMenuLink"
    RMDir "$SMPROGRAMS\${MENU_FILENAME}"
  ${EndIf}
!macroend
