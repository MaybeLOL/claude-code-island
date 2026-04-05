param([int]$Pid, [int]$KeyNum)

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

Add-Type -AssemblyName System.Windows.Forms

try {
    $proc = Get-Process -Id $Pid -ErrorAction Stop
    $hwnd = $proc.MainWindowHandle
    if ($hwnd -eq [IntPtr]::Zero) {
        $parent = (Get-CimInstance Win32_Process -Filter "ProcessId=$Pid").ParentProcessId
        if ($parent) {
            $pproc = Get-Process -Id $parent -ErrorAction Stop
            $hwnd = $pproc.MainWindowHandle
        }
    }
    if ($hwnd -ne [IntPtr]::Zero) {
        [WinAPI]::ShowWindow($hwnd, 9)
        [WinAPI]::SetForegroundWindow($hwnd)
        Start-Sleep -Milliseconds 300
        [System.Windows.Forms.SendKeys]::SendWait("$KeyNum")
        Start-Sleep -Milliseconds 100
        [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    }
} catch {
    # silently fail
}
