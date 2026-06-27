# 🔐 Kumbh Mela 2027 - Test Credentials

## 🌐 Access URL
**http://localhost:5173**

---

## 📱 SHERLOCK STATION LOGINS (Mobile Volunteers)
*No password required - just enter phone number*

| Name | Phone Number |
|------|-------------|
| Rajesh Kumar | `+919876543210` |
| Priya Sharma | `+919876543211` |
| Amit Patel | `+919876543212` |
| Sneha Desai | `+919123456789` |
| Vikram Singh | `+919999999999` |

**How to login:**
1. Click "Sherlock" button
2. Enter any phone number from above
3. Click "Login" (no password needed)

---

## 👮 POLICE CONTROL ROOM LOGINS

| Station Name | Login ID | Password |
|--------------|----------|----------|
| Nashik PS 1 | `nashik_ps1` | `police123` |
| Nashik PS 2 | `nashik_ps2` | `police123` |
| Test Station | `test_station` | `kumbh2027` |

**How to login:**
1. Click "Police" button
2. Enter Login ID (e.g., `nashik_ps1`)
3. Enter Password (e.g., `police123`)
4. Click "Login"

---

## 🎯 ADMIN/CENTRAL COMMAND LOGINS

| Name | Username | Password |
|------|----------|----------|
| System Admin | `admin` | `admin123` |
| Control Room | `control` | `control123` |

**How to login:**
1. Click "Admin" button
2. Enter Username (e.g., `admin`)
3. Enter Password (e.g., `admin123`)
4. Click "Login"

---

## ✅ Verified Working
All credentials have been successfully added to the database and tested.

### Backend Status:
- ✅ Running on port 3000
- ✅ PostgreSQL connected
- ✅ Redis connected
- ✅ Socket.IO active
- ✅ Queue workers running

### Frontend Status:
- ✅ Running on port 5173
- ✅ React + Vite ready
- ✅ All portals accessible

---

## 🚀 Quick Start Examples

### Example 1: Sherlock Login
```
1. Go to http://localhost:5173
2. Phone: +919876543210
3. Click Login
→ You're now logged in as "Rajesh Kumar"
```

### Example 2: Police Login
```
1. Go to http://localhost:5173
2. Click "Police" button
3. Login ID: nashik_ps1
4. Password: police123
5. Click Login
→ Access Police Control Room Dashboard
```

### Example 3: Admin Login
```
1. Go to http://localhost:5173
2. Click "Admin" button
3. Username: admin
4. Password: admin123
5. Click Login
→ Access Central Command Center
```

---

## 📞 Support
If login fails:
1. Check backend is running: `cd ~/claude-hack/backend && npm run dev`
2. Check frontend is running: `cd ~/claude-hack/frontend && npm run dev`
3. Verify Docker containers: `docker ps` (should show kumbh-postgres and kumbh-redis)
