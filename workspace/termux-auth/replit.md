# Termux Auth System

## Overview

This is a terminal-based authentication system designed for Android devices running Termux. It provides user registration and login functionality with email-based OTP (One-Time Password) verification. The system is built with Python and uses Supabase as the backend authentication service.

Key capabilities:
- User signup with email OTP verification
- User login via Supabase authentication
- OTP resend functionality
- Password reset flow
- Device information detection (brand, model, Android version)
- Encrypted configuration storage for secure credential handling

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Application Structure
The project is organized into three main components:

1. **encrypt/** - Source code and build tools for creating protected `.so` binaries using Cython
2. **run/** - Runtime environment with the compiled application and launcher
3. **xyra_auth_package/** - Pure Python package version for distribution via pip

### Authentication Flow
- Uses Supabase as the authentication backend
- Email-based OTP verification with 5-minute expiry
- Maximum 3 OTP input attempts per session
- Encrypted configuration files to protect API keys and credentials

### Security Approach
- Cython compilation to `.so` files for code protection (optional)
- Configuration encryption using PBKDF2-derived keys with Fernet encryption
- Fallback XOR encryption when cryptography library is unavailable
- Hardcoded salt and passphrase for key derivation (stored in code)

### Terminal UI
- Rich terminal interface using `rich` and `tabulate` libraries
- Interactive menus via `simple-term-menu`
- Sound feedback for user actions (startup, success, error)
- ANSI color codes for styled output

### Package Distribution
The `xyra_auth_package` provides a pip-installable version:
- Entry point: `xyra-auth` command
- Module execution: `python -m xyra_auth`
- Pure Python implementation for cross-device compatibility

## External Dependencies

### Backend Services
- **Supabase** - Authentication backend and user database
  - URL: `https://feesaxvfbgsgbrncbgpd.supabase.co`
  - Uses both public key and service role key

### Email Service
- **Gmail SMTP** - For sending OTP verification emails
  - Uses app-specific password authentication

### Python Libraries
- `requests` - HTTP client for API calls
- `cryptography` - Fernet encryption for config files
- `tabulate` - Table formatting in terminal
- `rich` - Rich text and styling in terminal
- `simple-term-menu` - Interactive menu system
- `fake-useragent` - User agent generation
- `tqdm` - Progress bar display
- `Cython` - For compiling protected binaries (build-time only)

### System Requirements
- Python 3.x
- Termux (for Android deployment)
- Optional: `sox` or `ffplay` for sound playback