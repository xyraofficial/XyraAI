<div align="center">

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=700&size=30&pause=1000&color=00FF00&center=true&vCenter=true&width=600&lines=TERMUX+AUTH+SYSTEM;%F0%9F%94%90+Secure+Authentication;%F0%9F%9A%80+Fast+%26+Reliable;%E2%9C%A8+By+XyraOfficial" alt="Typing SVG" />

<br/>

[![Python](https://img.shields.io/badge/Python-3.x-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Cython](https://img.shields.io/badge/Cython-Protected-orange?style=for-the-badge&logo=python&logoColor=white)](https://cython.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/License-Private-red?style=for-the-badge)](LICENSE)

<br/>

<img src="https://user-images.githubusercontent.com/73097560/115834477-dbab4500-a447-11eb-908a-139a6edaec5c.gif">

<h3>
  <img src="https://media.giphy.com/media/WUlplcMpOCEmTGBtBW/giphy.gif" width="30"> 
  Terminal Authentication System for Android
  <img src="https://media.giphy.com/media/WUlplcMpOCEmTGBtBW/giphy.gif" width="30">
</h3>

</div>

---

## <img src="https://media.giphy.com/media/iY8CRBdQXODJSCERIr/giphy.gif" width="30"> Preview

<div align="center">

```
╭───────────────────────────────╮
│   ★ TERMUX AUTH SYSTEM ★      │
│      by XyraOfficial          │
╰───────────────────────────────╯

╭────────────────╮  ╭────────────────╮
│  DEVICE INFO   │  │   USER INFO    │
├────────────────┤  ├────────────────┤
│ Brand  : Xiaomi│  │ IP    : x.x.x.x│
│ Model  : Redmi │  │ Tanggal: Today │
│ Android: 14    │  │ Waktu  : Now   │
╰────────────────╯  ╰────────────────╯
```

</div>

---

## <img src="https://media.giphy.com/media/VgCDAzcKvsR6OM0uWg/giphy.gif" width="30"> Features

<table>
<tr>
<td width="50%">

### <img src="https://media.giphy.com/media/3oKIPnAiaMCws8nOsE/giphy.gif" width="20"> Authentication
- Email + Password Login
- OTP Email Verification  
- Secure Password Hashing
- Session Management

</td>
<td width="50%">

### <img src="https://media.giphy.com/media/JWy2zBSXQ5lni15jJP/giphy.gif" width="20"> Security
- AES-Fernet Encryption
- Cython Compiled Binary
- Protected Source Code
- Encrypted Configuration

</td>
</tr>
<tr>
<td width="50%">

### <img src="https://media.giphy.com/media/WFZvB7VIXBgiz3oDXE/giphy.gif" width="20"> Admin Panel
- User Management
- Credit System Control
- Database Statistics
- User Verification

</td>
<td width="50%">

### <img src="https://media.giphy.com/media/fwbzI2kV3Qrlpkh59e/giphy.gif" width="20"> UI/UX
- Beautiful Terminal UI
- Rich Text Formatting
- Interactive Menus
- Progress Animations

</td>
</tr>
</table>

---

## <img src="https://media.giphy.com/media/ln7z2eWriiQAllfVcn/giphy.gif" width="25"> Installation

<details>
<summary><b>Click to expand installation guide</b></summary>

### Termux (Android)

```bash
# Update packages
pkg update && pkg upgrade -y

# Install Python & dependencies
pkg install python python-cryptography git -y

# Clone repository
git clone https://github.com/XyraOfficial/termux-auth.git

# Navigate to folder
cd termux-auth/run

# Run the application
python run.py
```

### Linux/PC

```bash
# Clone repository
git clone https://github.com/XyraOfficial/termux-auth.git

# Navigate to folder
cd termux-auth/run

# Install dependencies (auto-installed on first run)
pip install requests cryptography tqdm tabulate rich simple-term-menu fake-useragent

# Run
python run.py
```

</details>

---

## <img src="https://media.giphy.com/media/SS8CV2rQdlYNLtBCiF/giphy.gif" width="25"> Project Structure

```
termux-auth/
├── 📁 encrypt/                    # Developer Only (Private)
│   ├── 🔧 termux_auth_core.pyx    # Source code (Cython)
│   ├── ⚙️ setup.py                # Build configuration
│   ├── 📜 setup_termux.sh         # Termux build script
│   ├── 🔐 encrypt_config.py       # Config encryption
│   ├── 📄 config.json             # Plain config (DO NOT SHARE)
│   └── 🔒 config.enc              # Encrypted config
│
├── 📁 run/                        # Distribution (Public)
│   ├── 🚀 run.py                  # Main launcher
│   ├── 🔒 config.enc              # Encrypted config
│   ├── 📚 termux_auth_lib*.so     # Compiled binary
│   └── 📖 README.txt              # User guide
│
└── 📄 README.md                   # This file
```

---

## <img src="https://media.giphy.com/media/hqU2KkjW5bE2v2Z7Q2/giphy.gif" width="25"> Tech Stack

<div align="center">

<img src="https://skillicons.dev/icons?i=python,git,github,linux&theme=dark" />

| Technology | Purpose |
|:----------:|:-------:|
| <img src="https://img.shields.io/badge/Python-FFD43B?style=flat-square&logo=python&logoColor=blue" width="100"> | Core Language |
| <img src="https://img.shields.io/badge/Cython-orange?style=flat-square&logo=python&logoColor=white" width="100"> | Code Protection |
| <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white" width="100"> | Backend & Auth |
| <img src="https://img.shields.io/badge/Gmail-D14836?style=flat-square&logo=gmail&logoColor=white" width="100"> | Email OTP |
| <img src="https://img.shields.io/badge/Rich-000000?style=flat-square&logo=python&logoColor=white" width="100"> | Terminal UI |

</div>

---

## <img src="https://media.giphy.com/media/kH1DBkPNyZPOk0BxrM/giphy.gif" width="25"> Credit System

| Feature | Description |
|---------|-------------|
| Default Credit | 3 credits for new users |
| Cost per Round | 1 credit per round |
| Max Rounds | 4 rounds per session |
| Admin Control | Full credit management |

---

## <img src="https://media.giphy.com/media/uhQuegHFqkVYuFMXMQ/giphy.gif" width="25"> Screenshots

<div align="center">

| Main Menu | Profile | Admin Panel |
|:---------:|:-------:|:-----------:|
| <img src="https://via.placeholder.com/200x150/1a1a2e/ffffff?text=Main+Menu" width="200"> | <img src="https://via.placeholder.com/200x150/16213e/ffffff?text=Profile" width="200"> | <img src="https://via.placeholder.com/200x150/0f0f23/ffffff?text=Admin" width="200"> |

</div>

---

## <img src="https://media.giphy.com/media/LnQjpWaON8nhr21vNW/giphy.gif" width="25"> Connect with Me

<div align="center">

[![WhatsApp](https://img.shields.io/badge/WhatsApp-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/62895325844493)
[![YouTube](https://img.shields.io/badge/YouTube-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtube.com/@Kz.tutorial)
[![Email](https://img.shields.io/badge/Email-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:xyraofficialsup@gmail.com)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/XyraOfficial)

</div>

---

<div align="center">

### <img src="https://media.giphy.com/media/VgCDAzcKvsR6OM0uWg/giphy.gif" width="25"> Statistics

<img src="https://github-readme-stats.vercel.app/api?username=XyraOfficial&show_icons=true&theme=radical&hide_border=true" alt="GitHub Stats" />

<img src="https://github-readme-streak-stats.herokuapp.com/?user=XyraOfficial&theme=radical&hide_border=true" alt="GitHub Streak" />

</div>

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer&animation=twinkling"/>

### Made with <img src="https://media.giphy.com/media/WUlplcMpOCEmTGBtBW/giphy.gif" width="20"> by XyraOfficial

<img src="https://komarev.com/ghpvc/?username=XyraOfficial&label=Profile%20Views&color=blueviolet&style=flat-square" alt="Profile Views" />

**Copyright 2024 XyraOfficial - All Rights Reserved**

</div>
