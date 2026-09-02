@echo off
echo ============================================
echo  Install yt-dlp untuk TikTok Downloader
echo ============================================
echo.

echo [1/3] Mengunduh yt-dlp.exe ...
curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe -o yt-dlp.exe
if %errorlevel% neq 0 (
    echo ERROR: Gagal mengunduh yt-dlp. Cek koneksi internet.
    pause
    exit /b 1
)

echo.
echo [2/3] yt-dlp.exe berhasil diunduh ke folder project.
echo.

echo [3/3] Update .env.local ...
echo. >> .env.local
echo # yt-dlp binary (di-set ke folder project) >> .env.local
echo YTDLP_PATH=./yt-dlp.exe >> .env.local

echo.
echo ============================================
echo  ✅ yt-dlp siap digunakan!
echo  Path: %CD%\yt-dlp.exe
echo ============================================
echo.
echo Restart npm run dev untuk mengaktifkan perubahan.
pause
