@echo off
REM Jalankan backup database. Dipakai oleh Windows Task Scheduler.
REM Ubah path php.exe di bawah jika berbeda.

set PHP=C:\php85\php.exe
set ROOT=%~dp0

"%PHP%" "%ROOT%backup-db.php" >> "%ROOT%storage\backups\backup.log" 2>&1

REM Hapus backup lebih lama dari 30 hari
forfiles /P "%ROOT%storage\backups" /M backup_db_*.sql /D -30 /C "cmd /c del @path" >nul 2>&1
