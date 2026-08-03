# Sends a file's bytes to a Windows printer queue as a RAW spool job.
#
# Used by src/main/print/raw-transport.ts to deliver ESC/POS commands to the
# thermal printer. The RAW datatype tells the spooler to skip the print
# processor's rendering entirely and push the bytes straight to the port, which
# is the only way ESC/POS survives an installed vendor driver.
#
# Windows exposes this through winspool.drv only, so it needs a P/Invoke shim
# (the canonical RawPrinterHelper from Microsoft KB 322091).

param(
  [Parameter(Mandatory = $true)][string]$Printer,
  [Parameter(Mandatory = $true)][string]$Path
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFOW {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }

  [DllImport("winspool.Drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true)]
  private static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
  private static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOW di);

  [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
  private static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
  private static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
  private static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true)]
  private static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

  private static void Check(bool ok, string what) {
    if (!ok) throw new Exception(what + " failed (Win32 error " + Marshal.GetLastWin32Error() + ")");
  }

  public static void Send(string printerName, byte[] bytes) {
    IntPtr hPrinter;
    Check(OpenPrinter(printerName, out hPrinter, IntPtr.Zero), "OpenPrinter");
    try {
      DOCINFOW di = new DOCINFOW();
      di.pDocName = "Multicarnes POS ticket";
      di.pDataType = "RAW";
      Check(StartDocPrinter(hPrinter, 1, di), "StartDocPrinter");
      try {
        Check(StartPagePrinter(hPrinter), "StartPagePrinter");
        try {
          IntPtr buffer = Marshal.AllocCoTaskMem(bytes.Length);
          try {
            Marshal.Copy(bytes, 0, buffer, bytes.Length);
            int written;
            Check(WritePrinter(hPrinter, buffer, bytes.Length, out written), "WritePrinter");
            if (written != bytes.Length) {
              throw new Exception("WritePrinter wrote " + written + " of " + bytes.Length + " bytes");
            }
          } finally {
            Marshal.FreeCoTaskMem(buffer);
          }
        } finally {
          EndPagePrinter(hPrinter);
        }
      } finally {
        EndDocPrinter(hPrinter);
      }
    } finally {
      ClosePrinter(hPrinter);
    }
  }
}
'@

$bytes = [System.IO.File]::ReadAllBytes($Path)
[RawPrinter]::Send($Printer, $bytes)
