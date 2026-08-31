Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c """ & WshShell.CurrentDirectory & "\?????-????????.bat""", 0, False
