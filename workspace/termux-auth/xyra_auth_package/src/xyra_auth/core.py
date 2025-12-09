#!/usr/bin/env python3
"""
XYRA Auth - Core Module
Pure Python version - supports all devices
"""
import sys
import os
import platform
import subprocess
import time
import math
import threading

REQUIRED_PACKAGES = ["requests", "tabulate", "rich", "simple-term-menu", "fake-useragent", "tqdm"]

PACKAGE_DIR = os.path.dirname(os.path.abspath(__file__))
SOUNDS_DIR = os.path.join(PACKAGE_DIR, "sounds")

def _play_sound_file(filename):
    filepath = os.path.join(SOUNDS_DIR, filename)
    if os.path.exists(filepath):
        try:
            subprocess.Popen(
                ["play", "-q", filepath],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except FileNotFoundError:
            try:
                subprocess.Popen(
                    ["ffplay", "-nodisp", "-autoexit", "-loglevel", "quiet", filepath],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
            except FileNotFoundError:
                sys.stdout.write('\a')
                sys.stdout.flush()
    else:
        sys.stdout.write('\a')
        sys.stdout.flush()

def play_beep():
    threading.Thread(target=_play_sound_file, args=("startup.wav",), daemon=True).start()

def play_startup_sound():
    threading.Thread(target=_play_sound_file, args=("startup.wav",), daemon=True).start()

def play_success_sound():
    threading.Thread(target=_play_sound_file, args=("success.mp3",), daemon=True).start()

def play_error_sound():
    threading.Thread(target=_play_sound_file, args=("error.wav",), daemon=True).start()

R = '\033[0m'
B = '\033[1m'
D = '\033[2m'
RD = '\033[91m'
GR = '\033[92m'
YL = '\033[93m'
BL = '\033[94m'
MG = '\033[95m'
CY = '\033[96m'

BANNER = f"""{CY}
╭────────────────────────────────────────────────────────────╮
│                                                            │
│     {GR}████████╗███████╗██████╗ ███╗   ███╗██╗   ██╗██╗  ██╗{CY}  │
│     {GR}╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║   ██║╚██╗██╔╝{CY}  │
│        {GR}██║   █████╗  ██████╔╝██╔████╔██║██║   ██║ ╚███╔╝{CY}   │
│        {GR}██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║   ██║ ██╔██╗{CY}   │
│        {GR}██║   ███████╗██║  ██║██║ ╚═╝ ██║╚██████╔╝██╔╝ ██╗{CY}  │
│        {GR}╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═╝{CY}  │
│                                                            │
│            {B}{MG}A U T H   S Y S T E M{R}{CY}                           │
│              {D}by XyraOfficial{R}{CY}                               │
│                                                            │
╰────────────────────────────────────────────────────────────╯{R}
"""

def clear():
    os.system('clear' if os.name == 'posix' else 'cls')

def is_termux():
    return os.path.exists("/data/data/com.termux") or "com.termux" in os.environ.get("PREFIX", "")

def animated_progress_bar(description, duration=1.5, width=30):
    """Display simple animated progress bar"""
    print()
    print(f"  {YL}⚡{R} {B}{description}{R}")
    
    steps = 50
    for i in range(steps + 1):
        progress = i / steps
        filled = int(width * progress)
        empty = width - filled
        
        bar = f"{GR}{'█' * filled}{D}{'░' * empty}{R}"
        percent = int(progress * 100)
        
        sys.stdout.write(f"\r  [{bar}] {GR}{percent:3d}%{R}")
        sys.stdout.flush()
        time.sleep(duration / steps)
    
    print()
    print()

def check_termux_packages():
    """Check and install required Termux packages"""
    if not is_termux():
        return True
    
    required_pkgs = ["ncurses-utils"]
    packages_to_install = []
    
    for pkg in required_pkgs:
        try:
            result = subprocess.run(
                ["dpkg", "-s", pkg],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            if result.returncode != 0:
                packages_to_install.append(pkg)
        except:
            pass
    
    if packages_to_install:
        for pkg in packages_to_install:
            animated_progress_bar(f"Installing {pkg}", duration=2.0)
            try:
                subprocess.run(
                    ["pkg", "install", "-y", pkg],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL
                )
                print(f"  {GR}[✓]{R} {pkg} berhasil diinstall!")
            except:
                print(f"  {RD}[✗]{R} Gagal install {pkg}")
        print()
    
    return True

def check_internet():
    try:
        import socket
        socket.setdefaulttimeout(5)
        socket.socket(socket.AF_INET, socket.SOCK_STREAM).connect(("8.8.8.8", 53))
        return True
    except:
        return False

def install_missing_packages():
    missing = []
    for pkg in REQUIRED_PACKAGES:
        pkg_import = pkg.replace("-", "_")
        try:
            __import__(pkg_import)
        except ImportError:
            missing.append(pkg)
    
    if not missing:
        return True
    
    in_termux = is_termux()
    for pkg in missing:
        try:
            subprocess.check_call(
                [sys.executable, "-m", "pip", "install", pkg, "-q"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except:
            return False
    return True

def fg_gradient(i, idx):
    bright = int(150 + 80 * math.sin(i/10 + idx/2))
    return f"\033[38;2;0;{bright};0m"

def show_loading_screen():
    clear()
    play_startup_sound()
    print(BANNER)
    
    check_termux_packages()
    
    if not install_missing_packages():
        print(f"\n  {RD}[!]{R} Gagal install dependensi!")
        return False
    
    spinner = ["◐","◓","◑","◒"]
    title = "⚡ INITIALIZING XYRA CORE ⚡"
    
    print("\n")
    
    for i in range(150):
        sys.stdout.write("\033[F\033[F")
        sys.stdout.write("\033[K")
        
        spin = spinner[i % len(spinner)]
        wave = "".join(fg_gradient(i, idx) + B + ch + R
                       for idx, ch in enumerate(title))
        
        print(f"  {spin} {wave}")
        sys.stdout.write("\033[K\n")
        
        time.sleep(0.03)
    
    sys.stdout.write("\033[F\033[F")
    sys.stdout.write("\033[K")
    sys.stdout.write("\n")
    sys.stdout.write("\033[F")
    sys.stdout.write("\033[K")
    
    online = check_internet()
    config_ok = os.path.exists(os.path.join(os.getcwd(), "config.json")) or os.path.exists(os.path.join(PACKAGE_DIR, "config.json"))
    
    if not online:
        print()
        print(f"  {RD}╭──────────────────────────────────────────╮{R}")
        print(f"  {RD}│                                          │{R}")
        print(f"  {RD}│     ⚠  TIDAK ADA KONEKSI INTERNET  ⚠     │{R}")
        print(f"  {RD}│                                          │{R}")
        print(f"  {RD}╰──────────────────────────────────────────╯{R}")
        print()
        print(f"  {RD}[✗]{R} Script tidak dapat digunakan tanpa internet")
        print(f"  {YL}[!]{R} Pastikan koneksi internet aktif")
        print()
        play_error_sound()
        return False
    
    if not config_ok:
        print(f"  {RD}[x]{R} Config tidak ditemukan!")
        print(f"  {YL}[i]{R} Butuh file config.json\n")
        play_error_sound()
        return False
    
    print(f"  {B}{GR}✔ Sistem siap! (Pure Python){R}")
    play_success_sound()
    print()
    
    return True

def main():
    if not show_loading_screen():
        return
    
    try:
        from .termux_auth_lib import run_main
        run_main()
    except ImportError as e:
        try:
            from termux_auth_lib import run_main
            run_main()
        except ImportError as e2:
            print(f"\n  {RD}[!]{R} Error: {e2}")
            print()

def run():
    """Alias for main() function"""
    main()

if __name__ == "__main__":
    main()
