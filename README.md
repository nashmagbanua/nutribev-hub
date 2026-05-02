# 🏢 ABN Gaurd Manifest attendance record

## 🚀 Live Preview

🔗 Demo: [https://your-link.com](https://mynutribev.vercel.app/)

## 📷 System Preview

### 🏭 Factory Background
![Factory](https://raw.githubusercontent.com/nashmagbanua/nutribev-hub/main/background.webp)

---


A modern **Employee Attendance, Kiosk, and HR Management System** built for ABN Engineering.

This system supports:
- 🖥️ Kiosk-based Time In / Time Out (company desktop)
- 📲 PWA mobile app for employees
- ☁️ Supabase backend (central database)
- 📧 Email notifications for attendance logs
- 📊 HR dashboard for monitoring employees

---

## 🚀 Features

### 👷 Employee System (PWA)
- Time In / Time Out
- Attendance history
- Profile management (avatar, email, position)
- Push/email notifications (optional)

---

### 🖥️ Kiosk System (Company Use)
- Official Time In / Time Out station
- GPS validation (inside company only)
- Birthday greetings with confetti 🎉
- Idle screen ads (employees, holidays, announcements)
- HR access shortcut code (attendance view)

---

### 👨‍💼 HR Dashboard
- View daily attendance logs
- Filter by employee, date, shift
- Late and overtime detection
- Export attendance reports
- Manage employee profiles

---

### ☁️ Backend (Supabase)
- Profiles table (employee data)
- Attendance records
- Edge Functions for automation
- Secure authentication system

---

## 🧠 System Logic

- Shift is determined by **Time In**
- 1 Time In / 1 Time Out per day
- Overtime is automatically calculated
- Night shift supports cross-day logging
- Mobile fallback allowed if kiosk is unavailable

---

## 🔔 Notifications

- Email notifications for:
  - Time In
  - Time Out
  - Late arrivals
  - Overtime records

---

## 📱 PWA Support

Employees can install the system as a **Progressive Web App (PWA)**:
- Works like a mobile app
- Installable on Android & iOS
- Supports offline-ready UI (limited functions)

---

## ⚙️ Tech Stack

- Frontend: React / TypeScript / Tailwind CSS
- Backend: Supabase
- Database: PostgreSQL (Supabase)
- Automation: Edge Functions
- Notifications: Email (Resend / SMTP)

---

## 🔐 Security Features

- GPS-based validation (kiosk / mobile)
- Device tracking (kiosk vs mobile fallback)
- Role-based access (Employee / HR / Admin)
- Login authentication via Supabase

---

## 📌 System Flow


Employee Time In/Out
↓
Supabase Database
↓
Edge Function Trigger
↓
Email Notification
↓
HR Dashboard Update


---

## 🎯 Purpose

This system is designed to:
- Improve workforce tracking
- Reduce manual attendance errors
- Automate HR reporting
- Provide real-time employee monitoring

---

## 👨‍💻 Developer

Aurelio Galelio Jhonas Magbanua 
Mantech - Utilities Dept.

---

## 📄 License

Internal company use only.


