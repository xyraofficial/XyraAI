# XYRA Auth

Termux Authentication System - Sistem Autentikasi dengan OTP Email untuk Termux

## Fitur

- Signup dengan verifikasi OTP email
- Login dengan Supabase
- Template email OTP yang keren
- Kode OTP berlaku 5 menit
- 3x percobaan input OTP
- Auto-install dependensi
- Konfigurasi terenkripsi (aman)

## Instalasi

```bash
pip install xyra-auth
```

## Penggunaan

### Sebagai Command Line

```bash
xyra-auth
```

### Sebagai Module Python

```python
from xyra_auth import main
main()
```

### Menjalankan sebagai Module

```bash
python -m xyra_auth
```

## Persyaratan

Pastikan Anda memiliki file-file berikut di direktori kerja:

- `termux_auth_lib*.so` - Binary module (minta dari developer)
- `config.enc` - File konfigurasi terenkripsi

## Instalasi di Termux

```bash
# Update Termux
pkg update && pkg upgrade

# Install Python
pkg install python

# Install xyra-auth
pip install xyra-auth

# Jalankan
xyra-auth
```

## Menu Utama

1. **Signup** - Daftar akun baru
2. **Login** - Masuk ke akun
3. **Resend** - Kirim ulang OTP
4. **Reset** - Lupa password
5. **Exit** - Keluar

## Troubleshooting

### "File .so tidak cocok dengan device"
File .so harus sesuai arsitektur (ARM untuk Termux). Minta file .so versi ARM dari developer.

### "File .so tidak ditemukan"
Pastikan file `termux_auth_lib*.so` ada di folder yang sama.

### "File config tidak ditemukan"
Pastikan `config.enc` ada di folder yang sama.

### "OTP expired"
Kode hanya berlaku 5 menit, kirim ulang OTP.

## Kontak

Email: xyraofficialsup@gmail.com

## Lisensi

MIT License
